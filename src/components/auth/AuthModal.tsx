import { useState, type FormEvent } from "react";

type Mode = "login" | "register" | "reset";

const endpointByMode: Record<Mode, string> = {
  login: "/api/auth/login",
  register: "/api/auth/register",
  reset: "/api/auth/request-password-reset",
};

const titleByMode: Record<Mode, string> = {
  login: "登录沐莫",
  register: "注册沐莫",
  reset: "重置密码",
};

export function AuthModal({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(endpointByMode[mode], {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "reset" ? { email } : { email, password }),
      });
      const payload = await response.json().catch(() => ({})) as { message?: string };
      setMessage(payload.message ?? (response.ok ? "操作完成" : "该功能尚未开放"));
      if (response.ok && mode !== "reset") onSuccess?.();
    } catch {
      setMessage("认证接口暂不可用，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <section className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <p className="text-sm font-medium text-primary">Mumo</p>
        <h2 className="mt-1 text-2xl font-semibold">{titleByMode[mode]}</h2>
        <p className="mt-2 text-sm text-muted-foreground">认证服务正在迁移至沐莫新后端。</p>

        <form className="mt-6 space-y-3" onSubmit={submit}>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
            type="email"
            autoComplete="email"
            placeholder="邮箱"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          {mode !== "reset" && (
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder="密码"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          )}
          <button
            className="w-full rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-60"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "处理中…" : titleByMode[mode]}
          </button>
        </form>

        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}

        <div className="mt-5 flex flex-wrap gap-3 text-sm">
          <button type="button" className="text-primary" onClick={() => setMode("login")}>登录</button>
          <button type="button" className="text-primary" onClick={() => setMode("register")}>注册</button>
          <button type="button" className="text-primary" onClick={() => setMode("reset")}>忘记密码</button>
        </div>
      </section>
    </div>
  );
}
