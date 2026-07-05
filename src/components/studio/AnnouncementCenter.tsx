/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type MumoAnnouncement = {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  sortOrder: number;
};

export type MumoRechargePlan = {
  id: string;
  name: string;
  credits: number;
  price: string;
  recommendedLabel: string;
  enabled: boolean;
};

export type MumoFrontendConfig = {
  site: { brandName: string; logoPath: string; subtitle: string };
  announcements: MumoAnnouncement[];
  contact: { description: string; wechat: string; email: string; serviceHours: string; enabled: boolean };
  rechargePlans: MumoRechargePlan[];
  redeem: { formatHint: string; minLength: number; creditsPerCode: number; enabled: boolean };
  models: Array<{ name: string; description: string; enabled: boolean }>;
  templates: Array<{ name: string; category: string; prompt: string; enabled: boolean }>;
};

export const DEFAULT_MUMO_FRONTEND_CONFIG: MumoFrontendConfig = {
  site: {
    brandName: "莫沐AI",
    logoPath: "/mumo-logo.png",
    subtitle: "MUMO AI VISUAL STUDIO",
  },
  announcements: [
    { id: "welcome", title: "欢迎使用莫沐AI", content: "电商视觉创作工具已开放体验。", enabled: true, sortOrder: 1 },
    { id: "service", title: "创作服务说明", content: "充值与兑换服务当前暂未开放。", enabled: true, sortOrder: 2 },
    { id: "works", title: "作品中心", content: "作品保存能力即将上线。", enabled: true, sortOrder: 3 },
  ],
  contact: {
    description: "如需帮助，可通过以下方式联系我们。",
    wechat: "待配置",
    email: "support@mumo.example",
    serviceHours: "工作日 09:00–18:00",
    enabled: true,
  },
  rechargePlans: [
    { id: "starter", name: "入门包", credits: 1000, price: "¥ --", recommendedLabel: "", enabled: true },
    { id: "standard", name: "标准包", credits: 3000, price: "¥ --", recommendedLabel: "推荐", enabled: true },
    { id: "professional", name: "专业包", credits: 8000, price: "¥ --", recommendedLabel: "", enabled: true },
  ],
  redeem: {
    formatHint: "请输入不少于 6 位的兑换码",
    minLength: 6,
    creditsPerCode: 0,
    enabled: false,
  },
  models: [
    { name: "沐莫 · 电商视觉模型", description: "适合商品主图与场景视觉", enabled: true },
  ],
  templates: [
    { name: "轻奢商品主图", category: "电商主图", prompt: "浅灰蓝背景，柔和侧光，突出商品材质", enabled: true },
  ],
};

const STORAGE_KEY = "mumo-frontend-config-v1";
const CONFIG_EVENT = "mumo-frontend-config-change";

export function readMumoFrontendConfig(): MumoFrontendConfig {
  if (typeof window === "undefined") return DEFAULT_MUMO_FRONTEND_CONFIG;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<MumoFrontendConfig> | null;
    if (!saved) return DEFAULT_MUMO_FRONTEND_CONFIG;
    return {
      ...DEFAULT_MUMO_FRONTEND_CONFIG,
      ...saved,
      site: { ...DEFAULT_MUMO_FRONTEND_CONFIG.site, ...saved.site },
      contact: { ...DEFAULT_MUMO_FRONTEND_CONFIG.contact, ...saved.contact },
      redeem: { ...DEFAULT_MUMO_FRONTEND_CONFIG.redeem, ...saved.redeem },
      announcements: Array.isArray(saved.announcements) ? saved.announcements : DEFAULT_MUMO_FRONTEND_CONFIG.announcements,
      rechargePlans: Array.isArray(saved.rechargePlans) ? saved.rechargePlans : DEFAULT_MUMO_FRONTEND_CONFIG.rechargePlans,
      models: Array.isArray(saved.models) ? saved.models : DEFAULT_MUMO_FRONTEND_CONFIG.models,
      templates: Array.isArray(saved.templates) ? saved.templates : DEFAULT_MUMO_FRONTEND_CONFIG.templates,
    };
  } catch {
    return DEFAULT_MUMO_FRONTEND_CONFIG;
  }
}

export function saveMumoFrontendConfig(config: MumoFrontendConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new Event(CONFIG_EVENT));
}

export function useMumoFrontendConfig() {
  const [config, setConfig] = useState<MumoFrontendConfig>(readMumoFrontendConfig);

  useEffect(() => {
    const sync = () => setConfig(readMumoFrontendConfig());
    window.addEventListener(CONFIG_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CONFIG_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const updateConfig = (next: MumoFrontendConfig) => {
    saveMumoFrontendConfig(next);
    setConfig(next);
  };

  return { config, updateConfig };
}

type Props = { open: boolean; onOpenChange: (open: boolean) => void; autoOpenLatest?: boolean };

export function AnnouncementCenter({ open, onOpenChange }: Props) {
  const { config } = useMumoFrontendConfig();
  const announcements = config.announcements
    .filter((item) => item.enabled)
    .sort((left, right) => left.sortOrder - right.sortOrder);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/70 bg-white/90 p-6 backdrop-blur-2xl dark:border-white/10 dark:bg-[#172231]/95">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-[#9a7d49]" />公告</DialogTitle>
          <DialogDescription>莫沐AI 的近期动态</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 pt-2">
          {announcements.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-300/40 bg-white/50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-100">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.content}</p>
            </article>
          ))}
          {announcements.length === 0 && <p className="py-8 text-center text-sm text-slate-400">暂无公告</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
