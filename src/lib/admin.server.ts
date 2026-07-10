import "@tanstack/react-start/server-only";
import { getRequest } from "@tanstack/react-start/server";
import { getSessionFromRequest, hashPassword, normalizeEmail, verifyPassword } from "@/lib/auth";
import { getD1, type D1Database } from "@/lib/d1";

type Input = Record<string, any>;
type AdminContext = { db: D1Database; userId: string; role: "owner" | "admin" };
type AdminRole = "owner" | "admin";

export function getD1ServerOnly(): D1Database {
  return getD1();
}

export function getSessionServerOnly() {
  return getSessionFromRequest(getRequest());
}

export function normalizeEmailServerOnly(email: string) {
  return normalizeEmail(email);
}

function serverFn<T>(handler: (data: Input) => Promise<T>, _method: "GET" | "POST" = "POST"): (data: Input) => Promise<T> {
  return handler;
}

function pendingServerFn(name: string, method: "GET" | "POST" = "POST"): any {
  return serverFn(async () => {
    throw new Error(`功能暂未开放（${name}）`);
  }, method);
}

function friendlyError(error: unknown): Error {
  const message = String((error as { message?: unknown })?.message ?? error ?? "");
  const normalized = message.toLowerCase();
  if (
    normalized.includes("mumo_db") ||
    normalized.includes("d1 binding") ||
    normalized.includes("no such table") ||
    normalized.includes("schema") && normalized.includes("table")
  ) return new Error("后台数据服务未配置");
  return error instanceof Error ? error : new Error(message || "操作失败");
}

async function withDb<T>(operation: (db: D1Database) => Promise<T>): Promise<T> {
  try {
    return await operation(await getD1ServerOnly());
  } catch (error) {
    throw friendlyError(error);
  }
}

async function withAdmin<T>(operation: (context: AdminContext) => Promise<T>, ownerOnly = false): Promise<T> {
  return withDb(async (db) => {
    const session = await getSessionServerOnly();
    if (!session) throw new Error("请先登录");
    const admin = await db.prepare("SELECT role FROM admin_users WHERE user_id = ? LIMIT 1")
      .bind(session.user.id)
      .first<{ role: "owner" | "admin" }>();
    if (!admin || ownerOnly && admin.role !== "owner") throw new Error("无权执行此操作");
    return operation({ db, userId: session.user.id, role: admin.role });
  });
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

async function getSetting<T>(db: D1Database, key: string, fallback: T): Promise<T> {
  const row = await db.prepare("SELECT value_json FROM system_settings WHERE key = ? LIMIT 1")
    .bind(key)
    .first<{ value_json: string }>();
  return parseJson(row?.value_json, fallback);
}

async function setSetting(db: D1Database, key: string, value: unknown, userId: string | null) {
  await db.prepare(
    `INSERT INTO system_settings (key, value_json, updated_at, updated_by)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`,
  ).bind(key, JSON.stringify(value), userId).run();
}

function boolInt(value: unknown, fallback = true) {
  return value === undefined ? (fallback ? 1 : 0) : value ? 1 : 0;
}

function makeId() { return crypto.randomUUID(); }

function parseAdminRole(value: unknown): AdminRole {
  const role = String(value ?? "admin").trim();
  if (role !== "owner" && role !== "admin") throw new Error("管理员角色无效");
  return role;
}

function getStringInput(data: Input, key: string): string {
  const direct = data[key];
  if (typeof direct === "string") return direct;
  const nested = data.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedValue = (nested as Input)[key];
    if (typeof nestedValue === "string") return nestedValue;
  }
  return "";
}

async function countOwners(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT COUNT(*) AS value FROM admin_users WHERE role = 'owner'")
    .first<{ value: number }>();
  return Number(row?.value ?? 0);
}

async function getAdminRoleByUserId(db: D1Database, userId: string): Promise<AdminRole | null> {
  const row = await db.prepare("SELECT role FROM admin_users WHERE user_id = ? LIMIT 1")
    .bind(userId)
    .first<{ role: AdminRole }>();
  return row?.role ?? null;
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCodeGroup(length = 4) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}
function makeRedeemCode() { return `MUMO-${randomCodeGroup()}-${randomCodeGroup()}`; }

