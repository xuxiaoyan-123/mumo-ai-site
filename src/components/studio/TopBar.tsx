import { lazy, Suspense, useState } from "react";
import { Bell, Headphones, History, Moon, Sun, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { UserMenu } from "@/components/auth/UserMenu";
import { AdBanner } from "./AdBanner";

const ContactDialog = lazy(() =>
  import("./ContactDialog").then((module) => ({ default: module.ContactDialog })),
);

type Props = {
  credits: number;
  onOpenHistory: () => void;
  onOpenAnnouncements: () => void;
  onSwitchAccount: () => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
};

export function TopBar({ credits, onOpenHistory, onOpenAnnouncements, onSwitchAccount, theme = "light", onToggleTheme }: Props) {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <header className="relative z-40 flex min-h-16 w-full shrink-0 flex-wrap items-center gap-2 border-b border-slate-500/10 bg-white/55 px-3 py-2 shadow-[0_10px_35px_-28px_rgba(45,62,82,.45)] backdrop-blur-2xl transition-colors duration-300 dark:border-white/[0.07] dark:bg-[#111a27]/78 dark:shadow-[0_12px_35px_-28px_rgba(0,0,0,.8)] md:h-16 md:flex-nowrap md:px-6 md:py-0">
      <Link to="/" className="group flex shrink-0 items-center gap-3 rounded-xl pr-3 focus:outline-none">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white/45 dark:border-white/10 dark:bg-white/[0.04]">
          <img src="/mumo-logo.png" alt="莫沐AI" className="h-8 w-9 object-contain" />
        </span>
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-base font-semibold tracking-[0.08em] text-slate-900 dark:text-slate-100 md:text-lg">莫沐AI</span>
          <span className="hidden whitespace-nowrap text-[9px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400 sm:block">MUMO AI VISUAL STUDIO</span>
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
        <TopAction title="公告栏" label="公告" onClick={onOpenAnnouncements}>
          <Bell className="h-4 w-4" />
        </TopAction>
        <TopAction title="在线客服" label="客服" onClick={() => setContactOpen(true)}>
          <Headphones className="h-4 w-4" />
        </TopAction>
        <TopAction title="历史记录" label="作品" onClick={onOpenHistory}>
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
        <div className="rounded-full border border-slate-400/25 bg-white/35 p-0.5 dark:border-white/10 dark:bg-white/[0.04]">
          <UserMenu onSwitchAccount={onSwitchAccount} />
        </div>
      </div>

      {contactOpen && (
        <Suspense fallback={null}>
          <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />
        </Suspense>
      )}
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
