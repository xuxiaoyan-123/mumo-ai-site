export type GenProgress = {
  stage: "submitting" | "queued" | "rendering" | "polling";
  attempt: number;
  elapsedSec: number;
  taskId?: string;
  message?: string;
  initialPos?: number;
  renderBudget?: number;
};

export function ControlPanel(_props: Record<string, unknown>) {
  return (
    <aside className="flex h-full min-h-72 flex-col justify-center border-r border-border bg-card/60 p-6">
      <p className="text-sm font-medium text-primary">Mumo Studio</p>
      <h2 className="mt-2 text-xl font-semibold">生成控制台正在重建</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        图片上传、模型配置、生成任务与积分扣费将在 D1 和 R2 接口完成后开放。
      </p>
      <button type="button" className="mt-6 rounded-lg border border-border px-4 py-2 text-sm" disabled>
        暂未开放
      </button>
    </aside>
  );
}
