import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";

import type { D1Database, D1ExecResult, D1PreparedStatement, D1Result } from "../src/lib/d1";
import {
  decryptProviderSecret,
  encryptProviderSecret,
} from "../src/lib/provider-credentials-crypto.server";
import {
  clearProviderCredential,
  getProviderCredentialStatus,
  resolveProviderRuntimeCredential,
  upsertProviderCredential,
} from "../src/lib/provider-credentials.server";
import { getProviderConfigurationStatuses } from "../src/lib/providers/provider-configuration.server";

const TEST_MASTER_KEY = btoa("test-master-key-0000000000000000");
const TEST_PROVIDER_KEY = "test-provider-key";

class Statement implements D1PreparedStatement {
  private values: unknown[] = [];
  constructor(private readonly database: Database, private readonly sql: string) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  async first<T>() { return this.database.query(this.sql).get(...this.values) as T | null; }
  async all<T>(): Promise<D1Result<T>> { return { results: this.database.query(this.sql).all(...this.values) as T[], success: true, meta: { changes: 0 } }; }
  async run<T>(): Promise<D1Result<T>> { const result = this.database.query(this.sql).run(...this.values); return { results: [], success: true, meta: { changes: result.changes } }; }
  async raw<T>(): Promise<T[]> { return this.database.query(this.sql).values(...this.values) as T[]; }
}

