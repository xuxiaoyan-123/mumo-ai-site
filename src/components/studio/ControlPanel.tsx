import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  Eraser,
  ImagePlus,
  Images,
  Maximize2,
  MonitorUp,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
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

const MAX_REFERENCE_IMAGES = 6;

const promptIdeas = [
  "高级电商产品摄影，纯净背景，柔和轮廓光，突出商品材质与细节",
  "现代家居商品场景，自然窗光，低饱和配色，干净留白，商业摄影",
  "轻奢美妆主图，银灰蓝背景，细腻光影，通透材质，高级陈列",
];

export function ControlPanel(_props: Record<string, unknown>) {
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<Array<string | null>>(
    () => Array.from({ length: MAX_REFERENCE_IMAGES }, () => null),
  );
  const [activeReferenceIndex, setActiveReferenceIndex] = useState(0);
  const objectUrlsRef = useRef(new Set<string>());
  const charCount = useMemo(() => prompt.length, [prompt]);
  const referenceCount = referenceImages.filter(Boolean).length;

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => {
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
    };
  }, []);

  const useRandomPrompt = () => {
    const currentIndex = promptIdeas.indexOf(prompt);
    setPrompt(promptIdeas[(currentIndex + 1 + promptIdeas.length) % promptIdeas.length]);
  };

  const setReferenceImage = (index: number, file?: File) => {
    if (!file) return;
    const previousUrl = referenceImages[index];
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      objectUrlsRef.current.delete(previousUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    objectUrlsRef.current.add(nextUrl);
    setReferenceImages((images) => images.map((url, slot) => (slot === index ? nextUrl : url)));
  };

  const removeReferenceImage = (index: number) => {
    const previousUrl = referenceImages[index];
    if (previousUrl) {
      URL.revokeObjectURL(previousUrl);
      objectUrlsRef.current.delete(previousUrl);
    }
    setReferenceImages((images) => images.map((url, slot) => (slot === index ? null : url)));
  };

  return (
    <aside className="relative flex min-h-[640px] flex-col gap-2.5 overflow-hidden rounded-2xl border border-white/55 bg-white/20 p-3.5 backdrop-blur-xl transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#101925]/48 lg:h-full lg:min-h-0 lg:p-4">
      <PanelSection
        icon={<Images className="h-4 w-4" />}
        title="参考图"
        description="逐张添加商品、场景或风格参考"
        compact
        trailing={
          <span className="rounded-full border border-[#b89a61]/20 bg-[#eadfc8]/35 px-2 py-1 text-[9px] text-[#806a43]">
            {referenceCount} / {MAX_REFERENCE_IMAGES}
          </span>
        }
      >
        <MainReferenceSlot
          index={activeReferenceIndex}
          url={referenceImages[activeReferenceIndex]}
          onSelect={(file) => setReferenceImage(activeReferenceIndex, file)}
          onRemove={() => removeReferenceImage(activeReferenceIndex)}
        />
        <div className="mt-2 flex items-center gap-1.5">
          {referenceImages.map((url, index) => (
            <ReferenceThumbnail
              key={index}
              index={index}
              url={url}
              active={index === activeReferenceIndex}
              onClick={() => setActiveReferenceIndex(index)}
            />
          ))}
          <span className="ml-auto whitespace-nowrap text-[8px] text-slate-400 dark:text-slate-500">点击切换</span>
        </div>
      </PanelSection>

      <PanelSection
        icon={<SlidersHorizontal className="h-4 w-4" />}
        title="基础参数"
        description="设置模型与画面规格"
        compact
      >
        <div className="grid grid-cols-[1.35fr_1fr_1fr] gap-2">
          <div className="min-w-0">
            <FieldLabel label="模型" />
            <SelectShell value="沐莫 · 电商视觉模型" compact />
          </div>
          <div>
            <FieldLabel label="尺寸比例" />
            <SelectShell value="1:1（主图）" compact />
          </div>
          <div>
            <FieldLabel label="像素尺寸" />
            <SelectShell value="2048 × 2048" compact />
          </div>
        </div>
      </PanelSection>

      <PanelSection
        icon={<WandSparkles className="h-4 w-4" />}
        title="提示词输入"
        description="描述商品主体、场景、光影与构图"
        trailing={
          <button type="button" disabled className="flex items-center gap-1.5 rounded-full border border-slate-400/20 bg-white/45 px-2.5 py-1 text-[10px] text-slate-500 disabled:opacity-80 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-400">
            <Bot className="h-3 w-3" />AI 助手
          </button>
        }
      >
        <div className="relative rounded-xl border border-white/80 bg-white/50 shadow-inner transition-colors focus-within:border-slate-400/45 dark:border-white/10 dark:bg-[#111c2a]/72 dark:focus-within:border-slate-500/45">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 1000))}
            placeholder="例如：白色香薰瓶置于浅灰石材台面，柔和侧光，简洁高级的电商主图…"
            className="h-28 w-full resize-none bg-transparent px-3.5 py-3 text-xs leading-5 text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
          <div className="flex items-center justify-between border-t border-slate-400/10 px-3 py-1.5 dark:border-white/[0.07]">
            <span className="font-mono text-[9px] text-slate-400">{charCount} / 1000</span>
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
          className="mumo-neon-button mt-2.5 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-90"
        >
          <WandSparkles className="h-4 w-4 text-[#ead8ae]" />开始视觉创作
          <span className="text-[9px] font-normal text-white/55">准备中</span>
        </button>
      </PanelSection>
    </aside>
  );
}

