import { lazy, Suspense, useState } from "react";
import { Bell, Headphones, History, Sparkles, Zap } from "lucide-react";
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
};

export function TopBar({ credits, onOpenHistory, onOpenAnnouncements, onSwitchAccount }: Props) {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <header className="relative z-40 flex min-h-16 w-full shrink-0 flex-wrap items-center gap-2 border-b border-slate-500/10 bg-white/55 px-3 py-2 shadow-[0_10px_35px_-28px_rgba(45,62,82,.45)] backdrop-blur-2xl md:h-16 md:flex-nowrap md:px-6 md:py-0">
      <Link to="/" className="group flex shrink-0 items-center gap-3 rounded-xl pr-3 focus:outline-none">
        <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/80 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-950 text-white shadow-[0_10px_22px_-14px_rgba(30,41,59,.75)]">
          <Sparkles className="h-4 w-4 text-[#e9d6ae] transition-transform group-hover:rotate-12" />
        </span>
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-base font-semibold tracking-[0.12em] text-slate-900 md:text-lg">沐莫</span>
          <span className="hidden whitespace-nowrap text-[9px] uppercase tracking-[0.24em] text-slate-500 sm:block">Mumo Visual Studio</span>
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

        <div className="hidden h-7 w-px bg-slate-400/20 sm:block" />
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-white/70 bg-white/45 px-3 py-1.5 shadow-sm sm:flex">
          <Zap className="h-3.5 w-3.5 text-[#a4874f]" fill="currentColor" />
          <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-700">{credits.toLocaleString()}</span>
          <span className="text-[9px] text-slate-400">创作点</span>
        </div>
        <div className="rounded-full border border-slate-800/10 bg-slate-900 p-0.5 shadow-[0_10px_22px_-14px_rgba(30,41,59,.75)]">
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
      className="group flex h-9 items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 text-slate-500 transition-all hover:border-white/75 hover:bg-white/55 hover:text-slate-900 hover:shadow-sm md:px-2.5"
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
      className="rounded-lg px-3 py-2 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white/45 hover:text-slate-900"
      activeProps={{ className: "rounded-lg bg-white/60 px-3 py-2 text-[11px] font-medium text-slate-900 shadow-sm" }}
    >
      {children}
    </Link>
  );
}