export const checkIsAdmin = serverFn(async () => {
  try {
    const session = await getSessionServerOnly();
    if (!session) return { isAdmin: false, isFounder: false };
    return withDb(async (db) => {
      const row = await db.prepare("SELECT role FROM admin_users WHERE user_id = ? LIMIT 1")
        .bind(session.user.id)
        .first<{ role: string }>();
      return { isAdmin: !!row, isFounder: row?.role === "owner" };
    });
  } catch {
    return { isAdmin: false, isFounder: false };
  }
});

export const verifyAdminAccessPassword = serverFn(async (data) => {
  try {
    return await withAdmin(async ({ db, userId }) => {
      const submittedPassword = getStringInput(data, "password");
      if (!submittedPassword.trim()) throw new Error("invalid");

      const user = await db.prepare("SELECT password_hash FROM users WHERE id = ? AND status = 'active' LIMIT 1")
        .bind(userId)
        .first<{ password_hash: string }>();
      if (!user?.password_hash) throw new Error("invalid");
      if (!(await verifyPassword(submittedPassword, user.password_hash))) throw new Error("invalid");

      return { ok: true };
    });
  } catch {
    throw new Error("管理员验证失败");
  }
});

export const founderGetAccessPassword = serverFn(async () => withAdmin(async ({ db }) => {
  const row = await db.prepare("SELECT updated_at FROM system_settings WHERE key = ? LIMIT 1")
    .bind("admin_access_password")
    .first<{ updated_at: string }>();
  return { configured: !!row, updated_at: row?.updated_at ?? null };
}, true));

export const founderSetAccessPassword = serverFn(async () => withAdmin(async () => {
  throw new Error("后台入口已改为管理员账号密码验证");
}, true));

export const adminGetAnalytics = serverFn(async () => withAdmin(async ({ db }) => {
  const [todayUsers, totalUsers, todayCost, unusedCodes, registrations, models] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS value FROM users WHERE date(created_at) = date('now')").first<{ value: number }>(),
    db.prepare("SELECT COUNT(*) AS value FROM users").first<{ value: number }>(),
    db.prepare("SELECT COALESCE(SUM(ABS(amount)), 0) AS value FROM credit_ledger WHERE amount < 0 AND date(created_at) = date('now')").first<{ value: number }>(),
    db.prepare("SELECT COUNT(*) AS value FROM redeem_codes WHERE status = 'unused'").first<{ value: number }>(),
    db.prepare("SELECT id, email, COALESCE((SELECT balance FROM user_credits WHERE user_id = users.id), 0) AS credits, created_at FROM users WHERE date(created_at) = date('now') ORDER BY created_at DESC LIMIT 50").all(),
    db.prepare(`SELECT model_key AS model,
      SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) AS todayCount,
      COUNT(*) AS totalCount, COALESCE(SUM(cost_credits), 0) AS totalCost
      FROM generation_history WHERE deleted_at IS NULL GROUP BY model_key ORDER BY totalCount DESC`).all(),
  ]);
  return {
    metrics: {
      todayUsers: Number(todayUsers?.value ?? 0),
      todayCost: Number(todayCost?.value ?? 0),
      totalUsers: Number(totalUsers?.value ?? 0),
      unusedCoupons: Number(unusedCodes?.value ?? 0),
    },
    models: models.results ?? [],
    todayRegistrations: registrations.results ?? [],
    dayRange: { timezone: "UTC", startUtc: new Date().toISOString().slice(0, 10), endUtc: null },
  };
}));

export const adminListUsers = serverFn(async () => withAdmin(async ({ db }) => {
  const rows = await db.prepare(`SELECT u.id, u.email, u.display_name, u.created_at,
    COALESCE(c.balance, 0) AS credits, COALESCE(c.total_used, 0) AS total_spent,
    CASE WHEN u.status IN ('banned', 'disabled') THEN 1 ELSE 0 END AS is_banned
    FROM users u LEFT JOIN user_credits c ON c.user_id = u.id ORDER BY u.created_at DESC`).all();
  return rows.results ?? [];
}));

