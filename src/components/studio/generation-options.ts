export type GenerationQuality = "1K" | "2K" | "4K";

export type GenerationParameters = {
  model: string;
  aspectRatio: string;
  quality: GenerationQuality;
  costCredits: number;
};

export type GenerationSubmission = {
  prompt: string;
  referenceImages: string[];
  parameters: GenerationParameters;
};

export type GenerationPrefill = GenerationSubmission & {
  nonce: number;
};

export type ModelOption = {
  value: string;
  name: string;
  tag: string;
  tagClassName: string;
  costCredits: number;
  description: string;
  summary: string;
  recommended?: boolean;
};

export type ParameterOption<T extends string = string> = {
  value: T;
  label: string;
  description: string;
  previewWidth?: number;
  previewHeight?: number;
};

export const MODEL_OPTIONS: ModelOption[] = [
  {
    value: "gpt-image-2-pro",
    name: "GPT-IMAGE-2.0 Pro",
    tag: "★ 最火/推荐",
    tagClassName: "border-rose-400/25 bg-rose-400/15 text-rose-600 dark:text-rose-300",
    costCredits: 28,
    description: "OPENAI 最新图像模型 · 2K / 4K 在线",
    summary: "旗舰推荐模型",
    recommended: true,
  },
  {
    value: "gpt-image-2-vip",
    name: "GPT-Image-2-VIP",
    tag: "★ 高质量",
    tagClassName: "border-amber-400/25 bg-amber-400/15 text-amber-700 dark:text-amber-300",
    costCredits: 28,
    description: "OpenAI 新一代图像生成，画面细节稳定",
    summary: "高质量生成模型",
  },
  {
    value: "nano-banana-2",
    name: "NanoBanana2",
    tag: "◆ 推荐",
    tagClassName: "border-emerald-400/25 bg-emerald-400/15 text-emerald-700 dark:text-emerald-300",
    costCredits: 25,
    description: "2K · 4K 高清，支持多张参考图",
    summary: "高清参考图模型",
  },
  {
    value: "nano-banana-pro",
    name: "NanoBanana Pro",
    tag: "♛ 增强",
    tagClassName: "border-amber-400/25 bg-amber-400/15 text-amber-700 dark:text-amber-300",
    costCredits: 58,
    description: "专业级高清，适合复杂商品与场景构图",
    summary: "专业增强模型",
  },
  {
    value: "nano-banana",
    name: "NanoBanana",
    tag: "快速",
    tagClassName: "border-slate-400/20 bg-slate-400/10 text-slate-600 dark:text-slate-300",
    costCredits: 18,
    description: "轻量一致性图生图，适合快速预览",
    summary: "快速创作模型",
  },
];

export const ASPECT_RATIO_OPTIONS: ParameterOption[] = [
  { value: "auto", label: "auto", description: "自动", previewWidth: 22, previewHeight: 22 },
  { value: "1:1", label: "1:1", description: "方形", previewWidth: 22, previewHeight: 22 },
  { value: "16:9", label: "16:9", description: "横版", previewWidth: 34, previewHeight: 19 },
  { value: "9:16", label: "9:16", description: "竖版", previewWidth: 16, previewHeight: 28 },
  { value: "4:3", label: "4:3", description: "横版", previewWidth: 32, previewHeight: 24 },
  { value: "3:4", label: "3:4", description: "竖版", previewWidth: 21, previewHeight: 28 },
  { value: "21:9", label: "21:9", description: "影院", previewWidth: 36, previewHeight: 15 },
  { value: "3:2", label: "3:2", description: "横版", previewWidth: 32, previewHeight: 21 },
  { value: "2:3", label: "2:3", description: "竖版", previewWidth: 19, previewHeight: 28 },
  { value: "5:4", label: "5:4", description: "横版", previewWidth: 31, previewHeight: 25 },
  { value: "4:5", label: "4:5", description: "竖版", previewWidth: 22, previewHeight: 28 },
];

export const QUALITY_OPTIONS: ParameterOption<GenerationQuality>[] = [
  { value: "1K", label: "1K", description: "标准输出" },
  { value: "2K", label: "2K", description: "高清输出" },
  { value: "4K", label: "4K", description: "超清输出" },
];

export const DEFAULT_GENERATION_PARAMETERS: GenerationParameters = {
  model: MODEL_OPTIONS[0].value,
  aspectRatio: "1:1",
  quality: "2K",
  costCredits: MODEL_OPTIONS[0].costCredits,
};

export function getModelOption(model: string | null | undefined): ModelOption {
  const configured = MODEL_OPTIONS.find((option) => option.value === model);
  if (configured || !model) return configured ?? MODEL_OPTIONS[0];

  return {
    ...MODEL_OPTIONS[0],
    value: model,
    name: model,
    tag: "历史任务",
    tagClassName: "border-slate-400/20 bg-slate-400/10 text-slate-600 dark:text-slate-300",
    description: "从历史任务恢复的模型配置",
    summary: "已恢复任务模型",
    recommended: false,
  };
}

function getString(value: unknown, fallback: string): string {
  return typeof value === "string" && value ? value : fallback;
}

export function restoreGenerationParameters(
  modelKey?: string,
  inputParams?: Record<string, unknown>,
): GenerationParameters {
  const model = getModelOption(modelKey);
  const qualityValue = getString(inputParams?.quality, DEFAULT_GENERATION_PARAMETERS.quality);
  const quality = QUALITY_OPTIONS.some((option) => option.value === qualityValue)
    ? (qualityValue as GenerationQuality)
    : DEFAULT_GENERATION_PARAMETERS.quality;
  const clientCost = inputParams?.costCredits;

  return {
    model: model.value,
    aspectRatio: getString(inputParams?.aspectRatio, DEFAULT_GENERATION_PARAMETERS.aspectRatio),
    // Concrete pixels will be derived server-side from aspectRatio + quality.
    quality,
    costCredits:
      typeof clientCost === "number" && Number.isFinite(clientCost)
        ? clientCost
        : model.costCredits,
  };
}
