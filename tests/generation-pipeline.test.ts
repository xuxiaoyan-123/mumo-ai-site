import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import type { R2BucketLike } from "../src/env";
import type { D1Database, D1ExecResult, D1PreparedStatement, D1Result } from "../src/lib/d1";
import {
  createGenerationTaskForUser,
  GenerationPipelineError,
  pollGenerationTaskForUser,
  type GenerationCreateInput,
  type GenerationPipelineDependencies,
} from "../src/lib/generation.server";
import { chargeGenerationTask, refundGenerationTask } from "../src/lib/credits.server";
import { cancelGenerationTaskForUser } from "../src/lib/admin.server";
import { updateModelConfiguration } from "../src/lib/admin.server";
import { getProviderConfigurationStatuses } from "../src/lib/providers/provider-configuration.server";
import type {
  ImageGenerationInput,
  ImageProvider,
  ProviderTaskCreated,
  ProviderTaskResult,
} from "../src/lib/providers/image-provider.server";
import { MockImageProvider } from "../src/lib/providers/mock-image.server";
import {
  createDefaultProviderRegistry,
  ProviderRegistryError,
} from "../src/lib/providers/provider-registry.server";

class MemoryStatement implements D1PreparedStatement {
  private bindings: unknown[] = [];

  constructor(
    private readonly database: Database,
    private readonly sql: string,
    private readonly beforeRun: (sql: string) => { success?: boolean; skip?: boolean },
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.bindings = values;
    return this;
  }

  async first<T>(columnName?: string): Promise<T | null> {
    const row = this.database.query(this.sql).get(...this.bindings) as T | null;
    if (!row || !columnName) return row;
    return (row as Record<string, T>)[columnName] ?? null;
  }

  async all<T>(): Promise<D1Result<T>> {
    const results = this.database.query(this.sql).all(...this.bindings) as T[];
    return { results, success: true, meta: { changes: 0 } };
  }

  async run<T>(): Promise<D1Result<T>> {
    const override = this.beforeRun(this.sql);
    if (override.skip) {
      return { results: [], success: override.success ?? true, meta: { changes: 0 } };
    }
    const result = this.database.query(this.sql).run(...this.bindings);
    return {
      results: [],
      success: override.success ?? true,
      meta: { changes: result.changes },
    };
  }

  async raw<T>(): Promise<T[]> {
    return this.database.query(this.sql).values(...this.bindings) as T[];
  }
}

class MemoryD1 implements D1Database {
  failNextStatementMatching: RegExp | null = null;
  returnSuccessFalseNextStatementMatching: RegExp | null = null;
  returnZeroChangesNextStatementMatching: RegExp | null = null;
  private batchTail: Promise<void> = Promise.resolve();

  constructor(readonly database = new Database(":memory:")) {}

  prepare(query: string): D1PreparedStatement {
    return new MemoryStatement(this.database, query, (sql) => {
      if (this.failNextStatementMatching?.test(sql)) {
        this.failNextStatementMatching = null;
        throw new Error("injected D1 statement failure");
      }
      if (this.returnSuccessFalseNextStatementMatching?.test(sql)) {
        this.returnSuccessFalseNextStatementMatching = null;
        return { success: false };
      }
      if (this.returnZeroChangesNextStatementMatching?.test(sql)) {
        this.returnZeroChangesNextStatementMatching = null;
        return { skip: true };
      }
      return {};
    });
  }

  async batch<T>(statements: D1PreparedStatement[]): Promise<Array<D1Result<T>>> {
    const previousBatch = this.batchTail;
    let releaseBatch!: () => void;
    this.batchTail = new Promise<void>((resolve) => {
      releaseBatch = resolve;
    });
    await previousBatch;
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results: Array<D1Result<T>> = [];
      for (const statement of statements) {
        const result = await statement.run<T>();
        if (result.success !== true) throw new Error("injected D1 unsuccessful result");
        results.push(result);
      }
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    } finally {
      releaseBatch();
    }
  }

  async exec(query: string): Promise<D1ExecResult> {
    this.database.exec(query);
    return { count: 0, duration: 0 };
  }
}

class MemoryR2 implements R2BucketLike {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  failPut = false;

  async put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void> {
    if (this.failPut) throw new Error("mock R2 put failed");
    let bytes: Uint8Array;
    if (value instanceof Blob) bytes = new Uint8Array(await value.arrayBuffer());
    else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
    else if (ArrayBuffer.isView(value)) {
      bytes = new Uint8Array(
        value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
      );
    } else {
      bytes = new Uint8Array(await new Response(value).arrayBuffer());
    }
    this.objects.set(key, {
      bytes,
      contentType: options?.httpMetadata?.contentType ?? "application/octet-stream",
    });
  }

