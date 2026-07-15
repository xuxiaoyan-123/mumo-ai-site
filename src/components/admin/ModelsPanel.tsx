import { useEffect, useState } from "react";
import { Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminCreateModel,
  adminClearProviderCredential,
  adminDeleteModel,
  adminGetProviderConfigurationStatuses,
  adminListModelsConfig,
  adminUpsertProviderCredential,
  adminUpdateModel,
} from "@/lib/admin.functions";

type ModelRow = {
  id?: string;
  model_key: string;
  display_name: string;
  provider: string;
  provider_model: string;
  task_type: string;
  cost_credits: number;
  is_enabled: number;
  sort_order: number;
  description: string | null;
  supported_modes?: string;
  max_reference_images?: number;
};

type ProviderConfigurationStatus = {
  provider: string;
  displayName: string;
  baseUrl: string;
  baseUrlConfigured: boolean;
  apiKeyConfigured: boolean;
  enabled: boolean;
};

const emptyModel = (): ModelRow => ({
  model_key: "",
  display_name: "",
  provider: "mock",
  provider_model: "",
  task_type: "image",
  cost_credits: 0,
  is_enabled: 1,
  sort_order: 0,
  description: "",
  supported_modes: '["text_to_image","image_to_image"]',
  max_reference_images: 5,
});

function parseModes(value?: string) {
  try {
    const modes = JSON.parse(value ?? "[]") as unknown;
    return Array.isArray(modes) ? modes : [];
  } catch {
    return [];
  }
}