export const adminGetUserCreditUsageLogs = serverFn(async (data) => withAdmin(async ({ db }) => {
  const userId = String(data.userId ?? "");
  const limit = Math.min(100, Math.max(1, Number(data.limit ?? 50)));
  const offset = Math.max(0, Number(data.offset ?? 0));
  const [rows, count] = await Promise.all([
    db.prepare(`SELECT id, user_id, amount, reason AS source, NULL AS model_key, NULL AS model_name,
      CASE WHEN ref_type = 'generation_history' THEN ref_id END AS generation_history_id,
      CASE WHEN ref_type = 'generation_task' THEN ref_id END AS generation_task_id,
      NULL AS image_url, id AS idempotency_key, created_at, note AS metadata
      FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(userId, limit, offset).all(),
    db.prepare("SELECT COUNT(*) AS value FROM credit_ledger WHERE user_id = ?").bind(userId).first<{ value: number }>(),
  ]);
  return { items: rows.results ?? [], total: Number(count?.value ?? 0) };
}));

export const adminAdjustCredits = serverFn(async (data) => withAdmin(async ({ db, userId: adminId }) => {
  const userId = String(data.userId ?? "");
  const delta = Math.trunc(Number(data.delta ?? 0));
  if (!userId || !Number.isSafeInteger(delta) || delta === 0) throw new Error("积分调整值无效");
  await db.prepare("INSERT OR IGNORE INTO user_credits (user_id, balance, total_granted, total_used) VALUES (?, 0, 0, 0)").bind(userId).run();
  const current = await db.prepare("SELECT balance FROM user_credits WHERE user_id = ?").bind(userId).first<{ balance: number }>();
  const next = Number(current?.balance ?? 0) + delta;
  if (next < 0) throw new Error("用户创作点不足，无法扣减");
  const ledgerId = makeId();
  await db.batch([
    db.prepare(`UPDATE user_credits SET balance = ?,
      total_granted = total_granted + ?, total_used = total_used + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
      .bind(next, delta > 0 ? delta : 0, delta < 0 ? Math.abs(delta) : 0, userId),
    db.prepare(`INSERT INTO credit_ledger (id, user_id, amount, balance_after, reason, ref_type, note, created_by_admin_id)
      VALUES (?, ?, ?, ?, 'admin_adjustment', 'admin', ?, ?)`)
      .bind(ledgerId, userId, delta, next, String(data.note ?? "后台调整"), adminId),
  ]);
  return { credits: next };
}));

export const adminBanUser = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare("UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(data.banned ? "banned" : "active", String(data.userId ?? ""))
    .run();
  return { ok: true };
}));

