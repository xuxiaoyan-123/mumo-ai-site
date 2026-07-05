import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MumoRechargePlan, useMumoFrontendConfig } from "@/components/studio/AnnouncementCenter";

export function RechargePackagesPanel() {
  const { config, updateConfig } = useMumoFrontendConfig();
  const [plans, setPlans] = useState<MumoRechargePlan[]>(config.rechargePlans);
  const [saved, setSaved] = useState(false);

  useEffect(() => setPlans(config.rechargePlans), [config.rechargePlans]);

  const updatePlan = (id: string, patch: Partial<MumoRechargePlan>) => {
    setSaved(false);
    setPlans((current) => current.map((plan) => plan.id === id ? { ...plan, ...patch } : plan));
  };

  const addPlan = () => {
    setSaved(false);
    setPlans((current) => [
      ...current,
      { id: `plan-${Date.now()}`, name: "新套餐", credits: 0, price: "¥ --", recommendedLabel: "", enabled: true },
    ]);
  };

  const save = () => {
    updateConfig({ ...config, rechargePlans: plans });
    setSaved(true);
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">充值套餐配置</h2>
          <p className="mt-1 text-xs text-muted-foreground">仅配置前台展示；所有操作按钮保持暂未开放。</p>
        </div>
        <Button size="sm" variant="outline" onClick={addPlan}><Plus className="mr-1.5 h-3.5 w-3.5" />新增套餐</Button>
      </div>

      <div className="max-h-[52vh] space-y-3 overflow-auto pr-1">
        {plans.map((plan) => (
          <div key={plan.id} className="grid items-end gap-3 rounded-xl border border-border/60 bg-white/[0.03] p-4 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
            <Field label="套餐名称"><Input value={plan.name} onChange={(event) => updatePlan(plan.id, { name: event.target.value })} /></Field>
            <Field label="创作点数量"><Input type="number" min={0} value={plan.credits} onChange={(event) => updatePlan(plan.id, { credits: Math.max(0, Number(event.target.value) || 0) })} /></Field>
            <Field label="价格"><Input value={plan.price} onChange={(event) => updatePlan(plan.id, { price: event.target.value })} /></Field>
            <Field label="推荐标签"><Input value={plan.recommendedLabel} onChange={(event) => updatePlan(plan.id, { recommendedLabel: event.target.value })} placeholder="例如 推荐" /></Field>
            <div className="flex items-center gap-2 pb-2">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground"><input type="checkbox" checked={plan.enabled} onChange={(event) => updatePlan(plan.id, { enabled: event.target.checked })} />启用</label>
              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setPlans((current) => current.filter((entry) => entry.id !== plan.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-emerald-500">已保存到本地配置</span>}
        <Button onClick={save}><Save className="mr-1.5 h-3.5 w-3.5" />保存套餐配置</Button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-[11px] text-muted-foreground"><span>{label}</span>{children}</label>;
}
