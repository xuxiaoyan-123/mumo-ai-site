import { lazy, Suspense, useState } from "react";
import { Bell, CreditCard, Gift, Headphones, History, Moon, Sun, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { UserMenu } from "@/components/auth/UserMenu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnnouncementCenter, useMumoFrontendConfig } from "./AnnouncementCenter";
import { AdBanner } from "./AdBanner";

const ContactDialog = lazy(() =>
  import("./ContactDialog").then((module) => ({ default: module.ContactDialog })),
);

type Props = {
  credits: number;
  onSwitchAccount: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
};

export function TopBar({ credits, onSwitchAccount, theme = "light", onToggleTheme }: Props) {
  const { config } = useMumoFrontendConfig();
  const [contactOpen, setContactOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [worksOpen, setWorksOpen] = useState(false);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMessage, setRedeemMessage] = useState("");

  const validateRedeemCode = () => {
    const value = redeemCode.trim();
    if (!value) {
      setRedeemMessage("请输入兑换码");
      return;
    }
    if (value.length < config.redeem.minLength) {
      setRedeemMessage("兑换码格式不正确");
      return;
    }
    setRedeemMessage("兑换功能配置完成后开放");
  };

  return (
    <header className="relative z-40 flex min-h-16 w-full shrink-0 flex-wrap items-center gap-2 border-b border-slate-500/10 bg-white/55 px-3 py-2 shadow-[0_10px_35px_-28px_rgba(45,62,82,.45)] backdrop-blur-2xl transition-colors duration-300 dark:border-white/[0.07] dark:bg-[#111a27]/78 dark:shadow-[0_12px_35px_-28px_rgba(0,0,0,.8)] md:h-16 md:flex-nowrap md:px-6 md:py-0">
      <Link to="/" className="group flex shrink-0 items-center gap-3 rounded-xl pr-3 focus:outline-none">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white/45 dark:border-white/10 dark:bg-white/[0.04]">
          <img src={config.site.logoPath} alt={config.site.brandName} className="h-8 w-9 object-contain" />
        </span>
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-base font-semibold tracking-[0.08em] text-slate-900 dark:text-slate-100 md:text-lg">{config.site.brandName}</span>
          <span className="hidden whitespace-nowrap text-[9px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400 sm:block">{config.site.subtitle}</span>
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
          <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">{credits.toLocaleString()}</span>
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
        <DialogContent className="max-w-2xl border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-38px_rgba(30,41,59,.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#172231]/95">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c5a96f]/25 bg-[#e7d9bb]/25 text-[#8d7344] dark:border-[#d2ba86]/20 dark:bg-[#d2ba86]/10 dark:text-[#d8c18f]">
              <CreditCard className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">充值中心</DialogTitle>
            <DialogDescription className="pt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">选择适合的创作点方案，支付通道配置完成后开放。</DialogDescription>
          </DialogHeader>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            {config.rechargePlans.filter((plan) => plan.enabled).map((plan) => (
              <div key={plan.id} className="relative rounded-2xl border border-slate-300/45 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                {plan.recommendedLabel && <span className="absolute right-3 top-3 rounded-full bg-[#e7d9bb]/55 px-2 py-0.5 text-[9px] text-[#806a43] dark:bg-[#d2ba86]/10 dark:text-[#d8c18f]">{plan.recommendedLabel}</span>}
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{plan.name}</p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{plan.credits.toLocaleString()} 创作点</p>
                <p className="mt-3 font-mono text-xl font-semibold text-slate-800 dark:text-slate-100">{plan.price}</p>
                <button type="button" disabled className="mt-4 h-9 w-full cursor-not-allowed rounded-xl bg-slate-800 text-xs font-medium text-white opacity-55 dark:bg-slate-200 dark:text-slate-900">
                  暂未开放
                </button>
              </div>
            ))}
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
            <DialogDescription className="pt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{config.redeem.formatHint}</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <input
              value={redeemCode}
              onChange={(event) => {
                setRedeemCode(event.target.value);
                setRedeemMessage("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") validateRedeemCode();
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
