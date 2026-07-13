import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Cpu,
  Eraser,
  ImagePlus,
  Images,
  RefreshCw,
  Sparkles,
  Trash2,
  WandSparkles,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { ModelPicker } from "./ModelPicker";
import { ParameterPicker } from "./ParameterPicker";
import {
  ASPECT_RATIO_OPTIONS,
  DEFAULT_GENERATION_PARAMETERS,
  QUALITY_OPTIONS,
  getModelOption,
  type GenerationParameters,
  type GenerationPrefill,
  type GenerationSubmission,
} from "./generation-options";
import { usePortalTheme } from "./usePortalTheme";

export type GenProgress = {
  stage: "submitting" | "queued" | "rendering" | "polling";
  attempt: number;
  elapsedSec: number;
  taskId?: string;
  message?: string;
  initialPos?: number;
  renderBudget?: number;
};

export type ControlPanelProps = {
  credits: number;
  generating: boolean;
  retryPrefill: GenerationPrefill | null;
  reusePrefill: GenerationPrefill | null;
  referenceResetToken: number;
  onGenerateStart: (submission: GenerationSubmission) => void;
};

type OpenPicker = "model" | "ratio" | "quality" | null;

const MAX_REFERENCE_IMAGES = 5;

const promptIdeas = [
  "高级电商产品摄影，纯净背景，柔和轮廓光，突出商品材质与细节",
  "现代家居商品场景，自然窗光，低饱和配色，干净留白，商业摄影",
  "轻奢美妆主图，银灰蓝背景，细腻光影，通透材质，高级陈列",
];

function getReferenceSlots(urls: string[] = []) {
  return Array.from(
    { length: MAX_REFERENCE_IMAGES },
    (_, index): string | null => urls[index] ?? null,
  );
}

