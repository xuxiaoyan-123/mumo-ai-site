import { Headphones, Mail, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMumoFrontendConfig } from "./AnnouncementCenter";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

export function ContactDialog({ open, onOpenChange }: Props) {
  const { config } = useMumoFrontendConfig();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm border-white/70 bg-white/90 p-6 shadow-[0_24px_70px_-38px_rgba(30,41,59,.45)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#172231]/95">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-[#c5a96f]/25 bg-[#e7d9bb]/25 text-[#8d7344] dark:border-[#d2ba86]/20 dark:bg-[#d2ba86]/10 dark:text-[#d8c18f]">
            <Headphones className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg text-slate-900 dark:text-slate-100">在线客服</DialogTitle>
          <DialogDescription className="leading-6">{config.contact.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 pt-2">
          {config.contact.enabled ? (
            <>
              <ContactPlaceholder icon={<MessageCircle className="h-4 w-4" />} label="微信客服" value={config.contact.wechat} />
              <ContactPlaceholder icon={<Mail className="h-4 w-4" />} label="邮箱支持" value={config.contact.email} />
              <p className="px-1 pt-1 text-xs text-slate-400">服务时间：{config.contact.serviceHours}</p>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-300/50 py-8 text-center text-sm text-slate-400 dark:border-white/10">客服暂未开放</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ContactPlaceholder({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-300/40 bg-white/50 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/80 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400">{icon}</span>
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
        <p className="mt-0.5 text-xs text-slate-400">{value}</p>
      </div>
    </div>
  );
}