class FakeD1 implements D1Database {
  readonly database = new Database(":memory:");
  constructor() {
    this.database.exec(`CREATE TABLE provider_credentials (
      provider TEXT PRIMARY KEY, base_url TEXT, api_key_ciphertext TEXT, api_key_iv TEXT,
      encryption_version INTEGER NOT NULL DEFAULT 1, is_enabled INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);
  }
  prepare(query: string) { return new Statement(this.database, query); }
  async batch<T>(statements: D1PreparedStatement[]) { return Promise.all(statements.map((statement) => statement.run<T>())); }
  async exec(): Promise<D1ExecResult> { return { count: 0, duration: 0 }; }
}

describe("provider credential encryption", () => {
  test("encrypts with unique IVs and decrypts with the same provider", async () => {
    const first = await encryptProviderSecret(TEST_MASTER_KEY, "vibelearning", TEST_PROVIDER_KEY);
    const second = await encryptProviderSecret(TEST_MASTER_KEY, "vibelearning", TEST_PROVIDER_KEY);
    expect(first.ciphertext).not.toContain(TEST_PROVIDER_KEY);
    expect(second.ciphertext).not.toBe(first.ciphertext);
    expect(second.iv).not.toBe(first.iv);
    await expect(decryptProviderSecret(TEST_MASTER_KEY, "vibelearning", first)).resolves.toBe(TEST_PROVIDER_KEY);
  });

  test("rejects tampering, wrong provider binding, and invalid master keys", async () => {
    const encrypted = await encryptProviderSecret(TEST_MASTER_KEY, "vibelearning", TEST_PROVIDER_KEY);
    await expect(decryptProviderSecret(TEST_MASTER_KEY, "mock", encrypted)).rejects.toMatchObject({ code: "PROVIDER_CREDENTIAL_DECRYPTION_FAILED" });
    await expect(decryptProviderSecret(TEST_MASTER_KEY, "vibelearning", { ...encrypted, ciphertext: encrypted.ciphertext.slice(0, -2) + "AA" })).rejects.toMatchObject({ code: "PROVIDER_CREDENTIAL_DECRYPTION_FAILED" });
    await expect(decryptProviderSecret(TEST_MASTER_KEY, "vibelearning", { ...encrypted, iv: encrypted.iv.slice(0, -2) + "AA" })).rejects.toMatchObject({ code: "PROVIDER_CREDENTIAL_DECRYPTION_FAILED" });
    await expect(encryptProviderSecret(btoa("short"), "vibelearning", TEST_PROVIDER_KEY)).rejects.toMatchObject({ code: "PROVIDER_CREDENTIALS_MASTER_KEY_INVALID" });
  });
});

describe("provider credential storage", () => {
  test("stores only ciphertext and status responses omit secrets", async () => {
    const db = new FakeD1();
    const status = await upsertProviderCredential(db, { provider: "vibelearning", baseUrl: "https://provider.test/v1/", apiKey: TEST_PROVIDER_KEY, isEnabled: true }, "admin-1", { MUMO_PROVIDER_CREDENTIALS_MASTER_KEY_V1: TEST_MASTER_KEY });
    const stored = db.database.query("SELECT * FROM provider_credentials WHERE provider = 'vibelearning'").get() as Record<string, unknown>;
    expect(status).toMatchObject({ provider: "vibelearning", baseUrl: "https://provider.test/v1", apiKeyConfigured: true, isEnabled: true });
    expect(stored.api_key_ciphertext).not.toBe(TEST_PROVIDER_KEY);
    expect(stored.api_key_iv).toBeTruthy();
    expect(JSON.stringify(status)).not.toContain("ciphertext");
    expect(JSON.stringify(status)).not.toContain(TEST_PROVIDER_KEY);
  });

  test("keeps a key on empty input, clears only explicitly, and resolves database credentials first", async () => {
    const db = new FakeD1();
    await upsertProviderCredential(db, { provider: "vibelearning", apiKey: TEST_PROVIDER_KEY }, "admin-1", { MUMO_PROVIDER_CREDENTIALS_MASTER_KEY_V1: TEST_MASTER_KEY });
    await upsertProviderCredential(db, { provider: "vibelearning", apiKey: "", isEnabled: false }, "admin-2", { MUMO_PROVIDER_CREDENTIALS_MASTER_KEY_V1: TEST_MASTER_KEY });
    await expect(resolveProviderRuntimeCredential(db, "vibelearning", { MUMO_PROVIDER_CREDENTIALS_MASTER_KEY_V1: TEST_MASTER_KEY, VIBELEARNING_IMAGE_API_KEY: "test-environment-provider-key" })).rejects.toThrow("供应商凭证已禁用");
    await upsertProviderCredential(db, { provider: "vibelearning", isEnabled: true }, "admin-2", { MUMO_PROVIDER_CREDENTIALS_MASTER_KEY_V1: TEST_MASTER_KEY });
    await expect(resolveProviderRuntimeCredential(db, "vibelearning", { MUMO_PROVIDER_CREDENTIALS_MASTER_KEY_V1: TEST_MASTER_KEY, VIBELEARNING_IMAGE_API_KEY: "test-environment-provider-key" })).resolves.toMatchObject({ apiKey: TEST_PROVIDER_KEY });
    await clearProviderCredential(db, "vibelearning", "admin-2");
    await expect(getProviderCredentialStatus(db, "vibelearning")).resolves.toMatchObject({ apiKeyConfigured: false });
  });

  test("merges encrypted credential and environment secret status without decrypting", async () => {
    const d1Credential = new FakeD1();
    await upsertProviderCredential(d1Credential, { provider: "vibelearning", apiKey: TEST_PROVIDER_KEY, isEnabled: false }, "admin-1", { MUMO_PROVIDER_CREDENTIALS_MASTER_KEY_V1: TEST_MASTER_KEY });
    const d1Status = await getProviderConfigurationStatuses(d1Credential, { MUMO_ENABLE_REAL_IMAGE_PROVIDERS: "true" });
    const environmentStatus = await getProviderConfigurationStatuses(new FakeD1(), { VIBELEARNING_IMAGE_API_KEY: "test-environment-provider-key", MUMO_ENABLE_REAL_IMAGE_PROVIDERS: "true" });
    const emptyStatus = await getProviderConfigurationStatuses(new FakeD1(), { MUMO_ENABLE_REAL_IMAGE_PROVIDERS: "true" });

    expect(d1Status[0]).toMatchObject({ apiKeyConfigured: true, enabled: false });
    expect(environmentStatus[0]).toMatchObject({ apiKeyConfigured: true, enabled: true });
    expect(emptyStatus[0]).toMatchObject({ apiKeyConfigured: false, enabled: true });
    expect(JSON.stringify(d1Status[0])).not.toContain("ciphertext");
    expect(JSON.stringify(d1Status[0])).not.toContain('"apiKey":');
    expect(JSON.stringify(d1Status[0])).not.toContain("Authorization");
  });
});
