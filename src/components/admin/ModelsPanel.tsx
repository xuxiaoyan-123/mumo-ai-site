import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCreateModel, adminDeleteModel, adminListModelsConfig, adminUpdateModel } from "@/lib/admin.functions";

type ModelRow = { id?: string; model_key: string; display_name: string; provider: string; provider_model: string; task_type: string; cost_credits: number; is_enabled: number; sort_order: number; description: string };
const emptyModel = (): ModelRow => ({ model_key: "", display_name: "", provider: "configured", provider_model: "", task_type: "image", cost_credits: 0, is_enabled: 1, sort_order: 0, description: "" });

export function ModelsPanel() {
  const list = useServerFn(adminListModelsConfig); const create = useServerFn(adminCreateModel); const update = useServerFn(adminUpdateModel); const remove = useServerFn(adminDeleteModel);
  const [rows, setRows] = useState<ModelRow[]>([]); const [editing, setEditing] = useState<ModelRow | null>(null);
  const load = async () => { try { setRows((await list({})) as ModelRow[]); } catch (error: any) { toast.error(error.message || "后台数据服务未配置"); } };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    if (!editing?.model_key.trim() || !editing.display_name.trim()) return toast.info("请填写模型标识和名称");
    try { if (editing.id) await update({ data: editing }); else await create({ data: editing }); toast.success("模型配置已保存"); setEditing(null); await load(); }
    catch (error: any) { toast.error(error.message || "保存失败"); }
  };
  return <section className="space-y-4 rounded-xl border border-border bg-card p-5">
    <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">模型配置</h2><p className="mt-1 text-xs text-muted-foreground">配置模型名称、说明、创作点与启用状态。</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />刷新</Button><Button size="sm" onClick={() => setEditing(emptyModel())}><Plus className="mr-1.5 h-3.5 w-3.5" />新增模型</Button></div></div>
    <div className="space-y-2">{rows.map((row) => <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{row.display_name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.model_key} · {row.description || "暂无说明"}</p></div><span className="font-mono text-xs">{row.cost_credits} 点</span><span className={`text-xs ${row.is_enabled ? "text-emerald-500" : "text-muted-foreground"}`}>{row.is_enabled ? "启用" : "停用"}</span><Button variant="ghost" size="sm" onClick={() => setEditing(row)}>编辑</Button><Button variant="ghost" size="icon" className="text-destructive" onClick={async () => { if (!confirm(`确认删除模型 ${row.display_name} 吗？`)) return; try { await remove({ data: { id: row.id } }); await load(); } catch (error: any) { toast.error(error.message || "删除失败"); } }}><Trash2 className="h-3.5 w-3.5" /></Button></div>)}</div>
    {editing && <div className="grid gap-3 rounded-xl border border-border/60 bg-white/[0.03] p-4 sm:grid-cols-2"><Field label="模型标识"><Input disabled={!!editing.id} value={editing.model_key} onChange={(e) => setEditing({ ...editing, model_key: e.target.value, provider_model: editing.provider_model || e.target.value })} /></Field><Field label="显示名称"><Input value={editing.display_name} onChange={(e) => setEditing({ ...editing, display_name: e.target.value })} /></Field><Field label="模型说明"><Input value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field><Field label="创作点"><Input type="number" min={0} value={editing.cost_credits} onChange={(e) => setEditing({ ...editing, cost_credits: Number(e.target.value) || 0 })} /></Field><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!editing.is_enabled} onChange={(e) => setEditing({ ...editing, is_enabled: e.target.checked ? 1 : 0 })} />启用</label><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>取消</Button><Button onClick={save}><Save className="mr-1.5 h-3.5 w-3.5" />保存</Button></div></div>}
  </section>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1 text-[11px] text-muted-foreground"><span>{label}</span>{children}</label>; }