  async get(key: string) {
    const object = this.objects.get(key);
    if (!object) return null;
    return {
      arrayBuffer: async () => Uint8Array.from(object.bytes).buffer,
      httpMetadata: { contentType: object.contentType },
    };
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

class PipelineProvider implements ImageProvider {
  readonly key = "mock";
  readonly capabilities = {
    modes: ["text-to-image", "image-to-image"],
    maxReferenceImages: 5,
    qualities: ["1K", "2K", "4K"],
  } as const;
  createCalls: ImageGenerationInput[] = [];
  createError: Error | null = null;
  pollError: Error | null = null;
  pollResults: ProviderTaskResult[] = [];
  pollResult: ProviderTaskResult = {
    taskId: "provider-task",
    status: "completed",
    images: [
      { kind: "base64", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), mimeType: "image/png" },
    ],
  };

  async createTask(input: ImageGenerationInput): Promise<ProviderTaskCreated> {
    this.createCalls.push(input);
    if (this.createError) throw this.createError;
    return {
      taskId: "provider-task",
      mode: input.referenceImages.length ? "image-to-image" : "text-to-image",
      status: "queued",
    };
  }

  async createTextToImageTask(input: ImageGenerationInput): Promise<ProviderTaskCreated> {
    return this.createTask({ ...input, referenceImages: [] });
  }

  async createImageToImageTask(input: ImageGenerationInput): Promise<ProviderTaskCreated> {
    return this.createTask(input);
  }

  async pollTask(): Promise<ProviderTaskResult> {
    if (this.pollError) throw this.pollError;
    return this.pollResults.shift() ?? this.pollResult;
  }

  async getTask(): Promise<ProviderTaskResult> {
    return this.pollTask();
  }

  async pollTextToImageTask(): Promise<ProviderTaskResult> {
    return this.pollTask();
  }

  async pollImageToImageTask(): Promise<ProviderTaskResult> {
    return this.pollTask();
  }
}

const USER_ID = "user-1";
const NOW = new Date("2026-07-14T12:00:00.000Z");

function schema(database: Database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE models_config (
       id TEXT PRIMARY KEY, model_key TEXT UNIQUE, display_name TEXT, provider TEXT,
       provider_model TEXT, cost_credits INTEGER, is_enabled INTEGER, sort_order INTEGER,
       supported_modes TEXT, max_reference_images INTEGER, description TEXT, updated_at TEXT
    );
    CREATE TABLE user_credits (
      user_id TEXT PRIMARY KEY, balance INTEGER NOT NULL, total_granted INTEGER DEFAULT 0,
      total_used INTEGER DEFAULT 0, updated_at TEXT
    );
    CREATE TABLE credit_ledger (
      id TEXT PRIMARY KEY, user_id TEXT, amount INTEGER, balance_after INTEGER,
      reason TEXT, ref_type TEXT, ref_id TEXT, note TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE uploaded_images (
      id TEXT PRIMARY KEY, user_id TEXT, r2_key TEXT UNIQUE, original_filename TEXT,
      mime_type TEXT, size_bytes INTEGER, status TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT, consumed_at TEXT
    );
    CREATE TABLE generation_tasks (
      id TEXT PRIMARY KEY, user_id TEXT, model_id TEXT, model_key TEXT, task_type TEXT,
      prompt TEXT, status TEXT, cost_credits INTEGER, provider_task_id TEXT,
      result_image_url TEXT, result_image_r2_key TEXT, error_code TEXT, error_message TEXT,
      request_json TEXT, response_json TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT, started_at TEXT, completed_at TEXT, idempotency_key TEXT,
      provider TEXT, provider_model TEXT, deduction_ledger_id TEXT, refund_ledger_id TEXT, generation_mode TEXT,
      attempt_count INTEGER DEFAULT 0, last_error TEXT, timeout_at TEXT
    );
    CREATE TABLE generation_history (
      id TEXT PRIMARY KEY, task_id TEXT, user_id TEXT, model_key TEXT, task_type TEXT,
      prompt TEXT, result_image_url TEXT, result_image_r2_key TEXT, cost_credits INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, deleted_at TEXT
    );
    CREATE TABLE generation_task_input_images (
      task_id TEXT, uploaded_image_id TEXT, sort_order INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(task_id, uploaded_image_id)
    );
    CREATE UNIQUE INDEX task_idempotency ON generation_tasks(user_id, idempotency_key);
    CREATE UNIQUE INDEX ledger_generation ON credit_ledger(ref_type, ref_id, reason);
    CREATE UNIQUE INDEX history_task ON generation_history(task_id);
  `);
  database.query("INSERT INTO users (id) VALUES (?)").run(USER_ID);
  database
    .query(
      `INSERT INTO models_config
       (id, model_key, display_name, provider, provider_model, cost_credits, is_enabled,
        supported_modes, max_reference_images)
       VALUES ('model-1', 'test-model', 'Test Model', 'mock', 'mock-image', 7, 1,
        '["text_to_image","image_to_image"]', 5)`,
    )
    .run();
  database
    .query(
      `INSERT INTO models_config
       (id, model_key, display_name, provider, provider_model, cost_credits, is_enabled,
        supported_modes, max_reference_images)
       VALUES ('model-pro', 'gpt-image-2-pro', 'GPT-IMAGE-2.0 PRO', 'vibelearning', 'gpt-image-2', 7, 1,
        '["text_to_image","image_to_image"]', 5)`,
    )
    .run();
  database
    .query(
      `INSERT INTO models_config
       (id, model_key, display_name, provider, provider_model, cost_credits, is_enabled,
        supported_modes, max_reference_images)
       VALUES ('model-vip', 'gpt-image-2-vip', 'GPT-Image-2-VIP', 'mock', 'vip-provider-model', 7, 1,
        '["text_to_image","image_to_image"]', 5)`,
    )
    .run();
  database
    .query("INSERT INTO user_credits (user_id, balance, total_used) VALUES (?, 20, 0)")
    .run(USER_ID);
}

function setup() {
  const db = new MemoryD1();
  schema(db.database);
  const bucket = new MemoryR2();
  const provider = new PipelineProvider();
  let id = 0;
  const dependencies: GenerationPipelineDependencies = {
    db,
    bucket,
    provider,
    now: () => NOW,
    idFactory: () => `id-${++id}`,
  };
  return { db, bucket, provider, dependencies };
}

function input(overrides: Partial<GenerationCreateInput> = {}): GenerationCreateInput {
  return {
    modelKey: "test-model",
    prompt: "A product on a clean background",
    referenceImageIds: [],
    parameters: { aspectRatio: "1:1", quality: "1K" },
    idempotencyKey: "request-1",
    ...overrides,
  };
}

function balance(db: MemoryD1): number {
  const row = db.database
    .query("SELECT balance FROM user_credits WHERE user_id = ?")
    .get(USER_ID) as { balance: number };
  return row.balance;
}

function count(db: MemoryD1, table: string): number {
  const allowed = new Set(["generation_tasks", "credit_ledger", "generation_history"]);
  if (!allowed.has(table)) throw new Error("invalid table");
  const row = db.database.query(`SELECT COUNT(*) AS value FROM ${table}`).get() as {
    value: number;
  };
  return row.value;
}

function taskRow(db: MemoryD1) {
  return db.database.query(
    "SELECT status, deduction_ledger_id, refund_ledger_id FROM generation_tasks LIMIT 1",
  ).get() as { status: string; deduction_ledger_id: string | null; refund_ledger_id: string | null };
}

function addAsset(
  db: MemoryD1,
  bucket: MemoryR2,
  options: { userId?: string; status?: string; expiresAt?: string } = {},
) {
  const userId = options.userId ?? USER_ID;
  db.database
    .query(
      `INSERT INTO uploaded_images
       (id, user_id, r2_key, original_filename, mime_type, size_bytes, status, expires_at)
       VALUES ('asset-1', ?, 'inputs/user/asset-1.png', 'asset.png', 'image/png', 4, ?, ?)`,
    )
    .run(userId, options.status ?? "ready", options.expiresAt ?? "2026-07-15T12:00:00.000Z");
  bucket.objects.set("inputs/user/asset-1.png", {
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    contentType: "image/png",
  });
}

function addTask(
  db: MemoryD1,
  options: { id: string; userId?: string; status?: string; deductionLedgerId?: string | null },
) {
  db.database
    .query(
      `INSERT INTO generation_tasks
       (id, user_id, model_key, task_type, prompt, status, cost_credits, deduction_ledger_id)
       VALUES (?, ?, 'test-model', 'image', 'task', ?, 7, ?)`,
    )
    .run(
      options.id,
      options.userId ?? USER_ID,
      options.status ?? "queued",
      options.deductionLedgerId ?? null,
    );
}

describe("generation task cancellation", () => {
  test("cancels a queued task that has not been charged", async () => {
    const { db } = setup();
    addTask(db, { id: "cancelable" });

    await expect(cancelGenerationTaskForUser(db, USER_ID, "cancelable")).resolves.toEqual({
      taskId: "cancelable",
      status: "canceled",
    });
    expect(taskRow(db).status).toBe("canceled");
  });

  test("does not falsely cancel a running task", async () => {
    const { db } = setup();
    addTask(db, { id: "running-task", status: "running" });

    await expect(cancelGenerationTaskForUser(db, USER_ID, "running-task")).rejects.toThrow(
      "任务已开始或已扣费，无法取消",
    );
    expect(taskRow(db).status).toBe("running");
  });

  test("does not cancel a queued task that has already been charged", async () => {
    const { db } = setup();
    addTask(db, { id: "charged-task", deductionLedgerId: "deduction:generation-task:charged-task" });

    await expect(cancelGenerationTaskForUser(db, USER_ID, "charged-task")).rejects.toThrow(
      "任务已开始或已扣费，无法取消",
    );
    expect(taskRow(db)).toMatchObject({ status: "queued", deduction_ledger_id: "deduction:generation-task:charged-task" });
  });

  test("does not disclose or cancel another user's task", async () => {
    const { db } = setup();
    addTask(db, { id: "other-user-task", userId: "other-user" });

    await expect(cancelGenerationTaskForUser(db, USER_ID, "other-user-task")).rejects.toThrow(
      "任务不存在或无权操作",
    );
    expect(taskRow(db).status).toBe("queued");
  });

  test("does not return canceled for a nonexistent task", async () => {
    const { db } = setup();

    await expect(cancelGenerationTaskForUser(db, USER_ID, "missing-task")).rejects.toThrow(
      "任务不存在或无权操作",
    );
  });

  test("does not return canceled when the conditional update affects zero rows", async () => {
    const { db } = setup();
    addTask(db, { id: "raced-task" });
    db.returnZeroChangesNextStatementMatching = /SET status = 'canceled'/;

    await expect(cancelGenerationTaskForUser(db, USER_ID, "raced-task")).rejects.toThrow(
      "任务状态已变化，请重试",
    );
    expect(taskRow(db).status).toBe("queued");
  });
});

describe("admin model configuration", () => {
  test("updates submitted model fields without changing model_key or unsubmitted fields", async () => {
    const { db } = setup();
    await updateModelConfiguration(db, {
      id: "model-1",
      model_key: "forged-model-key",
      display_name: "Updated Model",
      provider: "vibelearning",
      provider_model: "gpt-image-2",
      cost_credits: 12,
      is_enabled: 0,
      sort_order: 9,
      supported_modes: ["text_to_image"],
      max_reference_images: 2,
    });
    const row = db.database.query(
      `SELECT model_key, display_name, provider, provider_model, cost_credits, is_enabled,
              sort_order, supported_modes, max_reference_images
       FROM models_config WHERE id = 'model-1'`,
    ).get() as Record<string, unknown>;

    expect(row).toMatchObject({
      model_key: "test-model",
      display_name: "Updated Model",
      provider: "vibelearning",
      provider_model: "gpt-image-2",
      cost_credits: 12,
      is_enabled: 0,
      sort_order: 9,
      supported_modes: '["text_to_image"]',
      max_reference_images: 2,
    });
  });

  test("rejects API key fields from model updates", async () => {
    const { db } = setup();
    await expect(updateModelConfiguration(db, {
      id: "model-1",
      display_name: "No Secret",
      apiKey: "test-only-secret",
    })).rejects.toThrow("不接受 API Key");
    const row = db.database.query("SELECT display_name FROM models_config WHERE id = 'model-1'").get() as { display_name: string };
    expect(row.display_name).toBe("Test Model");
  });

  test("returns provider configuration statuses without exposing API key values", async () => {
    const secret = "test-only-provider-secret";
    const statuses = await getProviderConfigurationStatuses(undefined, {
      VIBELEARNING_IMAGE_API_KEY: secret,
      VIBELEARNING_IMAGE_API_BASE_URL: "https://provider.example/v1/",
      MUMO_ENABLE_REAL_IMAGE_PROVIDERS: "true",
    });
    const serialized = JSON.stringify(statuses);

    expect(statuses).toEqual([{
      provider: "vibelearning",
      displayName: "VibeLearning Image",
      baseUrl: "https://provider.example/v1",
      baseUrlConfigured: true,
      apiKeyConfigured: true,
      enabled: true,
    }]);
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("VIBELEARNING_IMAGE_API_KEY");
  });

  test("keeps model update entry point behind withAdmin", async () => {
    const source = await Bun.file("src/lib/admin.server.ts").text();
    expect(source).toContain("export const adminUpdateModel = serverFn(async (data) => withAdmin");
  });
});

describe("provider registry", () => {
  test("selects mock and simulates asynchronous processing", async () => {
    const provider = createDefaultProviderRegistry().get("mock");
    expect(provider).toBeInstanceOf(MockImageProvider);
    const created = await provider.createTask({
      model: "mock-image",
      prompt: "fixture",
      aspectRatio: "1:1",
      quality: "1K",
      referenceImages: [],
      count: 1,
    });
    expect((await provider.getTask(created)).status).toBe("processing");
    expect((await provider.getTask(created)).status).toBe("completed");
  });

  test("does not instantiate VibeLearning unless real providers are enabled", () => {
    let vibeFactoryCalls = 0;
    const registry = createDefaultProviderRegistry({
      vibelearningFactory: () => {
        vibeFactoryCalls += 1;
        return new PipelineProvider();
      },
    });
    expect(() => registry.get("vibelearning")).toThrow(ProviderRegistryError);
    expect(vibeFactoryCalls).toBe(0);
  });

  test("routes only the configured PRO model through VibeLearning with its configured provider model", async () => {
    const { db, provider, dependencies } = setup();
    dependencies.providerRegistry = createDefaultProviderRegistry({
      allowRealProviders: true,
      mockProvider: provider,
      vibelearningFactory: () => provider,
    });

    const task = await createGenerationTaskForUser(
      USER_ID,
      {
        ...input({ modelKey: "gpt-image-2-pro", idempotencyKey: "pro-model" }),
        provider: "mock",
        providerModel: "forged-model",
        costCredits: 0,
      },
      dependencies,
    );
    const pro = db.database.query(
      "SELECT provider, provider_model FROM models_config WHERE model_key = 'gpt-image-2-pro'",
    ).get() as { provider: string; provider_model: string };
    const vip = db.database.query(
      "SELECT provider, provider_model FROM models_config WHERE model_key = 'gpt-image-2-vip'",
    ).get() as { provider: string; provider_model: string };

    expect(task.modelId).toBe("gpt-image-2-pro");
    expect(pro).toEqual({ provider: "vibelearning", provider_model: "gpt-image-2" });
    expect(provider.createCalls[0].model).toBe("gpt-image-2");
    expect(task.costCredits).toBe(7);
    expect(vip).toEqual({ provider: "mock", provider_model: "vip-provider-model" });
  });

  test("routes the supported PRO ratio and quality combinations through the configured provider", async () => {
    const { db, provider, dependencies } = setup();
    db.database.query("UPDATE user_credits SET balance = 100 WHERE user_id = ?").run(USER_ID);
    dependencies.providerRegistry = createDefaultProviderRegistry({
      allowRealProviders: true,
      mockProvider: provider,
      vibelearningFactory: () => provider,
    });

    const cases = [
      ["4:3", "1K"],
      ["16:9", "2K"],
      ["9:16", "4K"],
    ] as const;
    for (const [index, [aspectRatio, quality]] of cases.entries()) {
      await createGenerationTaskForUser(
        USER_ID,
        {
          ...input({
            modelKey: "gpt-image-2-pro",
            idempotencyKey: `pro-size-${index}`,
            parameters: { aspectRatio, quality },
          }),
          provider: "mock",
          providerModel: "forged-model",
          costCredits: 0,
        },
        dependencies,
      );
    }

    expect(provider.createCalls.map(({ model, aspectRatio, quality }) => ({ model, aspectRatio, quality }))).toEqual([
      { model: "gpt-image-2", aspectRatio: "4:3", quality: "1K" },
      { model: "gpt-image-2", aspectRatio: "16:9", quality: "2K" },
      { model: "gpt-image-2", aspectRatio: "9:16", quality: "4K" },
    ]);
    expect(balance(db)).toBe(79);
  });

  test("does not fetch or create a PRO task while real providers are disabled", async () => {
    const { provider, dependencies } = setup();
    let fetched = 0;
    dependencies.fetchImpl = (async () => {
      fetched += 1;
      throw new Error("unexpected fetch");
    }) as typeof fetch;

    await expect(
      createGenerationTaskForUser(
        USER_ID,
        input({ modelKey: "gpt-image-2-pro", idempotencyKey: "pro-disabled" }),
        dependencies,
      ),
    ).rejects.toMatchObject({ code: "REAL_PROVIDER_DISABLED" });
    expect(provider.createCalls).toHaveLength(0);
    expect(fetched).toBe(0);
  });

  test("rejects unknown provider keys", () => {
    expect(() => createDefaultProviderRegistry().get("missing-provider")).toThrow(
      "模型供应商配置无效",
    );
  });
});

describe("generation pipeline", () => {
  test("creates a text-to-image task with authoritative pricing", async () => {
    const { db, provider, dependencies } = setup();
    const tampered = { ...input(), costCredits: 999 } as GenerationCreateInput & {
      costCredits: number;
    };
    const task = await createGenerationTaskForUser(USER_ID, tampered, dependencies);
    expect(task.status).toBe("running");
    expect(task.generationMode).toBe("text_to_image");
    expect(task.costCredits).toBe(7);
    expect(balance(db)).toBe(13);
    expect(provider.createCalls[0].model).toBe("mock-image");
    expect(provider.createCalls[0].referenceImages).toHaveLength(0);
  });

  test("creates image-to-image tasks, preserves order, and consumes references", async () => {
    const { db, bucket, provider, dependencies } = setup();
    addAsset(db, bucket);
    const task = await createGenerationTaskForUser(
      USER_ID,
      input({ referenceImageIds: ["asset-1"] }),
      dependencies,
    );
    expect(task.generationMode).toBe("image_to_image");
    expect(provider.createCalls[0].referenceImages).toHaveLength(1);
    const asset = db.database.query("SELECT status FROM uploaded_images").get() as {
      status: string;
    };
    expect(asset.status).toBe("consumed");
    const link = db.database.query("SELECT sort_order FROM generation_task_input_images").get() as {
      sort_order: number;
    };
    expect(link.sort_order).toBe(0);
  });

  test("rejects references owned by another user", async () => {
    const { db, bucket, dependencies } = setup();
    addAsset(db, bucket, { userId: "other-user" });
    await expect(
      createGenerationTaskForUser(USER_ID, input({ referenceImageIds: ["asset-1"] }), dependencies),
    ).rejects.toMatchObject({ code: "REFERENCE_IMAGE_FORBIDDEN" });
  });

  test("rejects expired and deleted references", async () => {
    const expired = setup();
    addAsset(expired.db, expired.bucket, { expiresAt: "2026-07-13T12:00:00.000Z" });
    await expect(
      createGenerationTaskForUser(
        USER_ID,
        input({ referenceImageIds: ["asset-1"] }),
        expired.dependencies,
      ),
    ).rejects.toMatchObject({ code: "REFERENCE_IMAGE_UNAVAILABLE" });

    const deleted = setup();
    addAsset(deleted.db, deleted.bucket, { status: "deleted" });
    await expect(
      createGenerationTaskForUser(
        USER_ID,
        input({ referenceImageIds: ["asset-1"] }),
        deleted.dependencies,
      ),
    ).rejects.toMatchObject({ code: "REFERENCE_IMAGE_UNAVAILABLE" });
  });

  test("does not create a task when balance is insufficient", async () => {
    const { db, provider, dependencies } = setup();
    db.database.query("UPDATE user_credits SET balance = 6").run();
    await expect(createGenerationTaskForUser(USER_ID, input(), dependencies)).rejects.toThrow(
      "创作点不足",
    );
    expect(count(db, "generation_tasks")).toBe(0);
    expect(balance(db)).toBe(6);
    expect(count(db, "credit_ledger")).toBe(0);
    expect(provider.createCalls).toHaveLength(0);
  });

  test("does not charge, write a ledger, or call a provider when a task is no longer queued", async () => {
    const { db, provider } = setup();
    db.database
      .query(
        `INSERT INTO generation_tasks (id, user_id, model_key, task_type, prompt, status, cost_credits)
         VALUES ('already-running', ?, 'test-model', 'image', 'existing', 'running', 7)`,
      )
      .run(USER_ID);

    await expect(
      chargeGenerationTask(db, { userId: USER_ID, taskId: "already-running", amount: 7 }),
    ).rejects.toMatchObject({ name: "GenerationCreditRecoveryError" });
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(0);
    expect(taskRow(db)).toMatchObject({ deduction_ledger_id: null });
    expect(provider.createCalls).toHaveLength(0);
  });

  test("rolls back a success false deduction result before a provider can run", async () => {
    const { db, provider } = setup();
    db.database
      .query(
        `INSERT INTO generation_tasks (id, user_id, model_key, task_type, prompt, status, cost_credits)
         VALUES ('success-false-deduction', ?, 'test-model', 'image', 'pending', 'queued', 7)`,
      )
      .run(USER_ID);
    db.returnSuccessFalseNextStatementMatching = /SET deduction_ledger_id/;

    await expect(
      chargeGenerationTask(db, { userId: USER_ID, taskId: "success-false-deduction", amount: 7 }),
    ).rejects.toThrow("injected D1 unsuccessful result");
    expect(provider.createCalls).toHaveLength(0);
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(0);
    expect(taskRow(db)).toMatchObject({ deduction_ledger_id: null });
  });

  test("rolls back a success false refund result without increasing balance", async () => {
    const { db } = setup();
    db.database.query("UPDATE user_credits SET balance = 13, total_used = 7").run();
    db.database
      .query(
        `INSERT INTO generation_tasks
         (id, user_id, model_key, task_type, prompt, status, cost_credits, deduction_ledger_id)
         VALUES ('success-false-refund', ?, 'test-model', 'image', 'failed', 'failed', 7,
                 'deduction:generation-task:success-false-refund')`,
      )
      .run(USER_ID);
    db.returnSuccessFalseNextStatementMatching = /SET refund_ledger_id/;

    await expect(
      refundGenerationTask(db, { userId: USER_ID, taskId: "success-false-refund", amount: 7 }),
    ).rejects.toThrow("injected D1 unsuccessful result");
    expect(balance(db)).toBe(13);
    expect(count(db, "credit_ledger")).toBe(0);
    expect(taskRow(db)).toMatchObject({ refund_ledger_id: null });
  });

  test("same idempotency key and concurrent calls deduct only once", async () => {
    const { db, provider, dependencies } = setup();
    const [first, second] = await Promise.all([
      createGenerationTaskForUser(USER_ID, input(), dependencies),
      createGenerationTaskForUser(USER_ID, input(), dependencies),
    ]);
    expect(first.taskId).toBe(second.taskId);
    expect(balance(db)).toBe(13);
    expect(count(db, "credit_ledger")).toBe(1);
    expect(count(db, "generation_tasks")).toBe(1);
    expect(provider.createCalls).toHaveLength(1);
  });

  test("rolls back the deduction when its ledger insert fails", async () => {
    const { db, dependencies } = setup();
    db.failNextStatementMatching = /INSERT INTO credit_ledger/;

    await expect(createGenerationTaskForUser(USER_ID, input(), dependencies)).rejects.toThrow(
      "injected D1 statement failure",
    );
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(0);
    expect(count(db, "generation_tasks")).toBe(0);
  });

  test("rolls back the deduction when task ledger association fails", async () => {
    const { db, dependencies } = setup();
    db.failNextStatementMatching = /SET deduction_ledger_id/;

    await expect(createGenerationTaskForUser(USER_ID, input(), dependencies)).rejects.toThrow(
      "injected D1 statement failure",
    );
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(0);
    expect(count(db, "generation_tasks")).toBe(0);
  });

  test("provider create failure refunds exactly once", async () => {
    const { db, provider, dependencies } = setup();
    provider.createError = new Error("mock provider create failed");
    const task = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    expect(task.status).toBe("failed");
    expect(task.deductionStatus).toBe("refunded");
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(2);
  });

  test("provider polling failure refunds once across repeated polls", async () => {
    const { db, provider, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    provider.pollError = new Error("mock poll failed");
    const first = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    const second = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(first.status).toBe("failed");
    expect(second.status).toBe("failed");
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(2);
  });

  test("retries a refund after the refund ledger write fails", async () => {
    const { db, provider, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    provider.pollResult = { taskId: "provider-task", status: "failed", images: [] };
    db.failNextStatementMatching = /generation_refund/;

    await expect(pollGenerationTaskForUser(USER_ID, created.taskId, dependencies)).rejects.toThrow(
      "injected D1 statement failure",
    );
    expect(balance(db)).toBe(13);
    expect(count(db, "credit_ledger")).toBe(1);
    expect(taskRow(db)).toMatchObject({ status: "failed", refund_ledger_id: null });

    const retried = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(retried.deductionStatus).toBe("refunded");
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(2);
  });

  test("retries a refund after the balance update fails", async () => {
    const { db, provider, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    provider.pollResult = { taskId: "provider-task", status: "failed", images: [] };
    db.failNextStatementMatching = /SET balance = balance \+/;

    await expect(pollGenerationTaskForUser(USER_ID, created.taskId, dependencies)).rejects.toThrow(
      "injected D1 statement failure",
    );
    expect(balance(db)).toBe(13);
    expect(taskRow(db)).toMatchObject({ status: "failed", refund_ledger_id: null });

    await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(2);
  });

  test("refunds a provider final failed result exactly once", async () => {
    const { db, provider, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    provider.pollResult = { taskId: "provider-task", status: "failed", images: [] };

    const first = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    const second = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(first.deductionStatus).toBe("refunded");
    expect(second.deductionStatus).toBe("refunded");
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(2);
  });

  test("serializes concurrent refund retries so the balance increases once", async () => {
    const { db, provider, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    provider.pollResult = { taskId: "provider-task", status: "failed", images: [] };
    db.failNextStatementMatching = /generation_refund/;

    await expect(pollGenerationTaskForUser(USER_ID, created.taskId, dependencies)).rejects.toThrow(
      "injected D1 statement failure",
    );
    await expect(
      Promise.all([
        pollGenerationTaskForUser(USER_ID, created.taskId, dependencies),
        pollGenerationTaskForUser(USER_ID, created.taskId, dependencies),
      ]),
    ).resolves.toHaveLength(2);
    const refundCount = db.database.query(
      "SELECT COUNT(*) AS value FROM credit_ledger WHERE reason = 'generation_refund'",
    ).get() as { value: number };
    expect(balance(db)).toBe(20);
    expect(refundCount.value).toBe(1);
    expect(taskRow(db).refund_ledger_id).toBe("refund:generation-task:id-1");

    await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(balance(db)).toBe(20);
    const refundCountAfterRetry = db.database.query(
      "SELECT COUNT(*) AS value FROM credit_ledger WHERE reason = 'generation_refund'",
    ).get() as { value: number };
    expect(refundCountAfterRetry.value).toBe(1);
  });

  test("refunds a timed out task", async () => {
    const { db, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    dependencies.now = () => new Date(NOW.getTime() + 16 * 60 * 1000);

    const result = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(result.status).toBe("failed");
    expect(result.deductionStatus).toBe("refunded");
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(2);
  });

  test("keeps a delayed provider result running, then archives its URL without refunding", async () => {
    const { db, bucket, provider, dependencies } = setup();
    provider.pollResults = [
      { taskId: "provider-task", status: "processing", images: [] },
      {
        taskId: "provider-task",
        status: "completed",
        images: [{ kind: "url", url: "https://fixture.example/delayed.webp" }],
      },
    ];
    dependencies.fetchImpl = (async () => new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/webp" },
    })) as typeof fetch;
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);

    const waiting = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(waiting.status).toBe("running");
    expect(taskRow(db)).toMatchObject({ status: "running", refund_ledger_id: null });
    expect(count(db, "generation_history")).toBe(0);
    expect(bucket.objects.size).toBe(0);
    const providerTask = db.database.query(
      "SELECT provider_task_id FROM generation_tasks WHERE id = ?",
    ).get(created.taskId) as { provider_task_id: string };
    expect(providerTask.provider_task_id).toBe("provider-task");

    const completed = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(completed.status).toBe("succeeded");
    expect(taskRow(db)).toMatchObject({ status: "succeeded", refund_ledger_id: null });
    expect(count(db, "generation_history")).toBe(1);
    expect(bucket.objects.size).toBe(1);
    expect(balance(db)).toBe(13);
  });

  test("archives a delayed provider base64 result without refunding", async () => {
    const { db, bucket, provider, dependencies } = setup();
    provider.pollResults = [
      { taskId: "provider-task", status: "processing", images: [] },
      {
        taskId: "provider-task",
        status: "completed",
        images: [{ kind: "base64", bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]), mimeType: "image/png" }],
      },
    ];
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);

    expect((await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies)).status).toBe("running");
    expect(provider.createCalls).toHaveLength(1);
    expect(taskRow(db)).toMatchObject({ status: "running", refund_ledger_id: null });
    expect(count(db, "credit_ledger")).toBe(1);
    expect(balance(db)).toBe(13);
    expect(bucket.objects.size).toBe(0);

    expect((await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies)).status).toBe("succeeded");
    expect(taskRow(db)).toMatchObject({ status: "succeeded", refund_ledger_id: null });
    expect(count(db, "generation_history")).toBe(1);
    expect(bucket.objects.size).toBe(1);
    expect(count(db, "credit_ledger")).toBe(1);
    expect(balance(db)).toBe(13);
    await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(provider.createCalls).toHaveLength(1);
    expect(count(db, "generation_history")).toBe(1);
    expect(bucket.objects.size).toBe(1);
  });

  test("refunds a delayed provider result once after the existing task timeout", async () => {
    const { db, provider, dependencies } = setup();
    provider.pollResult = { taskId: "provider-task", status: "processing", images: [] };
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);

    expect((await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies)).status).toBe("running");
    dependencies.now = () => new Date(NOW.getTime() + 16 * 60 * 1000);
    expect((await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies)).deductionStatus).toBe("refunded");
    await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(taskRow(db)).toMatchObject({ status: "failed", refund_ledger_id: expect.any(String) });
    expect(balance(db)).toBe(20);
    expect(count(db, "credit_ledger")).toBe(2);
  });

  test("successful repeated polling writes history once and archives base64", async () => {
    const { db, bucket, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    const first = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    const second = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(first.status).toBe("succeeded");
    expect(second.status).toBe("succeeded");
    expect(count(db, "generation_history")).toBe(1);
    expect([...bucket.objects.keys()].some((key) => key.startsWith("generated/user-1/"))).toBe(
      true,
    );
  });

  test("downloads URL results through controlled fetch before R2 archive", async () => {
    const { db, bucket, provider, dependencies } = setup();
    provider.pollResult = {
      taskId: "provider-task",
      status: "completed",
      images: [{ kind: "url", url: "https://fixture.example/result.webp" }],
    };
    let fetched = 0;
    dependencies.fetchImpl = (async () => {
      fetched += 1;
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/webp" },
      });
    }) as typeof fetch;
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    const result = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(result.status).toBe("succeeded");
    expect(fetched).toBe(1);
    expect([...bucket.objects.keys()].some((key) => key.endsWith(".webp"))).toBe(true);
    expect(count(db, "generation_history")).toBe(1);
  });

  test("R2 archive failure prevents success and refunds", async () => {
    const { db, bucket, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    bucket.failPut = true;
    const result = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(result.status).toBe("failed");
    expect(balance(db)).toBe(20);
    expect(count(db, "generation_history")).toBe(0);
    await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(count(db, "credit_ledger")).toBe(2);
  });

  test("history write failure never marks the task successful and refunds once", async () => {
    const { db, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);
    db.failNextStatementMatching = /INSERT OR IGNORE INTO generation_history/;

    const result = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(result.status).toBe("failed");
    expect(result.deductionStatus).toBe("refunded");
    expect(count(db, "generation_history")).toBe(0);
    expect(balance(db)).toBe(20);
    await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(count(db, "credit_ledger")).toBe(2);
  });

  test("successful tasks never receive a refund", async () => {
    const { db, dependencies } = setup();
    const created = await createGenerationTaskForUser(USER_ID, input(), dependencies);

    await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(taskRow(db)).toMatchObject({ status: "succeeded", refund_ledger_id: null });
    expect(balance(db)).toBe(13);
    expect(count(db, "credit_ledger")).toBe(1);
  });

  test("default local provider is mock and does not call fetch or require an API key", async () => {
    const { db, bucket } = setup();
    let fetched = 0;
    const dependencies: GenerationPipelineDependencies = {
      db,
      bucket,
      now: () => NOW,
      fetchImpl: (async () => {
        fetched += 1;
        throw new Error("unexpected fetch");
      }) as typeof fetch,
    };
    const created = await createGenerationTaskForUser(
      USER_ID,
      input({ idempotencyKey: "default-mock" }),
      dependencies,
    );
    const processing = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    const result = await pollGenerationTaskForUser(USER_ID, created.taskId, dependencies);
    expect(processing.status).toBe("running");
    expect(result.status).toBe("succeeded");
    expect(fetched).toBe(0);
    const clientSource = await Bun.file("src/components/studio/Studio.tsx").text();
    expect(clientSource).not.toContain("VIBELEARNING_IMAGE_API_KEY");
  });
});
