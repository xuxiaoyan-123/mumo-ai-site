import { useMemo, useState } from "react";
import {
  Bot,
  ChevronDown,
  Eraser,
  ImagePlus,
  Lightbulb,
  Maximize2,
  MonitorUp,
  PackageOpen,
  Palette,
  Scissors,
  Sparkles,
  WandSparkles,
} from "lucide-react";

export type GenProgress = {
  stage: "submitting" | "queued" | "rendering" | "polling";
  attempt: number;
  elapsedSec: number;
  taskId?: string;
  message?: string;
  initialPos?: number;
  renderBudget?: number;
};

const inspirationCards = [
  { label: "电商主图", background: "from-slate-200 via-white to-blue-100" },
  { label: "商品场景", background: "from-stone-200 via-amber-50 to-slate-300" },
  { label: "质感静物", background: "from-zinc-300 via-slate-100 to-stone-200" },
  { label: "清透美妆", background: "from-rose-100 via-white to-sky-100" },
];

const promptIdeas = [
  "高级电商产品摄影，纯净背景，柔和轮廓光，突出商品材质与细节",
  "现代家居商品场景，自然窗光，低饱和配色，干净留白，商业摄影",
  "轻奢美妆主图，银灰蓝背景，细腻光影，通透材质，高级陈列",
];

export function ControlPanel(_props: Record<string, unknown>) {
  const [prompt, setPrompt] = useState("");
  const [activeStyle, setActiveStyle] = useState(0);
  const charCount = useMemo(() => prompt.length, [prompt]);

  const useRandomPrompt = () => {
    const currentIndex = promptIdeas.indexOf(prompt);
    setPrompt(promptIdeas[(currentIndex + 1 + promptIdeas.length) % promptIdeas.length]);
  };

  return (
    <aside className="scrollbar-thin relative flex min-h-[640px] flex-col gap-3 overflow-y-auto border-r border-slate-500/10 bg-white/20 p-3 backdrop-blur-xl lg:h-full lg:min-h-0 lg:p-3.5">
      <PanelSection
        icon={<Palette className="h-4 w-4" />}
        title="创作参数"
        description="为电商视觉匹配画面规格"
      >
        <FieldLabel label="模型选择" hint="商品视觉优化" />
        <SelectShell value="沐莫 · 电商视觉模型" />

        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div>
            <FieldLabel label="比例选择" />
            <SelectShell value="1:1（主图）" compact />
          </div>
          <div>
            <FieldLabel label="像素选择" />
            <SelectShell value="2048 × 2048" compact />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <FeatureChip icon={<Scissors className="h-3.5 w-3.5" />} label="智能抠图" />
          <FeatureChip icon={<PackageOpen className="h-3.5 w-3.5" />} label="批量处理" />
          <FeatureChip icon={<Sparkles className="h-3.5 w-3.5" />} label="模板丰富" />
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <Lightbulb className="h-3.5 w-3.5 text-[#a4874f]" />灵感模板
            </div>
            <p className="mt-1 text-[10px] text-slate-400">选择适合商品的视觉方向</p>
          </div>
          <span className="rounded-full border border-[#b89a61]/20 bg-[#eadfc8]/35 px-2 py-1 text-[9px] text-[#806a43]">
            精选模板
          </span>
        </div>

        <div className="mt-2.5 grid grid-cols-4 gap-2">
          {inspirationCards.map((card, index) => (
            <button
              key={card.label}
              type="button"
              onClick={() => setActiveStyle(index)}
              className={`group relative aspect-[1.15/1] overflow-hidden rounded-xl border text-left transition-all ${
                activeStyle === index
                  ? "border-slate-700/45 shadow-[0_8px_20px_-14px_rgba(30,41,59,.6)]"
                  : "border-white/75 hover:border-slate-400/40"
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.background} transition-transform duration-500 group-hover:scale-105`} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_25%,rgba(255,255,255,.85),transparent_18%),linear-gradient(to_top,rgba(42,55,72,.38),transparent_70%)]" />
              <span className="absolute inset-x-1 bottom-1 truncate text-center text-[8px] font-medium text-white">
                {card.label}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3">
          <FieldLabel label="参考图" hint="按槽位独立管理 · 最多 4 张" />
          <div className="grid grid-cols-4 gap-2">
            {[0, 1, 2, 3].map((slot) => <ReferenceSlot key={slot} index={slot} />)}
          </div>
        </div>
      </PanelSection>

      <PanelSection
        icon={<WandSparkles className="h-4 w-4" />}
        title="提示词输入"
        trailing={
          <button type="button" disabled className="flex items-center gap-1.5 rounded-full border border-slate-400/20 bg-white/45 px-2.5 py-1 text-[10px] text-slate-500 disabled:opacity-80">
            <Bot className="h-3 w-3" />AI 助手
          </button>
        }
      >
        <div className="relative rounded-xl border border-white/80 bg-white/50 shadow-inner transition-colors focus-within:border-slate-400/45">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 1000))}
            placeholder="描述商品、使用场景、光影与期望的画面风格…"
            className="h-20 w-full resize-none bg-transparent px-3.5 py-3 text-xs leading-5 text-slate-700 outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between border-t border-slate-400/10 px-3 py-1.5">
            <span className="font-mono text-[9px] text-slate-400">{charCount} / 1000</span>
            <div className="flex items-center gap-1">
              <PromptAction label="清空" onClick={() => setPrompt("")}><Eraser className="h-3 w-3" /></PromptAction>
              <PromptAction label="灵感词" onClick={useRandomPrompt}><Sparkles className="h-3 w-3" /></PromptAction>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled
          title="生成功能正在准备中"
          className="mumo-neon-button mt-2.5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-90"
        >
          <WandSparkles className="h-4 w-4 text-[#ead8ae]" />开始视觉创作
          <span className="text-[9px] font-normal text-white/55">准备中</span>
        </button>
      </PanelSection>
    </aside>
  );
}

