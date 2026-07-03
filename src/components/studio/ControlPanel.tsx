import { useMemo, useState } from "react";
import {
  Bot,
  ChevronDown,
  Eraser,
  ImagePlus,
  Lightbulb,
  Maximize2,
  MonitorUp,
  Palette,
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
  { label: "梦境光影", background: "from-fuchsia-500 via-violet-600 to-slate-950" },
  { label: "晶体世界", background: "from-cyan-400 via-indigo-600 to-purple-950" },
  { label: "品牌静物", background: "from-rose-400 via-orange-500 to-stone-950" },
  { label: "赛博霓虹", background: "from-blue-500 via-fuchsia-600 to-slate-950" },
  { label: "未来建筑", background: "from-slate-300 via-violet-500 to-slate-950" },
  { label: "东方意境", background: "from-amber-300 via-rose-500 to-indigo-950" },
];

const promptIdeas = [
  "电影感产品摄影，柔和轮廓光，精致材质，深色背景",
  "未来城市夜景，紫粉霓虹，广角构图，丰富空间层次",
  "东方梦境花园，晶莹光点，细腻光影，高级商业视觉",
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
    <aside className="scrollbar-thin relative flex min-h-[720px] flex-col gap-3 overflow-y-auto border-r border-white/[0.07] bg-[#090915]/78 p-3 backdrop-blur-2xl lg:h-full lg:min-h-0 lg:p-4">
      <PanelSection
        icon={<WandSparkles className="h-4 w-4" />}
        title="功能区"
        description="配置本次创作的画面规格"
      >
        <FieldLabel label="模型选择" hint="专业图像创作" />
        <SelectShell value="沐莫 · 灵感创作模型" />

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <FieldLabel label="比例选择" />
            <SelectShell value="16:9（宽屏）" compact />
          </div>
          <div>
            <FieldLabel label="像素选择" />
            <SelectShell value="1920 × 1080" compact />
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Lightbulb className="h-4 w-4 text-fuchsia-300" />灵感生成
            </div>
            <p className="mt-1 text-[11px] text-white/45">选择风格，快速建立画面方向</p>
          </div>
          <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-400/10 px-2 py-1 text-[9px] text-fuchsia-200">
            视觉预览
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {inspirationCards.map((card, index) => (
            <button
              key={card.label}
              type="button"
              onClick={() => setActiveStyle(index)}
              className={`group relative aspect-[1.22/1] overflow-hidden rounded-xl border text-left transition-all ${
                activeStyle === index
                  ? "border-fuchsia-400/80 shadow-[0_0_20px_rgba(217,70,239,0.28)]"
                  : "border-white/10 hover:border-fuchsia-400/45"
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.background} opacity-90 transition-transform duration-500 group-hover:scale-110`} />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.55),transparent_8%),linear-gradient(to_top,rgba(2,2,12,.9),transparent_70%)]" />
              <span className="absolute inset-x-1.5 bottom-1.5 truncate text-center text-[9px] font-medium text-white/90">
                {card.label}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.025] px-3 py-2.5 text-[11px] text-white/50 transition-colors hover:border-fuchsia-400/40 hover:text-fuchsia-200"
        >
          <ImagePlus className="h-3.5 w-3.5" />上传参考图
          <span className="text-white/25">最多 6 张</span>
        </button>
      </PanelSection>

      <PanelSection
        icon={<Palette className="h-4 w-4" />}
        title="提示词输入区"
        trailing={
          <button type="button" disabled className="flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-2.5 py-1 text-[10px] text-fuchsia-200 disabled:opacity-70">
            <Bot className="h-3 w-3" />AI 助手
          </button>
        }
      >
        <div className="relative mt-1 rounded-xl border border-white/10 bg-black/25 transition-colors focus-within:border-fuchsia-400/45">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 1000))}
            placeholder="描述你想生成的画面、主体、氛围与风格…"
            className="h-28 w-full resize-none bg-transparent px-3.5 py-3 text-xs leading-6 text-white outline-none placeholder:text-white/28"
          />
          <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-2">
            <span className="font-mono text-[10px] text-white/30">{charCount} / 1000</span>
            <div className="flex items-center gap-1">
              <PromptAction label="清空" onClick={() => setPrompt("")}><Eraser className="h-3 w-3" /></PromptAction>
              <PromptAction label="随机词" onClick={useRandomPrompt}><Sparkles className="h-3 w-3" /></PromptAction>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled
          title="生成功能正在准备中"
          className="mumo-neon-button mt-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-80"
        >
          <WandSparkles className="h-4 w-4" />功能正在准备中
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
    <section className="mumo-panel rounded-2xl p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-300 shadow-[0_0_18px_rgba(217,70,239,.18)]">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-wide text-white">{title}</h2>
          {description && <p className="mt-0.5 text-[10px] text-white/35">{description}</p>}
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
      <label className="text-[11px] font-medium text-white/70">{label}</label>
      {hint && <span className="text-[9px] text-white/30">{hint}</span>}
    </div>
  );
}

function SelectShell({ value, compact = false }: { value: string; compact?: boolean }) {
  return (
    <button type="button" className={`flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/25 px-3 text-left text-white/75 transition-colors hover:border-fuchsia-400/35 ${compact ? "h-10 text-[10px]" : "h-11 text-xs"}`}>
      <span className="flex min-w-0 items-center gap-2 truncate">
        {compact ? <Maximize2 className="h-3 w-3 shrink-0 text-violet-300" /> : <MonitorUp className="h-3.5 w-3.5 shrink-0 text-fuchsia-300" />}
        <span className="truncate">{value}</span>
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/35" />
    </button>
  );
}

function PromptAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-white/40 transition-colors hover:bg-white/5 hover:text-fuchsia-200">
      {children}{label}
    </button>
  );
}