export function ControlPanel({
  credits,
  generating,
  retryPrefill,
  reusePrefill,
  referenceResetToken,
  onGenerateStart,
}: ControlPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [parameters, setParameters] = useState<GenerationParameters>(DEFAULT_GENERATION_PARAMETERS);
  const [openPicker, setOpenPicker] = useState<OpenPicker>(null);
  const [referenceImages, setReferenceImages] = useState<Array<string | null>>(() =>
    getReferenceSlots(),
  );
  const objectUrlsRef = useRef(new Set<string>());
  const { anchorRef: panelRef, darkMode } = usePortalTheme<HTMLElement>();
  const charCount = prompt.length;
  const referenceCount = referenceImages.filter(Boolean).length;
  const selectedModel = getModelOption(parameters.model);
  const selectedRatio =
    ASPECT_RATIO_OPTIONS.find((option) => option.value === parameters.aspectRatio) ??
    ASPECT_RATIO_OPTIONS[1];
  const selectedQuality =
    QUALITY_OPTIONS.find((option) => option.value === parameters.quality) ?? QUALITY_OPTIONS[1];
  const activePrefill = useMemo(() => {
    if (!retryPrefill) return reusePrefill;
    if (!reusePrefill) return retryPrefill;
    return retryPrefill.nonce >= reusePrefill.nonce ? retryPrefill : reusePrefill;
  }, [retryPrefill, reusePrefill]);

  const releaseObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  const replaceReferenceImages = useCallback(
    (urls: string[] = []) => {
      releaseObjectUrls();
      setReferenceImages(getReferenceSlots(urls.slice(0, MAX_REFERENCE_IMAGES)));
    },
    [releaseObjectUrls],
  );

  useEffect(() => releaseObjectUrls, [releaseObjectUrls]);

  useEffect(() => {
    replaceReferenceImages();
  }, [referenceResetToken, replaceReferenceImages]);

  useEffect(() => {
    if (!activePrefill) return;
    setPrompt(activePrefill.prompt.slice(0, 1000));
    setParameters(activePrefill.parameters);
    replaceReferenceImages(activePrefill.referenceImages);
  }, [activePrefill, replaceReferenceImages]);

  const useRandomPrompt = () => {
    const currentIndex = promptIdeas.indexOf(prompt);
    setPrompt(promptIdeas[(currentIndex + 1 + promptIdeas.length) % promptIdeas.length]);
  };

  const setReferenceImage = (index: number, file?: File) => {
    if (!file) return;
    const previousUrl = referenceImages[index];
    if (previousUrl && objectUrlsRef.current.has(previousUrl)) {
      URL.revokeObjectURL(previousUrl);
      objectUrlsRef.current.delete(previousUrl);
    }
    const nextUrl = URL.createObjectURL(file);
    objectUrlsRef.current.add(nextUrl);
    setReferenceImages((images) => images.map((url, slot) => (slot === index ? nextUrl : url)));
  };

  const removeReferenceImage = (index: number) => {
    const previousUrl = referenceImages[index];
    if (previousUrl && objectUrlsRef.current.has(previousUrl)) {
      URL.revokeObjectURL(previousUrl);
      objectUrlsRef.current.delete(previousUrl);
    }
    setReferenceImages((images) => images.map((url, slot) => (slot === index ? null : url)));
  };

  const startVisualCreation = () => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      toast.info("请先输入画面描述");
      return;
    }

    // Client pricing is display metadata only. The future server flow must read models_config.
    onGenerateStart({
      prompt: normalizedPrompt,
      referenceImages: referenceImages.filter((url): url is string => typeof url === "string"),
      parameters,
    });
  };

  return (
    <aside
      ref={panelRef}
      className="relative grid w-full self-start grid-rows-[auto_auto_minmax(304px,1fr)] gap-3 overflow-hidden rounded-2xl border border-white/55 bg-white/20 p-2.5 backdrop-blur-xl transition-colors duration-300 dark:border-white/[0.06] dark:bg-[#101925]/48 lg:h-full lg:min-h-0 lg:self-stretch lg:grid-rows-[184px_122px_minmax(0,1fr)]"
    >
      <PanelSection
        icon={<Images className="h-4 w-4" />}
        title="参考图"
        description="逐张添加商品、场景或风格参考"
        compact
        className="overflow-hidden"
        trailing={
          <SectionBadge>
            {referenceCount} / {MAX_REFERENCE_IMAGES}
          </SectionBadge>
        }
      >
        <div className="grid grid-cols-5 gap-2">
          {referenceImages.map((url, index) => (
            <CompactReferenceSlot
              key={index}
              index={index}
              url={url}
              onSelect={(file) => setReferenceImage(index, file)}
              onRemove={() => removeReferenceImage(index)}
            />
          ))}
        </div>
      </PanelSection>

      <PanelSection
        icon={<Cpu className="h-4 w-4" />}
        title="生成参数"
        description="模型、画幅与输出质量"
        compact
        className="overflow-visible"
      >
        <div className="grid w-full grid-cols-2 gap-2 [&>button]:w-full [&>div>button]:w-full lg:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 w-full lg:col-span-1">
            <ModelPicker
              open={openPicker === "model"}
              onOpenChange={(open) => setOpenPicker(open ? "model" : null)}
              selected={selectedModel}
              onSelect={(option) => {
                setParameters((current) => ({
                  ...current,
                  model: option.value,
                  costCredits: option.costCredits,
                }));
                setOpenPicker(null);
              }}
              darkMode={darkMode}
            />
          </div>
          <ParameterPicker
            title="比例"
            panelTitle="画面比例"
            open={openPicker === "ratio"}
            onOpenChange={(open) => setOpenPicker(open ? "ratio" : null)}
            selected={selectedRatio}
            options={ASPECT_RATIO_OPTIONS}
            onSelect={(value) => {
              setParameters((current) => ({ ...current, aspectRatio: value }));
              setOpenPicker(null);
            }}
            darkMode={darkMode}
            columns={4}
          />
          <ParameterPicker
            title="质量"
            panelTitle="输出质量"
            open={openPicker === "quality"}
            onOpenChange={(open) => setOpenPicker(open ? "quality" : null)}
            selected={selectedQuality}
            options={QUALITY_OPTIONS}
            onSelect={(value) => {
              setParameters((current) => ({ ...current, quality: value }));
              setOpenPicker(null);
            }}
            darkMode={darkMode}
            columns={3}
            align="end"
            contentClassName="w-[min(250px,calc(100vw-24px))]"
          />
        </div>
      </PanelSection>

      <PanelSection
        icon={<WandSparkles className="h-4 w-4" />}
        title="提示词输入"
        description="描述商品主体、场景、光影与构图"
        className="min-h-0 overflow-hidden"
        bodyClassName="flex min-h-0 flex-1 flex-col"
        trailing={
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 rounded-lg border border-slate-400/20 bg-white/45 px-2 py-1 text-[9px] text-slate-500 disabled:opacity-80 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400"
          >
            <Bot className="h-3 w-3" />
            AI 助手
          </button>
        }
      >
        <div className="relative flex min-h-0 flex-1 flex-col rounded-xl border border-white/80 bg-white/50 shadow-inner transition-colors focus-within:border-slate-400/45 dark:border-white/10 dark:bg-[#111c2a]/72 dark:focus-within:border-slate-500/45">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 1000))}
            placeholder="例如：白色香薰瓶置于浅灰石材台面，柔和侧光，简洁高级的电商主图…"
            className="min-h-[96px] w-full flex-1 resize-none bg-transparent px-3.5 py-3 text-xs leading-5 text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
          <div className="flex items-center justify-between border-t border-slate-400/10 px-3 py-1.5 dark:border-white/[0.07]">
            <span className="font-mono text-[9px] text-slate-400">{charCount} / 1000</span>
            <div className="flex items-center gap-1">
              <PromptAction label="清空" onClick={() => setPrompt("")}>
                <Eraser className="h-3 w-3" />
              </PromptAction>
              <PromptAction label="随机词" onClick={useRandomPrompt}>
                <Sparkles className="h-3 w-3" />
              </PromptAction>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={startVisualCreation}
          disabled={generating}
          title={`开始视觉创作 · 当前余额 ${credits} 点`}
          className="mumo-neon-button mt-2.5 flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white transition-transform enabled:hover:-translate-y-0.5 enabled:active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <WandSparkles className="h-4 w-4 text-[#ead8ae]" />
          <span>{generating ? "生成中…" : "开始视觉创作"}</span>
          <span className="ml-1 flex items-center gap-1 rounded-md border border-[#d8c18f]/20 bg-[#d8c18f]/[0.08] px-1.5 py-0.5 font-mono text-[9px] text-[#ead8ae]">
            <Zap className="h-2.5 w-2.5" />
            {parameters.costCredits} 点
          </span>
        </button>
      </PanelSection>
    </aside>
  );
}