function PanelSection({ icon, title, description, trailing, children }: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mumo-panel rounded-2xl p-3.5">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/80 bg-white/55 text-slate-700 shadow-sm">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-wide text-slate-800">{title}</h2>
          {description && <p className="mt-0.5 text-[9px] text-slate-400">{description}</p>}
        </div>
        {trailing}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-center justify-between gap-2">
      <label className="text-[10px] font-medium text-slate-600">{label}</label>
      {hint && <span className="text-[9px] text-slate-400">{hint}</span>}
    </div>
  );
}

function SelectShell({ value, compact = false }: { value: string; compact?: boolean }) {
  return (
    <button type="button" className={`flex w-full items-center justify-between rounded-xl border border-white/80 bg-white/48 px-3 text-left text-slate-600 shadow-sm transition-colors hover:bg-white/75 ${compact ? "h-9 text-[9px]" : "h-10 text-[11px]"}`}>
      <span className="flex min-w-0 items-center gap-2 truncate">
        {compact ? <Maximize2 className="h-3 w-3 shrink-0 text-slate-400" /> : <MonitorUp className="h-3.5 w-3.5 shrink-0 text-[#9b8150]" />}
        <span className="truncate">{value}</span>
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
    </button>
  );
}

function FeatureChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded-lg border border-white/75 bg-white/35 px-2 py-2 text-[9px] text-slate-500">
      <span className="text-[#9b8150]">{icon}</span>{label}
    </div>
  );
}

function ReferenceSlot({ index }: { index: number }) {
  return (
    <button type="button" title={`上传参考图 ${index + 1}`} className="group flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-400/25 bg-white/32 text-slate-400 transition-all hover:border-slate-500/45 hover:bg-white/60 hover:text-slate-600">
      <ImagePlus className="h-3.5 w-3.5" />
      <span className="text-[8px]">{index === 0 ? "上传" : `图 ${index + 1}`}</span>
    </button>
  );
}

function PromptAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700">
      {children}{label}
    </button>
  );
}