export function ModelsPanel() {
  const list = useServerFn(adminListModelsConfig);
  const create = useServerFn(adminCreateModel);
  const update = useServerFn(adminUpdateModel);
  const remove = useServerFn(adminDeleteModel);
  const getProviderStatuses = useServerFn(adminGetProviderConfigurationStatuses);
  const upsertCredential = useServerFn(adminUpsertProviderCredential);
  const clearCredential = useServerFn(adminClearProviderCredential);
  const [rows, setRows] = useState<ModelRow[]>([]);
  const [editing, setEditing] = useState<ModelRow | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<ProviderConfigurationStatus[]>([]);
  const [credentialDrafts, setCredentialDrafts] = useState<Record<string, { baseUrl: string; apiKey: string; isEnabled: boolean }>>({});

  const load = async () => {
    try {
      const [models, statuses] = await Promise.all([
        list({}),
        getProviderStatuses({}),
      ]);
      setRows(models as ModelRow[]);
      setProviderStatuses(statuses as ProviderConfigurationStatus[]);
    } catch (error: any) {
      toast.error(error.message || "加载模型配置失败");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!editing?.model_key.trim() || !editing.display_name.trim()) {
      toast.info("请填写内部模型键和显示名称");
      return;
    }
    try {
      if (editing.id) {
        await update({
          data: {
            id: editing.id,
            display_name: editing.display_name,
            provider: editing.provider,
            provider_model: editing.provider_model,
            cost_credits: editing.cost_credits,
            is_enabled: editing.is_enabled,
            sort_order: editing.sort_order,
            supported_modes: parseModes(editing.supported_modes),
            max_reference_images: editing.max_reference_images,
            description: editing.description,
          },
        });
      } else {
        await create({ data: editing });
      }
      toast.success("模型配置已保存");
      setEditing(null);
      await load();
    } catch (error: any) {
      toast.error(error.message || "保存失败");
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">模型配置</h2>
          <p className="mt-1 text-xs text-muted-foreground">编辑服务端模型、供应商和计费参数。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />刷新</Button>
          <Button size="sm" onClick={() => setEditing(emptyModel())}><Plus className="mr-1.5 h-3.5 w-3.5" />新增模型</Button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {providerStatuses.map((status) => {
          const draft = credentialDrafts[status.provider] ?? { baseUrl: status.baseUrl, apiKey: "", isEnabled: status.enabled };
          return <div key={status.provider} className="border border-border/60 p-3 text-xs">
            <div className="flex items-center justify-between"><span className="font-medium">{status.displayName}</span><span className={status.enabled ? "text-emerald-500" : "text-muted-foreground"}>{status.enabled ? "真实 Provider 已启用" : "真实 Provider 未启用"}</span></div>
            <p className="mt-1 text-muted-foreground">API Key：{status.apiKeyConfigured ? "已配置" : "未配置"}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2"><Input value={draft.baseUrl} placeholder="https://..." onChange={(event) => setCredentialDrafts({ ...credentialDrafts, [status.provider]: { ...draft, baseUrl: event.target.value } })} /><Input type="password" autoComplete="new-password" value={draft.apiKey} placeholder={status.apiKeyConfigured ? "已配置，留空保持不变" : "输入新的 API Key"} onChange={(event) => setCredentialDrafts({ ...credentialDrafts, [status.provider]: { ...draft, apiKey: event.target.value } })} /></div>
            <div className="mt-2 flex items-center justify-between"><label className="flex items-center gap-1"><input type="checkbox" checked={draft.isEnabled} onChange={(event) => setCredentialDrafts({ ...credentialDrafts, [status.provider]: { ...draft, isEnabled: event.target.checked } })} />启用凭证</label><div className="flex gap-2"><Button variant="outline" size="sm" onClick={async () => { if (!confirm("确认清除该供应商 API Key 吗？")) return; try { await clearCredential({ data: { provider: status.provider } }); setCredentialDrafts({ ...credentialDrafts, [status.provider]: { ...draft, apiKey: "" } }); await load(); } catch (error: any) { toast.error(error.message || "清除失败"); } }}>清除密钥</Button><Button size="sm" onClick={async () => { try { await upsertCredential({ data: { provider: status.provider, baseUrl: draft.baseUrl, apiKey: draft.apiKey, isEnabled: draft.isEnabled } }); setCredentialDrafts({ ...credentialDrafts, [status.provider]: { ...draft, apiKey: "" } }); await load(); toast.success("供应商配置已保存"); } catch (error: any) { toast.error(error.message || "保存失败"); } }}>保存</Button></div></div>
          </div>;
        })}
      </div>
      <p className="text-xs text-muted-foreground">本地请通过 .dev.vars 配置；生产环境请通过 Cloudflare Worker Secret 配置。</p>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
            <div className="min-w-0 flex-1"><p className="text-sm font-medium">{row.display_name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{row.model_key} · {row.provider} / {row.provider_model}</p></div>
            <span className="font-mono text-xs">{row.cost_credits} 点</span>
            <span className={`text-xs ${row.is_enabled ? "text-emerald-500" : "text-muted-foreground"}`}>{row.is_enabled ? "启用" : "停用"}</span>
            <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>编辑</Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={async () => { if (!confirm(`确认删除模型 ${row.display_name} 吗？`)) return; try { await remove({ data: { id: row.id } }); await load(); } catch (error: any) { toast.error(error.message || "删除失败"); } }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="grid gap-3 rounded-xl border border-border/60 bg-white/[0.03] p-4 sm:grid-cols-2">
          <Field label="内部模型键"><Input disabled={!!editing.id} value={editing.model_key} onChange={(event) => setEditing({ ...editing, model_key: event.target.value, provider_model: editing.provider_model || event.target.value })} /></Field>
          <Field label="显示名称"><Input value={editing.display_name} onChange={(event) => setEditing({ ...editing, display_name: event.target.value })} /></Field>
          <Field label="供应商"><Input value={editing.provider} onChange={(event) => setEditing({ ...editing, provider: event.target.value })} /></Field>
          <Field label="供应商模型 ID"><Input value={editing.provider_model} onChange={(event) => setEditing({ ...editing, provider_model: event.target.value })} /></Field>
          <Field label="模型说明"><Input value={editing.description ?? ""} onChange={(event) => setEditing({ ...editing, description: event.target.value })} /></Field>
          <Field label="创作点"><Input type="number" min={0} value={editing.cost_credits} onChange={(event) => setEditing({ ...editing, cost_credits: Number(event.target.value) || 0 })} /></Field>
          <Field label="排序"><Input type="number" min={0} value={editing.sort_order} onChange={(event) => setEditing({ ...editing, sort_order: Number(event.target.value) || 0 })} /></Field>
          <Field label="最大参考图"><Input type="number" min={0} max={5} value={editing.max_reference_images ?? 0} onChange={(event) => setEditing({ ...editing, max_reference_images: Number(event.target.value) || 0 })} /></Field>
          <Field label="支持模式"><div className="flex gap-4 text-xs text-foreground">{["text_to_image", "image_to_image"].map((mode) => { const modes = parseModes(editing.supported_modes); return <label key={mode} className="flex items-center gap-1"><input type="checkbox" checked={modes.includes(mode)} onChange={(event) => setEditing({ ...editing, supported_modes: JSON.stringify(event.target.checked ? [...modes, mode] : modes.filter((item) => item !== mode)) })} />{mode === "text_to_image" ? "文生图" : "图生图"}</label>; })}</div></Field>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!editing.is_enabled} onChange={(event) => setEditing({ ...editing, is_enabled: event.target.checked ? 1 : 0 })} />启用</label>
          <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={() => setEditing(null)}>取消</Button><Button onClick={save}><Save className="mr-1.5 h-3.5 w-3.5" />保存</Button></div>
        </div>
      )}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-[11px] text-muted-foreground"><span>{label}</span>{children}</label>;
}
