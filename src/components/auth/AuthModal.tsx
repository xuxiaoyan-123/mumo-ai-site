import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, PlayCircle, ShieldCheck, Sparkles } from "lucide-react";

type Mode = "login" | "register" | "reset";

const endpointByMode: Record<Mode, string> = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  reset: "/api/auth/request-password-reset",
};

const titleByMode: Record<Mode, string> = {
  login: "欢迎回到沐莫",
  register: "开启你的视觉创作",
  reset: "找回你的账号",
};

const subtitleByMode: Record<Mode, string> = {
  login: "登录后继续完成商品视觉与电商内容创作",
  register: "创建账号，体验更完整的电商视觉工作流",
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
        body: JSON.stringify(mode === "reset" ? { email: normalizedEmail } : { email: normalizedEmail, password }),
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
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-700/16 p-4 backdrop-blur-[10px] dark:bg-[#09111b]/72">
      <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,.88),transparent_34%),radial-gradient(circle_at_82%_78%,rgba(173,193,214,.32),transparent_38%)] dark:bg-[radial-gradient(circle_at_18%_16%,rgba(115,140,168,.10),transparent_34%),radial-gradient(circle_at_82%_78%,rgba(197,169,111,.045),transparent_38%)]" />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="mumo-auth-title"
        className="relative w-full max-w-[430px] overflow-hidden rounded-[30px] border border-white/80 bg-white/62 p-1 shadow-[0_32px_90px_-34px_rgba(43,59,78,.48)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#172333]/78 dark:shadow-[0_34px_95px_-32px_rgba(0,0,0,.82)]"
      >
        <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#bda36d]/55 to-transparent" />
        <div className="relative rounded-[26px] border border-white/65 bg-gradient-to-b from-white/52 to-slate-100/28 px-5 py-6 dark:border-white/[0.07] dark:from-white/[0.045] dark:to-transparent sm:px-7 sm:py-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/85 bg-gradient-to-br from-slate-700 to-slate-950 text-white shadow-[0_12px_26px_-16px_rgba(30,41,59,.7)]">
                <Sparkles className="h-[18px] w-[18px] text-[#ead7ad]" />
              </span>
              <div>
                <p className="text-sm font-semibold tracking-[0.16em] text-slate-900 dark:text-slate-100">沐莫</p>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Mumo Visual Studio</p>
              </div>
            </div>
            <span className="rounded-full border border-[#bca16b]/20 bg-[#eadfc8]/32 px-2.5 py-1 text-[9px] text-[#806a43]">
              电商视觉预览
            </span>
          </div>

          <div className="mt-7">
            <h2 id="mumo-auth-title" className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{titleByMode[mode]}</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{subtitleByMode[mode]}</p>
          </div>

          {mode !== "reset" && (
            <div className="mt-6 grid grid-cols-2 rounded-xl border border-white/80 bg-slate-200/38 p-1 shadow-inner dark:border-white/10 dark:bg-black/15">
              <ModeButton active={mode === "login"} onClick={() => switchMode("login")}>登录</ModeButton>
              <ModeButton active={mode === "register"} onClick={() => switchMode("register")}>注册</ModeButton>
            </div>
          )}

          <form className="mt-4 space-y-3" onSubmit={submit} noValidate>
            <label className="group relative block">
              <span className="sr-only">邮箱</span>
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-700" />
              <input
                className="h-12 w-full rounded-xl border border-white/85 bg-white/58 pl-10 pr-3 text-sm text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400/45 focus:bg-white/82 focus:shadow-[0_0_0_3px_rgba(71,85,105,.06)] dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-slate-500/50 dark:focus:bg-white/[0.065]"
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
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-slate-700" />
                <input
                  className="h-12 w-full rounded-xl border border-white/85 bg-white/58 pl-10 pr-11 text-sm text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-slate-400/45 focus:bg-white/82 focus:shadow-[0_0_0_3px_rgba(71,85,105,.06)] dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-slate-500/50 dark:focus:bg-white/[0.065]"
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
                  className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100/70 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>
            )}

            {message && (
              <div aria-live="polite" className="flex items-start gap-2 rounded-xl border border-[#c4aa74]/20 bg-[#eee4cf]/38 px-3 py-2.5 text-[11px] leading-5 text-[#6f5c38]">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <button className="mumo-neon-button flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-transform enabled:hover:scale-[1.01] disabled:opacity-60" type="submit" disabled={submitting}>
              {submitting ? "处理中…" : mode === "reset" ? "获取找回指引" : mode === "register" ? "创建账号" : "进入工作台"}
              {!submitting && <ArrowRight className="h-4 w-4 text-[#ead7ad]" />}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between gap-3 text-[11px]">
            {mode === "reset" ? (
              <button type="button" className="text-slate-500 transition-colors hover:text-slate-900" onClick={() => switchMode("login")}>返回登录</button>
            ) : (
              <button type="button" className="text-slate-500 transition-colors hover:text-slate-900" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
                {mode === "login" ? "还没有账号？立即注册" : "已有账号？返回登录"}
              </button>
            )}
            {mode === "login" && <button type="button" className="text-slate-500 transition-colors hover:text-slate-900" onClick={() => switchMode("reset")}>忘记密码</button>}
          </div>

          {onPreview && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-400/15" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-slate-400">Preview</span>
                <span className="h-px flex-1 bg-slate-400/15" />
              </div>
              <button type="button" onClick={onPreview} className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-400/18 bg-white/42 text-xs font-medium text-slate-600 transition-all hover:border-slate-500/30 hover:bg-white/72 hover:text-slate-900 hover:shadow-sm">
                <PlayCircle className="h-4 w-4 transition-transform group-hover:scale-105" />暂不登录，先预览工作台
              </button>
              <p className="mt-3 text-center text-[9px] leading-4 text-slate-400">预览模式仅展示当前视觉效果，不会创建游客账号</p>
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
      className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${active ? "bg-white/85 text-slate-900 shadow-sm dark:bg-white/[0.10] dark:text-slate-100" : "text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"}`}
    >
      {children}
    </button>
  );
}
