import "@tanstack/react-start/server-only";

import { getStartContext } from "@tanstack/start-storage-context";

import type { MumoCloudflareEnv, R2BucketLike } from "../env";
import {
  chargeGenerationTask,
  GenerationCreditRecoveryError,
  InsufficientCreditsError,
  refundGenerationTask,
} from "./credits.server";
import type { D1Database, D1Result } from "./d1";
import { getD1 } from "./d1";
import { GenerationPricingError, getGenerationQuote } from "./generation-pricing.server";
import type {
  ImageGenerationInput,
  ImageProvider,
  ImageQuality,
  NormalizedProviderImage,
  ProviderGenerationMode,
  ProviderReferenceImage,
} from "./providers/image-provider.server";
import {
  createDefaultProviderRegistry,
  type ImageProviderRegistry,
  ProviderRegistryError,
  validateProviderCapabilities,
} from "./providers/provider-registry.server";
import { VibeLearningImageProvider } from "./providers/vibelearning-image.server";

const MAX_REFERENCE_IMAGES = 5;
const TASK_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_PROVIDER_DOWNLOAD_BYTES = 25 * 1024 * 1024;
const CLOUDFLARE_ENV_GLOBAL_KEY = "__MUMO_CLOUDFLARE_ENV__";

export type GenerationCreateInput = {
  modelKey: string;
  prompt: string;
  referenceImageIds: string[];
  parameters: {
    aspectRatio: string;
    quality: ImageQuality;
  };
  idempotencyKey: string;
};

export type GenerationTaskView = {
  taskId: string;
  status: "queued" | "running" | "succeeded" | "failed" | "canceled";
  prompt: string;
  modelId: string;
  modelName: string;
  generationMode: "text_to_image" | "image_to_image";
  costCredits: number;
  inputParams: {
    aspectRatio: string;
    quality: ImageQuality;
    referenceImageIds: string[];
    costCredits: number;
  };
  resultImageUrl: string | null;
  errorMessage: string | null;
  deductionStatus: "pending" | "charged" | "refunded";
  deductionId: string | null;
  historyId: string | null;
};

export type GenerationPipelineDependencies = {
  db?: D1Database;
  bucket?: R2BucketLike;
  env?: MumoCloudflareEnv;
  provider?: ImageProvider;
  providerRegistry?: ImageProviderRegistry;
  fetchImpl?: typeof fetch;
  idFactory?: () => string;
  now?: () => Date;
};

type UploadedImageRow = {
  id: string;
  r2_key: string;
  original_filename: string | null;
  mime_type: "image/png" | "image/jpeg" | "image/webp";
  size_bytes: number | string;
  status: string;
  expires_at: string | null;
};

type GenerationTaskRow = {
  id: string;
  user_id: string;
  model_id: string | null;
  model_key: string;
  task_type: string;
  prompt: string | null;
  status: GenerationTaskView["status"];
  cost_credits: number | string;
  provider_task_id: string | null;
  provider: string | null;
  provider_model: string | null;
  result_image_url: string | null;
  result_image_r2_key: string | null;
  error_message: string | null;
  request_json: string | null;
  idempotency_key: string | null;
  deduction_ledger_id: string | null;
  refund_ledger_id: string | null;
  generation_mode: "text_to_image" | "image_to_image" | null;
  attempt_count: number | string;
  timeout_at: string | null;
};

export class GenerationPipelineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GenerationPipelineError";
    this.code = code;
  }
}

function asEnv(value: unknown): MumoCloudflareEnv {
  return value && typeof value === "object" ? (value as MumoCloudflareEnv) : {};
}

function getContextEnv(): MumoCloudflareEnv {
  const startContext = getStartContext({ throwIfNotFound: false });
  const context = startContext?.contextAfterGlobalMiddlewares as
    | { cloudflare?: { env?: unknown }; cloudflareEnv?: unknown }
    | undefined;
  return asEnv(context?.cloudflare?.env ?? context?.cloudflareEnv);
}

