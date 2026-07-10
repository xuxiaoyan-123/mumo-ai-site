import { lazy, Suspense, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Check, CreditCard, Gift, Headphones, History, Moon, Sparkles, Sun, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserMenu } from "@/components/auth/UserMenu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnnouncementCenter } from "./AnnouncementCenter";
import { AdBanner } from "./AdBanner";
import { getGlobalConfig, listVisibleRechargePackages, redeemCode as redeemCodeFn } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";

const ContactDialog = lazy(() =>
  import("./ContactDialog").then((module) => ({ default: module.ContactDialog })),
);

type Props = {
  credits: number;
  onOpenHistory?: () => void;
  onOpenAnnouncements?: () => void;
  onSwitchAccount: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
};

type SiteConfig = { brandName: string; logoPath: string; subtitle: string };
type RechargePackage = {
  id: string;
  name: string;
  credits: number;
  price_text: string;
  badge: string | null;
  description: string | null;
  button_text: string | null;
  is_popular: number;
  is_highlighted: number;
  benefits_text: string | null;
  buy_url: string | null;
};
const DEFAULT_SITE: SiteConfig = { brandName: "沐莫AI", logoPath: "/mumo-logo.png", subtitle: "MUMO AI VISUAL STUDIO" };

export function TopBar({ credits, onSwitchAccount, theme = "light", onToggleTheme }: Props) {
  const fetchConfig = useServerFn(getGlobalConfig);
  const fetchPackages = useServerFn(listVisibleRechargePackages);
  const redeem = useServerFn(redeemCodeFn);
  const { refreshProfile } = useAuth();
  const [site, setSite] = useState<SiteConfig>(DEFAULT_SITE);
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [redeemHint, setRedeemHint] = useState("请输入 MUMO 兑换码");
  const [displayCredits, setDisplayCredits] = useState(credits);
  const [contactOpen, setContactOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [worksOpen, setWorksOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMessage, setRedeemMessage] = useState("");

  useEffect(() => setDisplayCredits(credits), [credits]);

  useEffect(() => {
    fetchConfig({}).then((value: any) => {
      if (value?.site) setSite({ ...DEFAULT_SITE, ...value.site });
      if (value?.redeem?.formatHint) setRedeemHint(String(value.redeem.formatHint));
    }).catch(() => {});
    fetchPackages({}).then((rows: unknown) => setPackages((rows ?? []) as RechargePackage[])).catch(() => setPackages([]));
  }, [fetchConfig, fetchPackages]);

  const validateRedeemCode = async () => {
    const value = redeemCode.trim();
    if (!value) {
      setRedeemMessage("请输入兑换码");
      return;
    }
    try {
      const result: any = await redeem({ data: { code: value } });
      if (!result?.success) { setRedeemMessage(result?.message || "兑换码不存在或已失效"); return; }
      setDisplayCredits(Number(result.balance ?? displayCredits + Number(result.credits ?? 0)));
      setRedeemCode(""); setRedeemMessage(""); setRedeemOpen(false);
      await refreshProfile();
      toast.success(`兑换成功，已获得 ${Number(result.credits ?? 0).toLocaleString()} 创作点`);
    } catch (error: any) {
      setRedeemMessage(error.message || "后台数据服务未配置");
    }
  };

  const openPurchase = (url: string | null) => {
    if (!url || !/^https?:\/\//i.test(url)) { toast.info("购买链接暂未配置，请联系客服"); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <header className="relative z-40 flex min-h-16 w-full shrink-0 flex-wrap items-center gap-2 border-b border-slate-500/10 bg-white/55 px-3 py-2 shadow-[0_10px_35px_-28px_rgba(45,62,82,.45)] backdrop-blur-2xl transition-colors duration-300 dark:border-white/[0.07] dark:bg-[#111a27]/78 dark:shadow-[0_12px_35px_-28px_rgba(0,0,0,.8)] md:h-16 md:flex-nowrap md:px-6 md:py-0">
      <Link to="/" className="group flex shrink-0 items-center gap-3 rounded-xl pr-3 focus:outline-none">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white/45 dark:border-white/10 dark:bg-white/[0.04]">
          <img src={site.logoPath} alt={site.brandName} className="h-8 w-9 object-contain" />
        </span>
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-base font-semibold tracking-[0.08em] text-slate-900 dark:text-slate-100 md:text-lg">{site.brandName}</span>
          <span className="hidden whitespace-nowrap text-[9px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400 sm:block">{site.subtitle}</span>
        </span>
        <span className="hidden rounded-full border border-[#c5a96f]/25 bg-[#e7d9bb]/25 px-2.5 py-1 text-[9px] font-medium text-[#7b6640] lg:inline-flex">
          电商视觉工作台
        </span>
      </Link>

      <AdBanner />

      <nav className="hidden items-center gap-1 lg:flex">
        <NavLinkTo to="/">在线创作</NavLinkTo>
        <NavLinkTo to="/inspiration">模板灵感</NavLinkTo>
      </nav>

      <div className="ml-auto flex min-w-0 items-center justify-end gap-1 md:gap-1.5">
        <TopAction title="公告栏" label="公告" onClick={() => setAnnouncementsOpen(true)}>
          <Bell className="h-4 w-4" />
        </TopAction>
        <TopAction title="在线客服" label="客服" onClick={() => setContactOpen(true)}>
          <Headphones className="h-4 w-4" />
        </TopAction>
        <TopAction title="充值" label="充值" onClick={() => setRechargeOpen(true)}>
          <CreditCard className="h-4 w-4" />
        </TopAction>
        <TopAction title="兑换兑换码" label="兑换" onClick={() => setRedeemOpen(true)}>
          <Gift className="h-4 w-4" />
        </TopAction>
        <TopAction title="我的作品" label="作品" onClick={() => setWorksOpen(true)}>
          <History className="h-4 w-4" />
        </TopAction>
        {onToggleTheme && (
          <button
            type="button"
            title={theme === "light" ? "切换到夜间模式" : "切换到日间模式"}
            aria-label={theme === "light" ? "切换到夜间模式" : "切换到日间模式"}
            onClick={onToggleTheme}
            className="group flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-400/15 bg-white/35 px-2.5 text-slate-500 transition-all hover:bg-white/65 hover:text-slate-900 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-slate-100"
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4 text-[#d9bd83]" />}
            <span className="hidden text-[10px] font-medium 2xl:inline">{theme === "light" ? "夜间" : "日间"}</span>
          </button>
        )}

        <div className="hidden h-7 w-px bg-slate-400/20 dark:bg-white/10 sm:block" />
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/45 px-3 py-1.5 shadow-sm dark:border-white/10 dark:bg-white/[0.05] sm:flex">
          <Zap className="h-3.5 w-3.5 text-[#a4874f]" fill="currentColor" />
          <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">{displayCredits.toLocaleString()}</span>
          <span className="text-[9px] text-slate-400 dark:text-slate-500">创作点</span>
        </div>
        <UserMenu onSwitchAccount={onSwitchAccount} />
      </div>

      {contactOpen && (
        <Suspense fallback={null}>
          <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
        </Suspense>
      )}

      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-white/70 bg-white/95 p-5 shadow-[0_24px_70px_-38px_rgba(30,41,59,.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#172231]/95 md:p-7">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c5a96f]/25 bg-[#e7d9bb]/25 text-[#8d7344] dark:border-[#d2ba86]/20 dark:bg-[#d2ba86]/10 dark:text-[#d8c18f]">
              <CreditCard className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">购买兑换码</DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">选择适合的创作点套餐，前往管理员配置的第三方发卡平台购买兑换码。</DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {packages.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex min-h-[360px] flex-col overflow-hidden rounded-2xl border p-5 transition-transform hover:-translate-y-0.5 ${
                  Number(plan.is_highlighted) === 1
                    ? "border-[#b89657]/55 bg-gradient-to-b from-[#f7eedb]/75 to-white/80 shadow-[0_18px_45px_-28px_rgba(146,111,50,.75)] dark:border-[#d2ba86]/35 dark:from-[#352f24]/75 dark:to-white/[0.045]"
                    : "border-slate-300/45 bg-white/60 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
                }`}
              >
                <div className="flex min-h-7 flex-wrap items-start gap-2">
                  {Number(plan.is_popular) === 1 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white dark:bg-[#d8c18f] dark:text-slate-950">
                      <Sparkles className="h-3 w-3" />最受欢迎
                    </span>
                  )}
                  {plan.badge && <span className="rounded-full border border-[#c5a96f]/30 bg-[#e7d9bb]/45 px-2.5 py-1 text-[10px] font-medium text-[#806a43] dark:border-[#d2ba86]/20 dark:bg-[#d2ba86]/10 dark:text-[#d8c18f]">{plan.badge}</span>}
                </div>
                <p className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{plan.name}</p>
                {plan.description && <p className="mt-1 min-h-10 text-xs leading-5 text-slate-500 dark:text-slate-400">{plan.description}</p>}
                <p className="mt-5 font-mono text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{plan.price_text}</p>
                <div className="mt-3 rounded-xl border border-slate-300/40 bg-white/55 px-3 py-2.5 dark:border-white/10 dark:bg-black/10">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400">创作点</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold text-slate-800 dark:text-slate-100">{Number(plan.credits ?? 0).toLocaleString()}</p>
                </div>
                <ul className="mt-4 flex-1 space-y-2.5">
                  {getPackageBenefits(plan).map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a8894f] dark:text-[#d8c18f]" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => openPurchase(plan.buy_url)}
                  aria-disabled={!hasValidBuyLink(plan.buy_url)}
                  className={`mt-5 h-10 w-full rounded-xl text-xs font-semibold transition-colors ${
                    hasValidBuyLink(plan.buy_url)
                      ? "bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
                      : "border border-slate-300/60 bg-slate-100 text-slate-400 hover:bg-slate-200 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500"
                  }`}
                >
                  {hasValidBuyLink(plan.buy_url) ? (plan.button_text?.trim() || "前往购买") : "暂未配置"}
                </button>
              </div>
            ))}
            {!packages.length && <p className="col-span-full py-8 text-center text-sm text-slate-400">后台数据服务未配置</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={redeemOpen}
        onOpenChange={(open) => {
          setRedeemOpen(open);
          if (!open) {
            setRedeemCode("");
            setRedeemMessage("");
          }
        }}
      >
        <DialogContent className="max-w-sm border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-38px_rgba(30,41,59,.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#172231]/95">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c5a96f]/25 bg-[#e7d9bb]/25 text-[#8d7344] dark:border-[#d2ba86]/20 dark:bg-[#d2ba86]/10 dark:text-[#d8c18f]">
              <Gift className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">兑换码</DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{redeemHint}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <input
              value={redeemCode}
              onChange={(event) => {
                setRedeemCode(event.target.value.toUpperCase());
                setRedeemMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void validateRedeemCode();
              }}
              placeholder="请输入兑换码"
              aria-label="兑换码"
              className="h-11 w-full rounded-xl border border-slate-300/60 bg-white/65 px-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-500/60 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {redeemMessage && <p role="status" className="text-xs text-[#8a6d37] dark:text-[#d8c18f]">{redeemMessage}</p>}
            <button
              type="button"
              onClick={validateRedeemCode}
              className="h-11 w-full rounded-xl bg-slate-800 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
            >
              确认兑换
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AnnouncementCenter open={announcementsOpen} onOpenChange={setAnnouncementsOpen} />

      <Dialog open={worksOpen} onOpenChange={setWorksOpen}>
        <DialogContent className="max-w-md border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-38px_rgba(30,41,59,.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#172231]/95">
          <DialogHeader>
            <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">我的作品</DialogTitle>
            <DialogDescription>生成完成后的作品将在这里集中展示。</DialogDescription>
          </DialogHeader>
          <div className="mt-2 flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/60 bg-white/35 text-center dark:border-white/10 dark:bg-white/[0.025]">
            <History className="mb-3 h-7 w-7 text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">暂无作品</p>
            <p className="mt-1 text-xs text-slate-400">生成完成后将展示在这里</p>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function TopAction({ children, label, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      {...rest}
      className="group flex h-9 items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 text-slate-500 transition-all hover:border-white/75 hover:bg-white/55 hover:text-slate-900 hover:shadow-sm dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/[0.06] dark:hover:text-slate-100 md:px-2.5"
    >
      <span className="transition-transform group-hover:scale-105">{children}</span>
      <span className="hidden text-[11px] font-medium xl:inline">{label}</span>
    </button>
  );
}

function NavLinkTo({ to, children }: { to: "/" | "/inspiration"; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-lg px-3 py-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white/45 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
      activeProps={{ className: "rounded-lg bg-white/60 px-3 py-2 text-[11px] font-medium text-slate-900 shadow-sm dark:bg-white/[0.08] dark:text-slate-100" }}
    >
      {children}
    </Link>
  );
}

function hasValidBuyLink(url: string | null) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function getPackageBenefits(plan: RechargePackage) {
  const benefits = String(plan.benefits_text ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return benefits.length > 0 ? benefits : [`兑换后获得 ${Number(plan.credits ?? 0).toLocaleString()} 创作点`];
}
