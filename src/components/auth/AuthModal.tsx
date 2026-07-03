import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

type Mode = "login" | "register" | "reset";

const endpointByMode: Record<Mode, string> = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  reset: "/api/auth/request-password-reset",
};

const titleByMode: Record<Mode, string> = {
  login: "欢迎回到沐莫",
  register: "加入沐莫创作空间",
  reset: "找回你的账号",
};

const subtitleByMode: Record<Mode, string> = {
  login: "登录后继续探索你的 AI 视觉创作",
  register: "创建账号，开启更完整的创作体验",
  reset: "输入注册邮箱，我们将提供后续指引",
};

type AuthModalProps = {
  onSuccess?: () => void;
  onPreview?: () => void;
};

export function AuthModal({ onSuccess, onPreview }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setMessage("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const normalizedEmail = email.trim();
    if (!normalizedEmail || (mode !== "reset" && !password)) {
      setMessage(mode === "reset" ? "请输入邮箱" : "请输入邮箱和密码");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setMessage("请输入正确的邮箱格式");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(endpointByMode[mode], {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          mode === "reset" ? { email: normalizedEmail } : { email: normalizedEmail, password },
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      setMessage(payload.message ?? (response.ok ? "操作完成" : "账号服务暂不可用，请稍后再试"));
      if (response.ok && mode !== "reset") onSuccess?.();
    } catch {
      setMessage("账号服务暂不可用，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#05040c]/76 p-4 backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[12%] top-[18%] h-72 w-72 rounded-full bg-violet-600/15 blur-[110px]" />
        <div className="absolute bottom-[8%] right-[12%] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-[120px]" />
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-fuchsia-300/[0.04]" />
      </div>

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mumo-auth-title"
        className="relative w-full max-w-[430px] overflow-hidden rounded-[28px] border border-fuchsia-200/15 bg-[#0b0918]/90 p-1 shadow-[0_30px_100px_rgba(0,0,0,.6),0_0_70px_rgba(168,85,247,.14)] backdrop-blur-2xl"
      >
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300/80 to-transparent" />
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-3xl" />

        <div className="relative rounded-[24px] border border-white/[0.035] bg-gradient-to-b from-white/[0.035] to-transparent px-5 py-6 sm:px-7 sm:py-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-fuchsia-300/25 bg-gradient-to-br from-violet-500/30 via-fuchsia-500/25 to-rose-400/20 text-fuchsia-100 shadow-[0_0_26px_rgba(217,70,239,.25)]">
                <Sparkles className="h-[18px] w-[18px]" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-white">沐莫</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.24em] text-fuchsia-200/50">Mumo AI Studio</p>
              </div>
            </div>
            <span className="rounded-full border border-violet-300/15 bg-violet-400/[0.08] px-2.5 py-1 text-[9px] text-violet-200/65">
              创作预览版
            </span>
          </div>

          <div className="mt-7">
            <h2 id="mumo-auth-title" className="text-2xl font-semibold tracking-tight text-white">
              {titleByMode[mode]}
            </h2>
            <p className="mt-2 text-xs leading-5 text-white/42">{subtitleByMode[mode]}</p>
          </div>

          {mode !== "reset" && (
            <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/[0.07] bg-black/20 p-1">
              <ModeButton active={mode === "login"} onClick={() => switchMode("login")}>登录</ModeButton>
              <ModeButton active={mode === "register"} onClick={() => switchMode("register")}>注册</ModeButton>
            </div>
          )}

          <form className="mt-4 space-y-3" onSubmit={submit} noValidate>
            <label className="group relative block">
              <span className="sr-only">邮箱</span>
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28 transition-colors group-focus-within:text-fuchsia-300" />
              <input
                className="h-12 w-full rounded-xl border border-white/[0.08] bg-black/25 pl-10 pr-3 text-sm text-white outline-none transition-all placeholder:text-white/24 focus:border-fuchsia-400/45 focus:bg-fuchsia-400/[0.035] focus:shadow-[0_0_0_3px_rgba(217,70,239,.06)]"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="邮箱地址"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (message) setMessage("");
                }}
              />
            </label>

            {mode !== "reset" && (
              <label className="group relative block">
                <span className="sr-only">密码</span>
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28 transition-colors group-focus-within:text-fuchsia-300" />
                <input
                  className="h-12 w-full rounded-xl border border-white/[0.08] bg-black/25 pl-10 pr-11 text-sm text-white outline-none transition-all placeholder:text-white/24 focus:border-fuchsia-400/45 focus:bg-fuchsia-400/[0.035] focus:shadow-[0_0_0_3px_rgba(217,70,239,.06)]"
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder="密码"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (message) setMessage("");
                  }}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-white/28 transition-colors hover:bg-white/5 hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>
            )}

            {message && (
              <div aria-live="polite" className="flex items-start gap-2 rounded-xl border border-fuchsia-300/15 bg-fuchsia-400/[0.06] px-3 py-2.5 text-[11px] leading-5 text-fuchsia-100/75">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fuchsia-300" />
                <span>{message}</span>
              </div>
            )}

            <button
              className="mumo-neon-button flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-transform enabled:hover:scale-[1.01] disabled:opacity-60"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "处理中…" : mode === "reset" ? "获取找回指引" : mode === "register" ? "创建账号" : "进入工作台"}
              {!submitting && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between gap-3 text-[11px]">
            {mode === "reset" ? (
              <button type="button" className="text-white/42 transition-colors hover:text-fuchsia-200" onClick={() => switchMode("login")}>返回登录</button>
            ) : (
              <button type="button" className="text-white/42 transition-colors hover:text-fuchsia-200" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "还没有账号？立即注册" : "已有账号？返回登录"}
              </button>
            )}
            {mode === "login" && (
              <button type="button" className="text-white/42 transition-colors hover:text-fuchsia-200" onClick={() => switchMode("reset")}>忘记密码</button>
            )}
          </div>

          {onPreview && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/[0.07]" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/22">Preview</span>
                <span className="h-px flex-1 bg-white/[0.07]" />
              </div>

              <button
                type="button"
                onClick={onPreview}
                className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-violet-300/15 bg-violet-400/[0.055] text-xs font-medium text-violet-100/70 transition-all hover:border-fuchsia-300/30 hover:bg-fuchsia-400/[0.08] hover:text-white"
              >
                <PlayCircle className="h-4 w-4 transition-transform group-hover:scale-110" />
                暂不登录，先预览工作台
              </button>
              <p className="mt-3 text-center text-[9px] leading-4 text-white/25">预览模式仅展示当前视觉效果，不会创建游客账号</p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
        active
          ? "bg-gradient-to-r from-violet-500/25 to-fuchsia-500/20 text-white shadow-[0_0_16px_rgba(168,85,247,.10)]"
          : "text-white/35 hover:text-white/65"
      }`}
    >
      {children}
    </button>
  );
}
