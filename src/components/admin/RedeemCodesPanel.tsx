import { useMemo, useState } from "react";
import { Ban, CheckCircle2, Copy, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  clearDisabledMumoRedeemCodes,
  deleteMumoRedeemCode,
  generateMumoRedeemCodes,
  MumoRedeemCode,
  updateMumoRedeemCodeStatus,
  useMumoRedeemCodes,
} from "@/lib/mumo-redeem-codes";

export function RedeemCodesPanel() {
  const { records, refresh } = useMumoRedeemCodes();
  const [count, setCount] = useState("10");
  const [credits, setCredits] = useState("200");
  const unusedCodes = useMemo(() => records.filter((record) => record.status === "unused"), [records]);
  const disabledCount = records.filter((record) => record.status === "disabled").length;

  const generate = () => {
    const amount = Number(credits);
    const quantity = Number(count);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 200) {
      toast.info("生成数量请输入 1–200 的整数");
      return;
    }
    if (!Number.isInteger(amount) || amount < 1) {
      toast.info("面额请输入正整数");
      return;
    }
    generateMumoRedeemCodes(quantity, amount);
    toast.success(`已生成 ${quantity} 个 MUMO 兑换码`);
  };

  const copyText = async (value: string, success: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(success);
    } catch {
      toast.error("复制失败，请手动复制");
    }
  };

  const clearDisabled = () => {
    if (disabledCount === 0) return;
    if (!window.confirm(`确认清空 ${disabledCount} 个已禁用兑换码吗？`)) return;
    clearDisabledMumoRedeemCodes();
    toast.success("已清空禁用兑换码");
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-white/[0.03] p-4">
        <Field label="生成数量"><Input type="number" min={1} max={200} value={count} onChange={(event) => setCount(event.target.value)} className="h-9 w-28" /></Field>
        <Field label="每张面额（创作点）"><Input type="number" min={1} value={credits} onChange={(event) => setCredits(event.target.value)} className="h-9 w-36" /></Field>
        <Button onClick={generate}><Plus className="mr-1.5 h-3.5 w-3.5" />生成</Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" disabled={unusedCodes.length === 0} onClick={() => copyText(unusedCodes.map((record) => record.code).join("\n"), `已复制 ${unusedCodes.length} 个未使用兑换码`)}><Copy className="mr-1.5 h-3.5 w-3.5" />复制未使用</Button>
        <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />刷新</Button>
        <Button variant="outline" size="sm" className="text-destructive" disabled={disabledCount === 0} onClick={clearDisabled}><Trash2 className="mr-1.5 h-3.5 w-3.5" />清空已禁用</Button>
      </div>

      <div className="max-h-[50vh] overflow-auto rounded-xl border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>兑换码</TableHead><TableHead className="text-right">面额</TableHead><TableHead>状态</TableHead>
              <TableHead>使用者</TableHead><TableHead>使用时间</TableHead><TableHead>创建时间</TableHead><TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.map((record) => <RedeemCodeRow key={record.id} record={record} onCopy={copyText} />)}
            {records.length === 0 && <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">暂无兑换码，可在上方批量生成</TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">共 {records.length} 个，未使用 {unusedCodes.length} 个；数据仅保存在当前浏览器。</p>
    </section>
  );
}

function RedeemCodeRow({ record, onCopy }: { record: MumoRedeemCode; onCopy: (value: string, success: string) => Promise<void> }) {
  const remove = () => {
    if (!window.confirm(`确认删除兑换码 ${record.code} 吗？`)) return;
    deleteMumoRedeemCode(record.id);
    toast.success("兑换码已删除");
  };
  return (
    <TableRow>
      <TableCell className="font-mono text-xs font-medium">{record.code}</TableCell>
      <TableCell className="text-right font-mono">{record.credits.toLocaleString()} 点</TableCell>
      <TableCell><StatusBadge status={record.status} /></TableCell>
      <TableCell className="text-xs text-muted-foreground">{record.usedBy ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatTime(record.usedAt)}</TableCell>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatTime(record.createdAt)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="复制" onClick={() => onCopy(record.code, "兑换码已复制")}><Copy className="h-3.5 w-3.5" /></Button>
          {record.status !== "used" && (
            <Button variant="ghost" size="icon" className="h-8 w-8" title={record.status === "disabled" ? "启用" : "禁用"} onClick={() => updateMumoRedeemCodeStatus(record.id, record.status === "disabled" ? "unused" : "disabled")}>
              {record.status === "disabled" ? <RotateCcw className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="删除" onClick={remove}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: MumoRedeemCode["status"] }) {
  const styles = status === "unused" ? "bg-emerald-500/15 text-emerald-500" : status === "used" ? "bg-slate-500/15 text-slate-500" : "bg-amber-500/15 text-amber-500";
  const label = status === "unused" ? "未使用" : status === "used" ? "已使用" : "已禁用";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${styles}`}>{status === "unused" && <CheckCircle2 className="h-3 w-3" />}{label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-[11px] text-muted-foreground"><span>{label}</span>{children}</label>;
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleString("zh-CN") : "—";
}