function getGlobalEnv(): MumoCloudflareEnv {
  const globalRecord = globalThis as typeof globalThis & {
    __MUMO_CLOUDFLARE_ENV__?: unknown;
    __env__?: unknown;
  };
  return asEnv(globalRecord[CLOUDFLARE_ENV_GLOBAL_KEY] ?? globalRecord.__env__);
}

function resolveEnv(explicit?: MumoCloudflareEnv): MumoCloudflareEnv {
  return { ...getGlobalEnv(), ...getContextEnv(), ...explicit };
}

function resolveDb(dependencies: GenerationPipelineDependencies): D1Database {
  return dependencies.db ?? getD1(dependencies.env);
}

function resolveBucket(dependencies: GenerationPipelineDependencies): R2BucketLike {
  const bucket = dependencies.bucket ?? resolveEnv(dependencies.env).MUMO_GENERATED_IMAGES;
  if (!bucket) throw new GenerationPipelineError("R2_UNAVAILABLE", "图片存储服务暂时不可用。");
  return bucket;
}

function resolveProviderRegistry(
  dependencies: GenerationPipelineDependencies,
): ImageProviderRegistry {
  if (dependencies.providerRegistry) return dependencies.providerRegistry;
  const env = resolveEnv(dependencies.env);
  return createDefaultProviderRegistry({
    allowRealProviders: env.MUMO_ENABLE_REAL_IMAGE_PROVIDERS === "true",
    mockProvider: dependencies.provider,
    vibelearningFactory: () => new VibeLearningImageProvider(),
  });
}

function getChanges(result: D1Result): number {
  const changes = result.meta?.changes;
  return typeof changes === "number" && Number.isInteger(changes) && changes >= 0 ? changes : 0;
}

function parseRequestJson(value: string | null): GenerationTaskView["inputParams"] {
  try {
    const parsed = JSON.parse(value ?? "{}") as {
      aspectRatio?: unknown;
      quality?: unknown;
      referenceImageIds?: unknown;
      costCredits?: unknown;
    };
    const quality =
      parsed.quality === "1K" || parsed.quality === "2K" || parsed.quality === "4K"
        ? parsed.quality
        : "1K";
    return {
      aspectRatio: typeof parsed.aspectRatio === "string" ? parsed.aspectRatio : "1:1",
      quality,
      referenceImageIds: Array.isArray(parsed.referenceImageIds)
        ? parsed.referenceImageIds.filter(
            (item): item is string => typeof item === "string" && !!item,
          )
        : [],
      costCredits: Number(parsed.costCredits ?? 0),
    };
  } catch {
    return { aspectRatio: "1:1", quality: "1K", referenceImageIds: [], costCredits: 0 };
  }
}

