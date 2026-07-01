export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <h2 className="text-xl font-semibold">账户设置</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          头像上传、资料修改与密码设置将在沐莫账户服务和 R2 上传接口完成后开放。
        </p>
        <button
          type="button"
          className="mt-6 rounded-lg border border-border px-4 py-2"
          onClick={() => onOpenChange(false)}
        >
          关闭
        </button>
      </section>
    </div>
  );
}
