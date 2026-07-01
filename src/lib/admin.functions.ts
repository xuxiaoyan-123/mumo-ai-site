import { createServerFn } from "@tanstack/react-start";

const MIGRATION_PENDING = "Not implemented: D1 migration pending";

function pendingServerFn(name: string, method: "GET" | "POST" = "POST"): any {
  return createServerFn({ method })
    .inputValidator((data: unknown) => data)
    .handler(async () => {
      throw new Error(`${MIGRATION_PENDING} (${name})`);
    });
}

function placeholderServerFn(value: unknown, method: "GET" | "POST" = "POST"): any {
  return createServerFn({ method })
    .inputValidator((data: unknown) => data)
    .handler(async () => value);
}

// User, credit, order, payment, generation and administrator mutations stay blocked
// until authorization rules and the D1 schema are implemented.
export const adminListUsers = pendingServerFn("adminListUsers");
export const adminGetUserCreditUsageLogs = pendingServerFn("adminGetUserCreditUsageLogs");
export const adminBanUser = pendingServerFn("adminBanUser");
export const adminDeleteUser = pendingServerFn("adminDeleteUser");
export const adminResetPassword = pendingServerFn("adminResetPassword");
export const adminAdjustCredits = pendingServerFn("adminAdjustCredits");
export const adminListCoupons = pendingServerFn("adminListCoupons");
export const adminDeleteCoupon = pendingServerFn("adminDeleteCoupon");
export const adminGenerateCoupons = pendingServerFn("adminGenerateCoupons");
export const redeemCoupon = pendingServerFn("redeemCoupon");

export const listModelsConfig = placeholderServerFn([]);
export const adminListModelsConfig = pendingServerFn("adminListModelsConfig");
export const adminUpdateModelPrice = pendingServerFn("adminUpdateModelPrice");
export const adminUpdateModel = pendingServerFn("adminUpdateModel");
export const adminCreateModel = pendingServerFn("adminCreateModel");
export const adminDeleteModel = pendingServerFn("adminDeleteModel");
export const adminGetGlobalConfig = pendingServerFn("adminGetGlobalConfig");
export const adminUpdateGlobalConfig = pendingServerFn("adminUpdateGlobalConfig");

export const consumeGeneration = pendingServerFn("consumeGeneration");
export const getMyGenerationHistory = placeholderServerFn({ items: [], hasMore: false });
export const getMyGenerationTasks = placeholderServerFn([]);
export const createGenerationTask = pendingServerFn("createGenerationTask");
export const cancelMyQueuedGenerationTasks = pendingServerFn("cancelMyQueuedGenerationTasks");
export const cancelGenerationTask = pendingServerFn("cancelGenerationTask");
export const startGenerationTask = pendingServerFn("startGenerationTask");
export const pollGenerationTask = pendingServerFn("pollGenerationTask");
export const generateImage = pendingServerFn("generateImage");
export const checkImageStatus = pendingServerFn("checkImageStatus");

export const checkIsAdmin = placeholderServerFn({ isAdmin: false, isFounder: false });
export const adminGetAnalytics = pendingServerFn("adminGetAnalytics");
export const listVisibleRechargePackages = placeholderServerFn([], "GET");
export const listAdminRechargePackages = pendingServerFn("listAdminRechargePackages");
export const upsertAdminRechargePackage = pendingServerFn("upsertAdminRechargePackage");
export const hideAdminRechargePackage = pendingServerFn("hideAdminRechargePackage");
export const deleteAdminRechargePackage = pendingServerFn("deleteAdminRechargePackage");

export const listActiveAds = placeholderServerFn([], "GET");
export const adminListAds = pendingServerFn("adminListAds");
export const adminUpsertAd = pendingServerFn("adminUpsertAd");
export const adminDeleteAd = pendingServerFn("adminDeleteAd");
export const listAnnouncements = placeholderServerFn([]);
export const adminListAnnouncements = pendingServerFn("adminListAnnouncements");
export const adminUpsertAnnouncement = pendingServerFn("adminUpsertAnnouncement");
export const adminDeleteAnnouncement = pendingServerFn("adminDeleteAnnouncement");

export const founderListAdmins = pendingServerFn("founderListAdmins");
export const founderAddAdmin = pendingServerFn("founderAddAdmin");
export const founderRemoveAdmin = pendingServerFn("founderRemoveAdmin");
export const verifyAdminAccessPassword = pendingServerFn("verifyAdminAccessPassword");
export const founderGetAccessPassword = pendingServerFn("founderGetAccessPassword");
export const founderSetAccessPassword = pendingServerFn("founderSetAccessPassword");

export const listStyleTemplates = placeholderServerFn([]);
export const adminListStyleTemplates = pendingServerFn("adminListStyleTemplates");
export const adminUpdateStyleTemplate = pendingServerFn("adminUpdateStyleTemplate");
export const adminCreateStyleTemplate = pendingServerFn("adminCreateStyleTemplate");
export const adminDeleteStyleTemplate = pendingServerFn("adminDeleteStyleTemplate");
export const adminGetSystemPrompt = pendingServerFn("adminGetSystemPrompt");
export const adminSetSystemPrompt = pendingServerFn("adminSetSystemPrompt");

export const getContactInfo = placeholderServerFn({ wechat: "", qq: "" }, "GET");
export const adminGetContactInfo = pendingServerFn("adminGetContactInfo");
export const adminSetContactInfo = pendingServerFn("adminSetContactInfo");
export const generateRandomPrompt = pendingServerFn("generateRandomPrompt");
export const adminTestModel = pendingServerFn("adminTestModel");
