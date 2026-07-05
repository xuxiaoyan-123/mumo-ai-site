import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Headphones, Mail, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getContactInfo } from "@/lib/admin.functions";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };
type ContactInfo = { description?: string; wechat?: string; email?: string; serviceHours?: string; enabled?: boolean };

export function ContactDialog({ open, onOpenChange }: Props) {
  const fetchContact = useServerFn(getContactInfo);
  const [contact, setContact] = useState<ContactInfo>({});
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!open) return;
    fetchContact({}).then((value: unknown) => { setContact((value ?? {}) as ContactInfo); setMessage(""); })
      .catch(() => { setContact({}); setMessage("后台数据服务未配置"); });
  }, [open, fetchContact]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-white/70 bg-white/90 p-6 backdrop-blur-2xl dark:border-white/10 dark:bg-[#172231]/95">
        <DialogHeader><div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c5a96f]/25 bg-[#e7d9bb]/25 text-[#8d7344]"><Headphones className="h-5 w-5" /></div><DialogTitle>在线客服</DialogTitle><DialogDescription>{contact.description || message || "如需帮助，请联系我们。"}</DialogDescription></DialogHeader>
        {contact.enabled !== false && !message ? <div className="space-y-2 pt-2"><ContactRow icon={<MessageCircle className="h-4 w-4" />} label="微信客服" value={contact.wechat || "暂未配置"} /><ContactRow icon={<Mail className="h-4 w-4" />} label="邮箱支持" value={contact.email || "暂未配置"} /><p className="px-1 pt-1 text-xs text-slate-400">服务时间：{contact.serviceHours || "暂未配置"}</p></div> : <p className="py-8 text-center text-sm text-slate-400">{message || "客服暂未开放"}</p>}
      </DialogContent>
    </Dialog>
  );
}

function ContactRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-300/40 bg-white/50 p-3 dark:border-white/10 dark:bg-white/[0.04]"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/80 text-slate-500 dark:bg-white/[0.06]">{icon}</span><div><p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p><p className="mt-0.5 text-xs text-slate-400">{value}</p></div></div>;
}
