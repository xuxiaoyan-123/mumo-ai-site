import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listAnnouncements } from "@/lib/admin.functions";

type Announcement = { id: string; title: string; content: string; sort_order: number };
type Props = { open: boolean; onOpenChange: (open: boolean) => void; autoOpenLatest?: boolean };

export function AnnouncementCenter({ open, onOpenChange }: Props) {
  const fetchAnnouncements = useServerFn(listAnnouncements);
  const [items, setItems] = useState<Announcement[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    setMessage("");
    fetchAnnouncements({})
      .then((rows: unknown) => setItems((rows ?? []) as Announcement[]))
      .catch(() => { setItems([]); setMessage("后台数据服务未配置"); });
  }, [open, fetchAnnouncements]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-white/70 bg-white/90 p-6 backdrop-blur-2xl dark:border-white/10 dark:bg-[#172231]/95">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Bell className="h-5 w-5 text-[#9a7d49]" />公告</DialogTitle><DialogDescription>莫沐AI 的近期动态</DialogDescription></DialogHeader>
        <div className="space-y-2 pt-2">
          {items.map((item) => <article key={item.id} className="rounded-xl border border-slate-300/40 bg-white/50 p-3 dark:border-white/10 dark:bg-white/[0.04]"><h3 className="text-sm font-medium text-slate-700 dark:text-slate-100">{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{item.content}</p></article>)}
          {!items.length && <p className="py-8 text-center text-sm text-slate-400">{message || "暂无公告"}</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