function PanelSection({
  icon,
  title,
  description,
  trailing,
  compact = false,
  className = "",
  bodyClassName = "",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  compact?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`mumo-panel flex min-h-0 flex-col rounded-2xl ${compact ? "p-2.5" : "p-3"} ${className}`}
    >
      <div className={`flex items-center gap-2.5 ${compact ? "mb-1.5" : "mb-2.5"}`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/80 bg-white/55 text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/[0.055] dark:text-slate-300">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
          {description && (
            <p className="mt-0.5 truncate text-[9px] text-slate-400 dark:text-slate-500">
              {description}
            </p>
          )}
        </div>
        {trailing}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg border border-[#b89a61]/20 bg-[#eadfc8]/30 px-2 py-1 font-mono text-[9px] text-[#806a43] dark:border-[#d8c18f]/15 dark:bg-[#d8c18f]/[0.06] dark:text-[#d8c18f]">
      {children}
    </span>
  );
}

function CompactReferenceSlot({
  index,
  url,
  onSelect,
  onRemove,
}: {
  index: number;
  url: string | null;
  onSelect: (file?: File) => void;
  onRemove: () => void;
}) {
  if (!url) {
    return (
      <label className="group relative flex aspect-square w-full min-w-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-400/28 bg-white/34 text-slate-400 transition-colors hover:border-slate-500/50 hover:bg-white/68 hover:text-slate-600 dark:border-slate-500/30 dark:bg-white/[0.03] dark:text-slate-500 dark:hover:border-slate-400/45 dark:hover:bg-white/[0.06] dark:hover:text-slate-300">
        <ImagePlus className="h-4 w-4" />
        <span className="text-[8px]">参考 {index + 1}</span>
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
    <div className="group relative aspect-square w-full min-w-0 overflow-hidden rounded-xl border border-white/90 bg-white/70 p-1.5 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
      <img
        src={url}
        alt={`参考图 ${index + 1}`}
        className="h-full w-full rounded-lg object-contain"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
      <span className="absolute left-1 top-1 rounded bg-white/78 px-1 py-0.5 text-[7px] font-medium text-slate-600 backdrop-blur">
        {index + 1}
      </span>
      <div className="absolute inset-x-1 bottom-1 z-10 flex items-center justify-center gap-1">
        <label className="flex cursor-pointer items-center gap-0.5 rounded bg-slate-900/72 px-1.5 py-1 text-[7px] text-white/90 backdrop-blur transition-colors hover:bg-slate-900/88">
          <RefreshCw className="h-2 w-2" />
          替换
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
          className="flex items-center gap-0.5 rounded bg-white/86 px-1.5 py-1 text-[7px] text-slate-600 backdrop-blur transition-colors hover:text-red-500"
        >
          <Trash2 className="h-2 w-2" />
          删除
        </button>
      </div>
    </div>
  );
}

function PromptAction({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] text-slate-400 transition-colors hover:bg-white/60 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-white/[0.06] dark:hover:text-slate-300"
    >
      {children}
      {label}
    </button>
  );
}