export const adminDeleteUser = serverFn(async (data) => withAdmin(async ({ db }) => {
  const userId = String(data.userId ?? "");
  await db.batch([
    db.prepare("UPDATE users SET status = 'disabled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(userId),
    db.prepare("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL").bind(userId),
  ]);
  return { ok: true, softDeleted: true };
}));

export const adminResetPassword = serverFn(async () => ({ ok: false, message: "暂不支持在后台重置密码" }));

export const listActiveAds = serverFn(async () => withDb(async (db) => {
  const rows = await db.prepare("SELECT id, title, link_url, image_url, sort_order FROM ads WHERE is_enabled = 1 ORDER BY sort_order, created_at DESC").all();
  return rows.results ?? [];
}), "GET");

export const adminListAds = serverFn(async () => withAdmin(async ({ db }) => {
  const rows = await db.prepare("SELECT id, title, link_url, image_url, sort_order, is_enabled, is_enabled AS is_active, created_at, updated_at FROM ads ORDER BY sort_order, created_at DESC").all();
  return rows.results ?? [];
}));

export const adminUpsertAd = serverFn(async (data) => withAdmin(async ({ db }) => {
  const id = String(data.id ?? makeId());
  await db.prepare(`INSERT INTO ads (id, title, link_url, image_url, sort_order, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, link_url = excluded.link_url, image_url = excluded.image_url,
      sort_order = excluded.sort_order, is_enabled = excluded.is_enabled, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, String(data.title ?? "").trim(), data.link_url ?? null, data.image_url ?? null, Number(data.sort_order ?? 0), boolInt(data.is_enabled ?? data.is_active))
    .run();
  return { id };
}));

export const adminDeleteAd = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare("DELETE FROM ads WHERE id = ?").bind(String(data.id ?? "")).run(); return { ok: true };
}));

export const listAnnouncements = serverFn(async () => withDb(async (db) => {
  const rows = await db.prepare("SELECT id, title, content, sort_order, is_enabled, created_at, updated_at FROM announcements WHERE is_enabled = 1 ORDER BY sort_order, created_at DESC").all();
  return rows.results ?? [];
}), "GET");

export const adminListAnnouncements = serverFn(async () => withAdmin(async ({ db }) => {
  const rows = await db.prepare("SELECT id, title, content, sort_order, is_enabled, created_at, updated_at FROM announcements ORDER BY sort_order, created_at DESC").all();
  return rows.results ?? [];
}));

export const adminUpsertAnnouncement = serverFn(async (data) => withAdmin(async ({ db }) => {
  const id = String(data.id ?? makeId());
  await db.prepare(`INSERT INTO announcements (id, title, content, sort_order, is_enabled) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET title = excluded.title, content = excluded.content, sort_order = excluded.sort_order,
      is_enabled = excluded.is_enabled, updated_at = CURRENT_TIMESTAMP`)
    .bind(id, String(data.title ?? "").trim(), String(data.content ?? "").trim(), Number(data.sort_order ?? 0), boolInt(data.is_enabled ?? data.enabled))
    .run();
  return { id };
}));

export const adminDeleteAnnouncement = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare("DELETE FROM announcements WHERE id = ?").bind(String(data.id ?? "")).run(); return { ok: true };
}));

export const listVisibleRechargePackages = serverFn(async () => withDb(async (db) => {
  const rows = await db.prepare(`SELECT id, name, credits, price_text, badge, description, button_text,
    is_popular, is_highlighted, benefits_text, sort_order, buy_url
    FROM recharge_packages WHERE is_enabled = 1 ORDER BY sort_order, created_at`).all();
  return rows.results ?? [];
}), "GET");

export const listAdminRechargePackages = serverFn(async () => withAdmin(async ({ db }) => {
  const rows = await db.prepare(`SELECT id, name, credits, price_text, badge, description, button_text,
    is_popular, is_highlighted, benefits_text, sort_order, is_enabled, buy_url, created_at, updated_at
    FROM recharge_packages ORDER BY sort_order, created_at`).all();
  return rows.results ?? [];
}));

export const upsertAdminRechargePackage = serverFn(async (data) => withAdmin(async ({ db }) => {
  const id = String(data.id ?? makeId());
  await db.prepare(`INSERT INTO recharge_packages (
      id, name, credits, price_text, badge, description, button_text, is_popular,
      is_highlighted, benefits_text, sort_order, is_enabled, buy_url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, credits = excluded.credits, price_text = excluded.price_text,
      badge = excluded.badge, description = excluded.description, button_text = excluded.button_text,
      is_popular = excluded.is_popular, is_highlighted = excluded.is_highlighted,
      benefits_text = excluded.benefits_text, sort_order = excluded.sort_order,
      is_enabled = excluded.is_enabled, buy_url = excluded.buy_url, updated_at = CURRENT_TIMESTAMP`)
    .bind(
      id,
      String(data.name ?? data.title ?? "").trim(),
      Math.max(0, Number(data.credits ?? 0)),
      String(data.price_text ?? data.price ?? "").trim(),
      String(data.badge ?? data.badgeText ?? "").trim() || null,
      String(data.description ?? data.subtitle ?? "").trim() || null,
      String(data.button_text ?? data.buttonText ?? "前往购买").trim() || "前往购买",
      boolInt(data.is_popular ?? data.isPopular),
      boolInt(data.is_highlighted ?? data.isHighlighted),
      String(data.benefits_text ?? data.benefitsText ?? "").trim() || null,
      Number(data.sort_order ?? data.sortOrder ?? 0),
      boolInt(data.is_enabled ?? data.isVisible),
      String(data.buy_url ?? "").trim() || null,
    )
    .run();
  return { id };
}));

export const hideAdminRechargePackage = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare("UPDATE recharge_packages SET is_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(String(data.id ?? "")).run(); return { ok: true };
}));

export const deleteAdminRechargePackage = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare("DELETE FROM recharge_packages WHERE id = ?").bind(String(data.id ?? "")).run(); return { ok: true };
}));

export const adminListRedeemCodes = serverFn(async () => withAdmin(async ({ db }) => {
  const rows = await db.prepare("SELECT id, code, credits, status, used_by_user_id, used_by_label, used_at, created_at, updated_at, created_by_admin_id, note FROM redeem_codes ORDER BY created_at DESC").all();
  return rows.results ?? [];
}));

export const adminGenerateRedeemCodes = serverFn(async (data) => withAdmin(async ({ db, userId }) => {
  const count = Math.min(200, Math.max(1, Math.trunc(Number(data.count ?? 1))));
  const credits = Math.max(1, Math.trunc(Number(data.credits ?? data.amount ?? 1)));
  const created = Array.from({ length: count }, () => ({ id: makeId(), code: makeRedeemCode(), credits }));
  await db.batch(created.map((item) => db.prepare(
    "INSERT INTO redeem_codes (id, code, credits, status, created_by_admin_id, note) VALUES (?, ?, ?, 'unused', ?, ?)",
  ).bind(item.id, item.code, item.credits, userId, data.note ?? null)));
  return created;
}));

export const adminUpdateRedeemCodeStatus = serverFn(async (data) => withAdmin(async ({ db }) => {
  const status = String(data.status ?? "");
  if (status !== "unused" && status !== "disabled") throw new Error("兑换码状态无效");
  await db.prepare("UPDATE redeem_codes SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'used'")
    .bind(status, String(data.id ?? ""))
    .run();
  return { ok: true };
}));

export const adminDeleteRedeemCode = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare("DELETE FROM redeem_codes WHERE id = ?").bind(String(data.id ?? "")).run(); return { ok: true };
}));

export const adminClearDisabledRedeemCodes = serverFn(async () => withAdmin(async ({ db }) => {
  await db.prepare("DELETE FROM redeem_codes WHERE status = 'disabled'").run(); return { ok: true };
}));

export const redeemCode = serverFn(async (data) => withDb(async (db) => {
  const session = await getSessionServerOnly();
  if (!session) throw new Error("请先登录后再兑换");
  const code = String(data.code ?? "").trim().toUpperCase();
  if (!/^MUMO-[A-Z0-9]{4,8}(?:-[A-Z0-9]{4,8})+$/.test(code)) return { success: false, reason: "format", message: "兑换码格式不正确" };
  const item = await db.prepare("SELECT id, credits, status FROM redeem_codes WHERE code = ? LIMIT 1")
    .bind(code).first<{ id: string; credits: number; status: string }>();
  if (!item) return { success: false, reason: "missing", message: "兑换码不存在或已失效" };
  if (item.status === "used") return { success: false, reason: "used", message: "该兑换码已被使用" };
  if (item.status === "disabled") return { success: false, reason: "disabled", message: "该兑换码已失效" };
  const updated = await db.prepare(`UPDATE redeem_codes SET status = 'used', used_by_user_id = ?, used_by_label = ?,
    used_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'unused'`)
    .bind(session.user.id, session.user.email, item.id).run();
  if (Number(updated.meta?.changes ?? 0) < 1) return { success: false, reason: "used", message: "该兑换码已被使用" };
  await db.prepare("INSERT OR IGNORE INTO user_credits (user_id, balance, total_granted, total_used) VALUES (?, 0, 0, 0)").bind(session.user.id).run();
  const current = await db.prepare("SELECT balance FROM user_credits WHERE user_id = ?").bind(session.user.id).first<{ balance: number }>();
  const balance = Number(current?.balance ?? 0) + Number(item.credits ?? 0);
  await db.batch([
    db.prepare("UPDATE user_credits SET balance = ?, total_granted = total_granted + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .bind(balance, item.credits, session.user.id),
    db.prepare(`INSERT INTO credit_ledger (id, user_id, amount, balance_after, reason, ref_type, ref_id, note)
      VALUES (?, ?, ?, ?, 'redeem_code', 'redeem_code', ?, ?)`)
      .bind(makeId(), session.user.id, item.credits, balance, item.id, code),
  ]);
  return { success: true, credits: Number(item.credits), balance };
}));

export const redeemCoupon = redeemCode;

export const listModelsConfig = serverFn(async () => withDb(async (db) => {
  const rows = await db.prepare("SELECT * FROM models_config WHERE is_enabled = 1 ORDER BY sort_order, created_at").all(); return rows.results ?? [];
}), "GET");
export const adminListModelsConfig = serverFn(async () => withAdmin(async ({ db }) => {
  const rows = await db.prepare("SELECT * FROM models_config ORDER BY sort_order, created_at").all(); return rows.results ?? [];
}));
export const adminUpdateModelPrice = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare("UPDATE models_config SET cost_credits = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR model_key = ?")
    .bind(Math.max(0, Number(data.cost_credits ?? data.credits ?? 0)), String(data.id ?? ""), String(data.model_key ?? "")).run(); return { ok: true };
}));
export const adminUpdateModel = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare(`UPDATE models_config SET display_name = ?, provider = ?, provider_model = ?, task_type = ?, cost_credits = ?,
    is_enabled = ?, sort_order = ?, description = ?, input_schema_json = ?, extra_config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(data.display_name, data.provider, data.provider_model, data.task_type, Number(data.cost_credits ?? 0), boolInt(data.is_enabled), Number(data.sort_order ?? 0), data.description ?? null, data.input_schema_json ?? null, data.extra_config_json ?? null, String(data.id ?? "")).run(); return { ok: true };
}));
export const adminCreateModel = serverFn(async (data) => withAdmin(async ({ db }) => {
  const id = String(data.id ?? makeId());
  const key = String(data.model_key ?? "").trim();
  if (!key) throw new Error("模型标识不能为空");
  await db.prepare(`INSERT INTO models_config (id, model_key, display_name, provider, provider_model, task_type, cost_credits, is_enabled, sort_order, description, input_schema_json, extra_config_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, key, String(data.display_name ?? key), String(data.provider ?? "configured"), String(data.provider_model ?? key), String(data.task_type ?? "image"), Math.max(0, Number(data.cost_credits ?? 0)), boolInt(data.is_enabled), Number(data.sort_order ?? 0), data.description ?? null, data.input_schema_json ?? null, data.extra_config_json ?? null).run();
  return { id };
}));
export const adminDeleteModel = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare("DELETE FROM models_config WHERE id = ?").bind(String(data.id ?? "")).run(); return { ok: true };
}));

export const adminGetGlobalConfig = serverFn(async () => withAdmin(async ({ db }) => ({
  site: await getSetting(db, "site_brand", {}),
  contact: await getSetting(db, "contact_info", {}),
  purchase: await getSetting(db, "recharge_purchase_config", {}),
  redeem: await getSetting(db, "redeem_config", {}),
})));
export const getGlobalConfig = serverFn(async () => withDb(async (db) => ({
  site: await getSetting(db, "site_brand", { brandName: "沐莫AI", logoPath: "/mumo-logo.png", subtitle: "MUMO AI VISUAL STUDIO" }),
  contact: await getSetting(db, "contact_info", {}),
  purchase: await getSetting(db, "recharge_purchase_config", {}),
  redeem: await getSetting(db, "redeem_config", {}),
})), "GET");
export const adminUpdateGlobalConfig = serverFn(async (data) => withAdmin(async ({ db, userId }) => {
  if (data.site !== undefined) await setSetting(db, "site_brand", data.site, userId);
  if (data.contact !== undefined) await setSetting(db, "contact_info", data.contact, userId);
  if (data.purchase !== undefined) await setSetting(db, "recharge_purchase_config", data.purchase, userId);
  if (data.redeem !== undefined) await setSetting(db, "redeem_config", data.redeem, userId);
  if (data.key) await setSetting(db, String(data.key), data.value, userId);
  return { ok: true };
}));

export const getContactInfo = serverFn(async () => withDb((db) => getSetting(db, "contact_info", { description: "", wechat: "", email: "", serviceHours: "", enabled: false })), "GET");
export const adminGetContactInfo = serverFn(async () => withAdmin(async ({ db }) => getSetting(db, "contact_info", { description: "", wechat: "", email: "", serviceHours: "", enabled: false })));
export const adminSetContactInfo = serverFn(async (data) => withAdmin(async ({ db, userId }) => {
  await setSetting(db, "contact_info", data, userId); return { ok: true };
}));

export const listStyleTemplates = serverFn(async () => withDb(async (db) => {
  const rows = await db.prepare("SELECT id, name, category, prompt, preview_url, sort_order, is_enabled FROM style_templates WHERE is_enabled = 1 ORDER BY sort_order, created_at").all(); return rows.results ?? [];
}), "GET");
export const adminListStyleTemplates = serverFn(async () => withAdmin(async ({ db }) => {
  const rows = await db.prepare("SELECT * FROM style_templates ORDER BY sort_order, created_at").all(); return rows.results ?? [];
}));
export const adminCreateStyleTemplate = serverFn(async (data) => withAdmin(async ({ db }) => {
  const id = String(data.id ?? makeId());
  await db.prepare("INSERT INTO style_templates (id, name, category, prompt, preview_url, sort_order, is_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, String(data.name ?? "").trim(), data.category ?? null, data.prompt ?? null, data.preview_url ?? null, Number(data.sort_order ?? 0), boolInt(data.is_enabled)).run(); return { id };
}));
export const adminUpdateStyleTemplate = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare(`UPDATE style_templates SET name = ?, category = ?, prompt = ?, preview_url = ?, sort_order = ?,
    is_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(String(data.name ?? "").trim(), data.category ?? null, data.prompt ?? null, data.preview_url ?? null, Number(data.sort_order ?? 0), boolInt(data.is_enabled), String(data.id ?? "")).run(); return { ok: true };
}));
export const adminDeleteStyleTemplate = serverFn(async (data) => withAdmin(async ({ db }) => {
  await db.prepare("DELETE FROM style_templates WHERE id = ?").bind(String(data.id ?? "")).run(); return { ok: true };
}));

export const listAdminUsers = serverFn(async () => withAdmin(async ({ db }) => {
  const rows = await db.prepare(`SELECT a.user_id, a.role, u.email, u.display_name, a.created_at, a.created_by
    FROM admin_users a INNER JOIN users u ON u.id = a.user_id
    ORDER BY CASE WHEN a.role = 'owner' THEN 0 ELSE 1 END, a.created_at`).all();
  return rows.results ?? [];
}, true));

export const addAdminUserByEmail = serverFn(async (data) => withAdmin(async ({ db, userId }) => {
  const email = String(data.email ?? "").trim();
  if (!email) throw new Error("请输入邮箱");
  const role = parseAdminRole(data.role ?? "admin");
  const user = await db.prepare("SELECT id FROM users WHERE email_normalized = ? LIMIT 1")
    .bind(await normalizeEmailServerOnly(email))
    .first<{ id: string }>();
  if (!user) throw new Error("请先让该邮箱注册账号");

  await db.prepare(`INSERT INTO admin_users (id, user_id, role, created_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET role = excluded.role`)
    .bind(makeId(), user.id, role, userId)
    .run();
  return { ok: true };
}, true));

export const updateAdminUserRole = serverFn(async (data) => withAdmin(async ({ db, userId: currentUserId }) => {
  const targetUserId = String(data.userId ?? "").trim();
  if (!targetUserId) throw new Error("管理员不存在");
  const nextRole = parseAdminRole(data.role);
  const currentRole = await getAdminRoleByUserId(db, targetUserId);
  if (!currentRole) throw new Error("管理员不存在");
  if (targetUserId === currentUserId && currentRole === "owner" && nextRole !== "owner") {
    throw new Error("不能降低自己的 owner 权限");
  }
  if (currentRole === "owner" && nextRole !== "owner" && await countOwners(db) <= 1) {
    throw new Error("至少保留一个 owner");
  }

  await db.prepare("UPDATE admin_users SET role = ? WHERE user_id = ?")
    .bind(nextRole, targetUserId)
    .run();
  return { ok: true };
}, true));

export const removeAdminUser = serverFn(async (data) => withAdmin(async ({ db, userId: currentUserId }) => {
  const targetUserId = String(data.userId ?? "").trim();
  if (!targetUserId) throw new Error("管理员不存在");
  if (targetUserId === currentUserId) throw new Error("不能移除自己");
  const role = await getAdminRoleByUserId(db, targetUserId);
  if (!role) throw new Error("管理员不存在");
  if (role === "owner") throw new Error("不能直接移除 owner，请先将其改为 admin");

  await db.prepare("DELETE FROM admin_users WHERE user_id = ? AND role = 'admin'")
    .bind(targetUserId)
    .run();
  return { ok: true };
}, true));

export const resetAdminUserPassword = serverFn(async (data) => withAdmin(async ({ db }) => {
  const targetUserId = getStringInput(data, "userId").trim();
  const password = getStringInput(data, "password").trim();
  if (!targetUserId) throw new Error("管理员不存在");
  if (password.length < 8) throw new Error("密码至少 8 位");
  const role = await getAdminRoleByUserId(db, targetUserId);
  if (!role) throw new Error("管理员不存在");

  const passwordHash = await hashPassword(password);
  await db.batch([
    db.prepare("UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(passwordHash, targetUserId),
    db.prepare("UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL")
      .bind(targetUserId),
  ]);
  return { ok: true };
}, true));

export const founderListAdmins = serverFn(async (data) => {
  const rows = await listAdminUsers(data);
  return rows.map((row: any) => ({ ...row, role: row.role === "owner" ? "founder" : row.role }));
});
export const founderAddAdmin = serverFn(async (data) => addAdminUserByEmail({ ...data, role: "admin" }));
export const founderRemoveAdmin = removeAdminUser;

export const adminGetSystemPrompt = serverFn(async () => withAdmin(async ({ db }) => getSetting(db, "system_prompt", { prompt: "" })));
export const adminSetSystemPrompt = serverFn(async (data) => withAdmin(async ({ db, userId }) => {
  await setSetting(db, "system_prompt", { prompt: String(data.prompt ?? "") }, userId); return { ok: true };
}));

// Generation remains intentionally unavailable until its separate provider integration is approved.
export const consumeGeneration = pendingServerFn("consumeGeneration");
export const getMyGenerationHistory = serverFn(async () => ({ items: [], hasMore: false }), "GET");
export const getMyGenerationTasks = serverFn(async () => [], "GET");
export const createGenerationTask = pendingServerFn("createGenerationTask");
export const cancelMyQueuedGenerationTasks = pendingServerFn("cancelMyQueuedGenerationTasks");
export const cancelGenerationTask = pendingServerFn("cancelGenerationTask");
export const startGenerationTask = pendingServerFn("startGenerationTask");
export const pollGenerationTask = pendingServerFn("pollGenerationTask");
export const generateImage = pendingServerFn("generateImage");
export const checkImageStatus = pendingServerFn("checkImageStatus");
export const generateRandomPrompt = pendingServerFn("generateRandomPrompt");
export const adminTestModel = pendingServerFn("adminTestModel");

// Compatibility exports retained for older UI imports; the active UI uses the D1 redeem functions above.
export const adminListCoupons = adminListRedeemCodes;
export const adminDeleteCoupon = adminDeleteRedeemCode;
export const adminGenerateCoupons = adminGenerateRedeemCodes;
