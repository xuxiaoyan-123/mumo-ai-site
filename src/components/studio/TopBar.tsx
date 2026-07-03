import { lazy, Suspense, useState } from "react";
import { Bell, Headphones, History, Sparkles, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { UserMenu } from "@/components/auth/UserMenu";
import { AdBanner } from "./AdBanner";

const ContactDialog = lazy(() => import("./ContactDialog").then((m) => ({ default: m.ContactDialog })));

type Props = {
  credits: number;
  onOpenHistory: () => void;
  onOpenAnnouncements: () => void;
  onSwitchAccount: () => void;
};

export function TopBar({ credits, onOpenHistory, onOpenAnnouncements, onSwitchAccount }: Props) {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <header className="relative z-40 flex min-h-16 w-full shrink-0 flex-wrap items-center gap-2 border-b border-white/[0.08] bg-[#070711]/80 px-3 py-2 backdrop-blur-2xl md:h-16 md:flex-nowrap md:px-5 md:py-0">
      <Link to="/" className="group flex shrink-0 items-center gap-3 rounded-xl pr-2 focus:outline-none">
        <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-fuchsia-300/30 bg-gradient-to-br from-fuchsia-500 via-violet-600 to-cyan-400 shadow-[0_0_24px_rgba(217,70,239,.38)]">
          <span className="absolute inset-[1px] rounded-[10px] bg-[#0a0815]/45" />
          <Sparkles className="relative h-4 w-4 text-white transition-transform group-hover:rotate-12" />
        </span>
        <span className="min-w-0">
          <span className="block whitespace-nowrap text-base font-semibold tracking-wide text-white md:text-lg">沐莫</span>
          <span className="hidden whitespace-nowrap text-[9px] uppercase tracking-[0.22em] text-fuchsia-200/60 sm:block">Mumo AI Studio</span>
        </span>
        <span className="hidden rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-2 py-1 text-[9px] font-medium text-fuchsia-200 lg:inline-flex">
          AI 创作工作台
        </span>
      </Link>

      <AdBanner />

      <nav className="hidden items-center gap-1 lg:flex">
        <NavLinkTo to="/">在线生成</NavLinkTo>
        <NavLinkTo to="/inspiration">灵感广场</NavLinkTo>
      </nav>

      <div className="ml-auto flex min-w-0 items-center justify-end gap-1.5 md:gap-2">
        <TopAction title="公告栏" label="公告栏" onClick={onOpenAnnouncements}>
          <Bell className="h-4 w-4" />
        </TopAction>
        <TopAction title="在线客服" label="在线客服" onClick={() => setContactOpen(true)}>
          <Headphones className="h-4 w-4" />
        </TopAction>
        <TopAction title="历史记录" label="历史记录" onClick={onOpenHistory}>
          <History className="h-4 w-4" />
        </TopAction>

        <div className="hidden h-7 w-px bg-white/10 sm:block" />
        <div className="hidden shrink-0 items-center gap-1.5 rounded-full border border-violet-300/15 bg-violet-400/[0.07] px-2.5 py-1.5 sm:flex">
          <Zap className="h-3.5 w-3.5 text-fuchsia-300" fill="currentColor" />
          <span className="font-mono text-[11px] font-semibold tabular-nums text-white/85">{credits.toLocaleString()}</span>
          <span className="text-[9px] text-white/35">创作点</span>
        </div>
        <UserMenu onSwitchAccount={onSwitchAccount} />
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
      className="group flex h-9 items-center justify-center gap-1.5 rounded-xl border border-transparent px-2 text-white/55 transition-all hover:border-fuchsia-400/20 hover:bg-fuchsia-400/[0.08] hover:text-fuchsia-100 md:px-2.5"
    >
      <span className="transition-transform group-hover:scale-110">{children}</span>
      <span className="hidden text-[11px] font-medium xl:inline">{label}</span>
    </button>
  );
}

function NavLinkTo({ to, children }: { to: "/" | "/inspiration"; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-lg px-3 py-2 text-[11px] font-medium text-white/45 transition-colors hover:bg-white/[0.04] hover:text-white/85"
      activeProps={{ className: "rounded-lg bg-white/[0.05] px-3 py-2 text-[11px] font-medium text-white" }}
    >
      {children}
    </Link>
  );
}