async function getHistoryId(db: D1Database, taskId: string): Promise<string | null> {
  const row = await db
    .prepare("SELECT id FROM generation_history WHERE task_id = ? LIMIT 1")
    .bind(taskId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

async function toTaskView(
  db: D1Database,
  task: GenerationTaskRow,
  modelName?: string,
): Promise<GenerationTaskView> {
  const inputParams = parseRequestJson(task.request_json);
  return {
    taskId: task.id,
    status: task.status,
    prompt: task.prompt ?? "",
    modelId: task.model_key,
    modelName: modelName ?? task.model_key,
    generationMode: task.generation_mode ?? "text_to_image",
    costCredits: Number(task.cost_credits),
    inputParams: { ...inputParams, costCredits: Number(task.cost_credits) },
    resultImageUrl: task.result_image_url,
    errorMessage: task.error_message,
    deductionStatus: task.refund_ledger_id
      ? "refunded"
      : task.deduction_ledger_id
        ? "charged"
        : "pending",
    deductionId: task.deduction_ledger_id,
    historyId: await getHistoryId(db, task.id),
  };
}

async function getTaskRow(
  db: D1Database,
  taskId: string,
  userId: string,
): Promise<GenerationTaskRow | null> {
  return db
    .prepare("SELECT * FROM generation_tasks WHERE id = ? AND user_id = ? LIMIT 1")
    .bind(taskId, userId)
    .first<GenerationTaskRow>();
}

async function getTaskByIdempotency(
  db: D1Database,
  userId: string,
  idempotencyKey: string,
): Promise<GenerationTaskRow | null> {
  return db
    .prepare("SELECT * FROM generation_tasks WHERE user_id = ? AND idempotency_key = ? LIMIT 1")
    .bind(userId, idempotencyKey)
    .first<GenerationTaskRow>();
}

async function loadReferenceAssets(
  db: D1Database,
  userId: string,
  ids: string[],
  now: Date,
): Promise<UploadedImageRow[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = await db
    .prepare(
      `SELECT id, r2_key, original_filename, mime_type, size_bytes, status, expires_at
       FROM uploaded_images
       WHERE user_id = ? AND id IN (${placeholders})`,
    )
    .bind(userId, ...ids)
    .all<UploadedImageRow>();
  const byId = new Map(rows.results.map((row) => [row.id, row]));
  return ids.map((id) => {
    const asset = byId.get(id);
    if (!asset) {
      throw new GenerationPipelineError("REFERENCE_IMAGE_FORBIDDEN", "参考图不存在或无权使用。");
    }
    const expired = asset.expires_at ? Date.parse(asset.expires_at) <= now.getTime() : false;
    if (asset.status !== "ready" || expired) {
      throw new GenerationPipelineError(
        "REFERENCE_IMAGE_UNAVAILABLE",
        "参考图已失效，请重新上传。",
      );
    }
    return asset;
  });
}

async function readReferenceImages(
  bucket: R2BucketLike,
  assets: UploadedImageRow[],
): Promise<ProviderReferenceImage[]> {
  if (assets.length === 0) return [];
  if (typeof bucket.get !== "function") {
    throw new GenerationPipelineError("R2_UNAVAILABLE", "参考图存储服务暂时不可用。");
  }
  return Promise.all(
    assets.map(async (asset) => {
      const object = await bucket.get!(asset.r2_key);
      if (!object) throw new GenerationPipelineError("REFERENCE_IMAGE_MISSING", "参考图读取失败。");
      return {
        bytes: new Uint8Array(await object.arrayBuffer()),
        filename: asset.original_filename ?? `${asset.id}.${asset.mime_type.split("/")[1]}`,
        mimeType: asset.mime_type,
      };
    }),
  );
}

async function consumeReferenceAssets(
  db: D1Database,
  taskId: string,
  userId: string,
  assets: UploadedImageRow[],
): Promise<void> {
  if (assets.length === 0) return;
  const statements = assets.flatMap((asset, index) => [
    db
      .prepare(
        `INSERT OR IGNORE INTO generation_task_input_images
         (task_id, uploaded_image_id, sort_order) VALUES (?, ?, ?)`,
      )
      .bind(taskId, asset.id, index),
    db
      .prepare(
        `UPDATE uploaded_images
         SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND status = 'ready'`,
      )
      .bind(asset.id, userId),
  ]);
  const results = await db.batch(statements);
  for (let index = 1; index < results.length; index += 2) {
    if (!results[index].success || getChanges(results[index]) !== 1) {
      throw new GenerationPipelineError("REFERENCE_IMAGE_CONFLICT", "参考图状态已变化，请重试。");
    }
  }
}

function safeErrorMessage(error: unknown): string {
  if (
    error instanceof InsufficientCreditsError ||
    error instanceof GenerationPipelineError ||
    error instanceof GenerationPricingError ||
    error instanceof ProviderRegistryError
  ) {
    return error.message;
  }
  return "图片生成失败，请稍后重试。";
}

async function failTaskAndRefund(
  db: D1Database,
  task: GenerationTaskRow,
  error: unknown,
  dependencies: GenerationPipelineDependencies,
): Promise<GenerationTaskView> {
  if (task.status === "succeeded") return toTaskView(db, task);
  const message = safeErrorMessage(error);
  await db
    .prepare(
      `UPDATE generation_tasks
       SET status = 'failed', error_code = ?, error_message = ?, last_error = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ? AND status != 'succeeded' AND refund_ledger_id IS NULL`,
    )
    .bind("GENERATION_FAILED", message, message, task.id, task.user_id)
    .run();

  const failedTask = (await getTaskRow(db, task.id, task.user_id)) ?? task;
  if (failedTask.deduction_ledger_id && !failedTask.refund_ledger_id) {
    await refundGenerationTask(db, {
      userId: task.user_id,
      taskId: task.id,
      amount: Number(task.cost_credits),
    });
  }

  return toTaskView(db, (await getTaskRow(db, task.id, task.user_id)) ?? task);
}

function imageExtension(mimeType: string): "png" | "jpg" | "webp" {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

async function downloadProviderImage(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new GenerationPipelineError("INVALID_PROVIDER_IMAGE", "供应商图片地址无效。");
  }
  const response = await fetchImpl(parsed, {
    method: "GET",
    redirect: "error",
    headers: { accept: "image/png,image/jpeg,image/webp" },
  });
  if (!response.ok)
    throw new GenerationPipelineError("PROVIDER_DOWNLOAD_FAILED", "结果图片下载失败。");
  const mimeType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() ?? "";
  if (mimeType !== "image/png" && mimeType !== "image/jpeg" && mimeType !== "image/webp") {
    throw new GenerationPipelineError("INVALID_PROVIDER_IMAGE", "供应商返回的图片格式无效。");
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_PROVIDER_DOWNLOAD_BYTES) {
    throw new GenerationPipelineError("INVALID_PROVIDER_IMAGE", "供应商返回的图片大小无效。");
  }
  return { bytes, mimeType };
}

async function archiveProviderImage(
  image: NormalizedProviderImage,
  task: GenerationTaskRow,
  dependencies: GenerationPipelineDependencies,
): Promise<{ r2Key: string; resultUrl: string }> {
  const source =
    image.kind === "base64"
      ? { bytes: image.bytes, mimeType: image.mimeType }
      : await downloadProviderImage(image.url, dependencies.fetchImpl ?? fetch);
  const extension = imageExtension(source.mimeType);
  const now = (dependencies.now ?? (() => new Date()))();
  const safeUserId = task.user_id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeTaskId = task.id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const key = `generated/${safeUserId}/${now.getUTCFullYear()}/${String(
    now.getUTCMonth() + 1,
  ).padStart(2, "0")}/${safeTaskId}.${extension}`;
  const bucket = resolveBucket(dependencies);
  await bucket.put(key, source.bytes, { httpMetadata: { contentType: source.mimeType } });
  return {
    r2Key: key,
    resultUrl: `/api/download-image?taskId=${encodeURIComponent(task.id)}`,
  };
}

export async function createGenerationTaskForUser(
  userId: string,
  rawInput: GenerationCreateInput,
  dependencies: GenerationPipelineDependencies = {},
): Promise<GenerationTaskView> {
  const db = resolveDb(dependencies);
  const now = (dependencies.now ?? (() => new Date()))();
  const idFactory = dependencies.idFactory ?? (() => crypto.randomUUID());
  const prompt = rawInput.prompt.trim();
  const modelKey = rawInput.modelKey.trim();
  const idempotencyKey = rawInput.idempotencyKey.trim();
  const referenceImageIds = [...new Set(rawInput.referenceImageIds.map((id) => id.trim()))];
  if (!prompt || prompt.length > 4000) {
    throw new GenerationPipelineError("INVALID_PROMPT", "请输入有效的画面描述。");
  }
  if (!modelKey || !idempotencyKey || idempotencyKey.length > 128) {
    throw new GenerationPipelineError("INVALID_REQUEST", "生成请求参数无效。");
  }
  if (referenceImageIds.length > MAX_REFERENCE_IMAGES) {
    throw new GenerationPipelineError("TOO_MANY_REFERENCE_IMAGES", "参考图最多 5 张。");
  }

  const existing = await getTaskByIdempotency(db, userId, idempotencyKey);
  if (existing) return toTaskView(db, existing);

  const mode = referenceImageIds.length === 0 ? "text_to_image" : "image_to_image";
  const model = await getGenerationQuote(db, {
    modelKey,
    mode,
    referenceImageCount: referenceImageIds.length,
  });
  const provider = await resolveProviderRegistry(dependencies).getRuntime(model.provider, {
    db,
    env: dependencies.env,
    fetchImpl: dependencies.fetchImpl,
  });
  validateProviderCapabilities(provider, {
    mode: mode === "image_to_image" ? "image-to-image" : "text-to-image",
    referenceImageCount: referenceImageIds.length,
    aspectRatio: rawInput.parameters.aspectRatio,
    quality: rawInput.parameters.quality,
  });
  const assets = await loadReferenceAssets(db, userId, referenceImageIds, now);
  const taskId = idFactory();
  const costCredits = model.costCredits;
  const requestJson = JSON.stringify({
    aspectRatio: rawInput.parameters.aspectRatio,
    quality: rawInput.parameters.quality,
    referenceImageIds,
    costCredits,
  });
  const reserved = await db
    .prepare(
      `INSERT OR IGNORE INTO generation_tasks (
         id, user_id, model_id, model_key, task_type, prompt, status, cost_credits,
         request_json, idempotency_key, provider, provider_model, generation_mode, timeout_at
       ) VALUES (?, ?, ?, ?, 'image', ?, 'queued', ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      taskId,
      userId,
      model.id,
      model.modelKey,
      prompt,
      costCredits,
      requestJson,
      idempotencyKey,
      model.provider,
      model.providerModel,
      mode,
      new Date(now.getTime() + TASK_TIMEOUT_MS).toISOString(),
    )
    .run();
  if (!reserved.success || getChanges(reserved) !== 1) {
    const concurrent = await getTaskByIdempotency(db, userId, idempotencyKey);
    if (concurrent) return toTaskView(db, concurrent, model.displayName);
    throw new GenerationPipelineError("TASK_CREATE_FAILED", "生成任务创建失败。");
  }

  try {
    const charge = await chargeGenerationTask(db, {
      userId,
      taskId,
      amount: costCredits,
    });
    if (!charge.charged) {
      return toTaskView(db, (await getTaskRow(db, taskId, userId))!);
    }
  } catch (error) {
    await db
      .prepare("DELETE FROM generation_tasks WHERE id = ? AND deduction_ledger_id IS NULL")
      .bind(taskId)
      .run();
    throw error;
  }

  let task = await getTaskRow(db, taskId, userId);
  if (!task) throw new GenerationPipelineError("TASK_CREATE_FAILED", "生成任务创建失败。");

  try {
    const bucket = assets.length ? resolveBucket(dependencies) : undefined;
    const referenceImages = bucket ? await readReferenceImages(bucket, assets) : [];
    await consumeReferenceAssets(db, taskId, userId, assets);
    const providerInput: ImageGenerationInput = {
      model: model.providerModel,
      prompt,
      aspectRatio: rawInput.parameters.aspectRatio,
      quality: rawInput.parameters.quality,
      referenceImages,
      count: 1,
    };
    const created = await provider.createTask(providerInput);
    await db
      .prepare(
        `UPDATE generation_tasks
         SET provider_task_id = ?, status = 'running', attempt_count = attempt_count + 1,
             started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND user_id = ? AND status = 'queued'`,
      )
      .bind(created.taskId, taskId, userId)
      .run();
  } catch (error) {
    task = (await getTaskRow(db, taskId, userId)) ?? task;
    return failTaskAndRefund(db, task, error, dependencies);
  }

  task = (await getTaskRow(db, taskId, userId)) ?? task;
  return toTaskView(db, task, model.displayName);
}

export async function pollGenerationTaskForUser(
  userId: string,
  taskId: string,
  dependencies: GenerationPipelineDependencies = {},
): Promise<GenerationTaskView> {
  const db = resolveDb(dependencies);
  let task = await getTaskRow(db, taskId, userId);
  if (!task) throw new GenerationPipelineError("TASK_NOT_FOUND", "生成任务不存在。");
  if (task.status === "succeeded" || task.status === "canceled") {
    return toTaskView(db, task);
  }
  if (task.status === "failed") {
    if (task.deduction_ledger_id && !task.refund_ledger_id) {
      return failTaskAndRefund(db, task, new GenerationCreditRecoveryError("生成任务退款待完成。"), dependencies);
    }
    return toTaskView(db, task);
  }
  if (!task.provider_task_id) {
    return failTaskAndRefund(
      db,
      task,
      new GenerationPipelineError("PROVIDER_TASK_MISSING", "生成任务启动失败。"),
      dependencies,
    );
  }
  const now = (dependencies.now ?? (() => new Date()))();
  if (task.timeout_at && Date.parse(task.timeout_at) <= now.getTime()) {
    return failTaskAndRefund(
      db,
      task,
      new GenerationPipelineError("GENERATION_TIMEOUT", "生成任务超时。"),
      dependencies,
    );
  }

  try {
    if (!task.provider) {
      throw new GenerationPipelineError("PROVIDER_MISSING", "任务供应商配置缺失。");
    }
    const provider = await resolveProviderRegistry(dependencies).getRuntime(task.provider, {
      db,
      env: dependencies.env,
      fetchImpl: dependencies.fetchImpl,
    });
    const providerMode: ProviderGenerationMode =
      task.generation_mode === "image_to_image" ? "image-to-image" : "text-to-image";
    const result = await provider.getTask({ taskId: task.provider_task_id, mode: providerMode });
    if (result.status === "queued" || result.status === "processing") {
      await db
        .prepare(
          `UPDATE generation_tasks SET attempt_count = attempt_count + 1,
           updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND status = 'running'`,
        )
        .bind(task.id, userId)
        .run();
      return toTaskView(db, (await getTaskRow(db, task.id, userId)) ?? task);
    }
    if (result.status === "failed") {
      return failTaskAndRefund(
        db,
        task,
        new GenerationPipelineError("PROVIDER_FAILED", result.error?.message ?? "图片生成失败。"),
        dependencies,
      );
    }
    const image = result.images[0];
    if (!image) throw new GenerationPipelineError("EMPTY_PROVIDER_RESULT", "生成结果为空。");
    const archived = await archiveProviderImage(image, task, dependencies);
    const historyId = (dependencies.idFactory ?? (() => crypto.randomUUID()))();
    await db
      .prepare(
        `INSERT OR IGNORE INTO generation_history (
           id, task_id, user_id, model_key, task_type, prompt, result_image_url,
           result_image_r2_key, cost_credits
         ) VALUES (?, ?, ?, ?, 'image', ?, ?, ?, ?)`,
      )
      .bind(
        historyId,
        task.id,
        userId,
        task.model_key,
        task.prompt,
        archived.resultUrl,
        archived.r2Key,
        Number(task.cost_credits),
      )
      .run();
    await db
      .prepare(
        `UPDATE generation_tasks
         SET status = 'succeeded', result_image_url = ?, result_image_r2_key = ?,
             completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP,
             error_code = NULL, error_message = NULL, last_error = NULL
         WHERE id = ? AND user_id = ? AND status = 'running'`,
      )
      .bind(archived.resultUrl, archived.r2Key, task.id, userId)
      .run();
  } catch (error) {
    task = (await getTaskRow(db, task.id, userId)) ?? task;
    return failTaskAndRefund(db, task, error, dependencies);
  }

  task = (await getTaskRow(db, task.id, userId)) ?? task;
  return toTaskView(db, task);
}

export async function listGenerationTasksForUser(
  userId: string,
  dependencies: GenerationPipelineDependencies = {},
): Promise<{ items: GenerationTaskView[] }> {
  const db = resolveDb(dependencies);
  const rows = await db
    .prepare("SELECT * FROM generation_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 20")
    .bind(userId)
    .all<GenerationTaskRow>();
  return { items: await Promise.all(rows.results.map((row) => toTaskView(db, row))) };
}

export async function listGenerationHistoryForUser(
  userId: string,
  input: { limit?: number; offset?: number },
  dependencies: GenerationPipelineDependencies = {},
) {
  const db = resolveDb(dependencies);
  const limit = Math.min(50, Math.max(1, Number(input.limit ?? 20)));
  const offset = Math.max(0, Number(input.offset ?? 0));
  const rows = await db
    .prepare(
      `SELECT h.id, h.task_id, h.model_key, h.prompt, h.result_image_url,
              h.cost_credits, h.created_at, t.request_json
       FROM generation_history h
       LEFT JOIN generation_tasks t ON t.id = h.task_id
       WHERE h.user_id = ? AND h.deleted_at IS NULL
       ORDER BY h.created_at DESC LIMIT ? OFFSET ?`,
    )
    .bind(userId, limit, offset)
    .all<{
      id: string;
      task_id: string | null;
      model_key: string;
      prompt: string | null;
      result_image_url: string;
      cost_credits: number;
      created_at: string;
      request_json: string | null;
    }>();
  const count = await db
    .prepare(
      "SELECT COUNT(*) AS value FROM generation_history WHERE user_id = ? AND deleted_at IS NULL",
    )
    .bind(userId)
    .first<{ value: number }>();
  return {
    items: rows.results.map((row) => ({
      id: row.id,
      model: row.model_key,
      modelKey: row.model_key,
      prompt: row.prompt,
      finalPrompt: row.prompt,
      styleName: null,
      aspectRatio: parseRequestJson(row.request_json).aspectRatio,
      createdAt: row.created_at,
      thumbnailUrl: row.result_image_url,
      originalImageUrl: row.result_image_url,
      generationTaskId: row.task_id,
      inputParams: parseRequestJson(row.request_json),
      cost: Number(row.cost_credits),
      image_url: row.result_image_url,
      created_at: row.created_at,
    })),
    total: Number(count?.value ?? 0),
    limit,
    offset,
    hasMore: offset + rows.results.length < Number(count?.value ?? 0),
  };
}

export async function getGeneratedImageForUser(
  userId: string,
  taskId: string,
  dependencies: GenerationPipelineDependencies = {},
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const db = resolveDb(dependencies);
  const task = await db
    .prepare(
      `SELECT result_image_r2_key FROM generation_tasks
       WHERE id = ? AND user_id = ? AND status = 'succeeded' LIMIT 1`,
    )
    .bind(taskId, userId)
    .first<{ result_image_r2_key: string | null }>();
  if (!task?.result_image_r2_key) {
    throw new GenerationPipelineError("RESULT_NOT_FOUND", "生成结果不存在。");
  }
  const bucket = resolveBucket(dependencies);
  if (typeof bucket.get !== "function") {
    throw new GenerationPipelineError("R2_UNAVAILABLE", "图片存储服务暂时不可用。");
  }
  const object = await bucket.get(task.result_image_r2_key);
  if (!object) throw new GenerationPipelineError("RESULT_NOT_FOUND", "生成结果不存在。");
  return {
    body: await object.arrayBuffer(),
    contentType: object.httpMetadata?.contentType ?? "image/png",
  };
}
