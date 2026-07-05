import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MumoAnnouncement, useMumoFrontendConfig } from "@/components/studio/AnnouncementCenter";

export function AnnouncementsPanel() {
  const { config, updateConfig } = useMumoFrontendConfig();
  const [items, setItems] = useState<MumoAnnouncement[]>(config.announcements);
  const [saved, setSaved] = useState(false);

  useEffect(() => setItems(config.announcements), [config.announcements]);

  const updateItem = (id: string, patch: Partial<MumoAnnouncement>) => {
    setSaved(false);
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const addItem = () => {
    setSaved(false);
    setItems((current) => [
      ...current,
      { id: `announcement-${Date.now()}`, title: "新公告", content: "请输入公告内容", enabled: true, sortOrder: current.length + 1 },
    ]);
  };

  const save = () => {
    updateConfig({ ...config, announcements: items });
    setSaved(true);
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">公告配置</h2>
          <p className="mt-1 text-xs text-muted-foreground">保存后，前台公告弹窗会在当前浏览器中同步更新。</p>
        </div>
        <Button size="sm" variant="outline" onClick={addItem}><Plus className="mr-1.5 h-3.5 w-3.5" />新增公告</Button>
      </div>

      <div className="max-h-[52vh] space-y-3 overflow-auto pr-1">
        {items.map((item) => (
          <div key={item.id} className="grid gap-3 rounded-xl border border-border/60 bg-white/[0.03] p-4 sm:grid-cols-[1fr_110px]">
            <div className="space-y-3">
              <Field label="公告标题"><Input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} /></Field>
              <Field label="公告内容"><Textarea rows={3} value={item.content} onChange={(event) => updateItem(item.id, { content: event.target.value })} /></Field>
            </div>
            <div className="space-y-3">
              <Field label="排序"><Input type="number" value={item.sortOrder} onChange={(event) => updateItem(item.id, { sortOrder: Number(event.target.value) || 0 })} /></Field>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={item.enabled} onChange={(event) => updateItem(item.id, { enabled: event.target.checked })} />启用
              </label>
              <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />移除
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-xs text-emerald-500">已保存到本地配置</span>}
        <Button onClick={save}><Save className="mr-1.5 h-3.5 w-3.5" />保存公告配置</Button>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-[11px] text-muted-foreground"><span>{label}</span>{children}</label>;
}