function PanelSection({ icon, title, description, trailing, compact = false, children }: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`mumo-panel shrink-0 rounded-2xl ${compact ? "p-3" : "p-3.5"}`}>
      <div className={`flex items-center gap-2.5 ${compact ? "mb-2" : "mb-3"}`}>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/80 bg-white/55 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-wide text-slate-800 dark:text-slate-100">{title}</h2>
          {description && <p className="mt-0.5 truncate text-[9px] text-slate-400 dark:text-slate-500">{description}</p>}
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
      <label className="text-[10px] font-medium text-slate-600 dark:text-slate-300">{label}</label>
      {hint && <span className="text-[9px] text-slate-400 dark:text-slate-500">{hint}</span>}
    </div>
  );
}

function SelectShell({ value, compact = false }: { value: string; compact?: boolean }) {
  return (
    <button type="button" className={`flex w-full items-center justify-between rounded-xl border border-white/80 bg-white/48 px-3 text-left text-slate-600 shadow-sm transition-colors hover:bg-white/75 dark:border-white/10 dark:bg-white/[0.045] dark:text-slate-300 dark:hover:bg-white/[0.075] ${compact ? "h-10 text-[10px]" : "h-11 text-[11px]"}`}>
      <span className="flex min-w-0 items-center gap-2 truncate">
        {compact ? <Maximize2 className="h-3 w-3 shrink-0 text-slate-400" /> : <MonitorUp className="h-3.5 w-3.5 shrink-0 text-[#9b8150]" />}
        <span className="truncate">{value}</span>
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
    </button>
  );
}

function MainReferenceSlot({ index, url, onSelect, onRemove }: {
  index: number;
  url: string | null;
  onSelect: (file?: File) => void;
  onRemove: () => void;
}) {
  if (!url) {
    return (
      <label className="group relative flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-400/28 bg-white/34 text-slate-400 transition-all hover:border-slate-500/50 hover:bg-white/68 hover:text-slate-600 dark:border-slate-500/30 dark:bg-white/[0.035] dark:text-slate-500 dark:hover:border-slate-400/45 dark:hover:bg-white/[0.065] dark:hover:text-slate-300">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/80 bg-white/55 shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
          <ImagePlus className="h-4 w-4" />
        </span>
        <span className="text-[9px]">添加主参考图 · 槽位 {index + 1}</span>
        <span className="text-[8px] text-slate-300 dark:text-slate-600">仅当前页面临时预览</span>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            onSelect(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
    );
  }

  return (
    <div className="group relative h-24 overflow-hidden rounded-xl border border-white/90 bg-slate-100 shadow-sm dark:border-white/10 dark:bg-slate-800">
      <img src={url} alt={`参考图 ${index + 1}`} className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/55 via-transparent to-transparent" />
      <span className="absolute left-1.5 top-1.5 rounded-md bg-white/78 px-1.5 py-0.5 text-[8px] font-medium text-slate-600 backdrop-blur">
        {index + 1}
      </span>
      <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1">
        <label className="flex cursor-pointer items-center gap-1 rounded-md bg-slate-900/68 px-2 py-1 text-[8px] text-white/85 backdrop-blur transition-colors hover:bg-slate-900/82">
          <RefreshCw className="h-2.5 w-2.5" />替换
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              onSelect(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <button
          type="button"
          title={`删除参考图 ${index + 1}`}
          onClick={onRemove}
          className="flex items-center gap-1 rounded-md bg-white/82 px-2 py-1 text-[8px] text-slate-600 backdrop-blur transition-colors hover:text-red-500"
        >
          <Trash2 className="h-2.5 w-2.5" />删除
        </button>
      </div>
    </div>
  );
}

function ReferenceThumbnail({ index, url, active, onClick }: {
  index: number;
  url: string | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={url ? `查看参考图 ${index + 1}` : `选择空槽位 ${index + 1}`}
      onClick={onClick}
      className={`relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-[8px] transition-all ${
        active
          ? "border-slate-700/45 bg-white/80 text-slate-700 shadow-sm dark:border-[#c5a96f]/35 dark:bg-white/[0.10] dark:text-slate-200"
          : "border-slate-300/30 bg-white/35 text-slate-400 hover:bg-white/65 dark:border-white/[0.08] dark:bg-white/[0.035] dark:text-slate-500"
      }`}
    >
      {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : index + 1}
      {url && active && <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-slate-700/35 dark:ring-[#c5a96f]/30" />}
    </button>
  );
}

function PromptAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-300">
      {children}{label}
    </button>
  );
}
