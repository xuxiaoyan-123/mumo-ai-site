import "@tanstack/react-start/server-only";

import { getStartContext } from "@tanstack/start-storage-context";
import { z } from "zod";

import type { VibeLearningImageEnv } from "../../env";
import { imageGenerationInputSchema } from "../generation.schemas";
import {
  createProviderTaskFailure,
  ImageProviderError,
  type ImageGenerationInput,
  type ImageProvider,
  isImageToImageMode,
  normalizeImageResults,
  normalizeProviderError,
  normalizeTaskStatus,
  type ProviderGenerationMode,
  type ProviderTaskCreated,
  type ProviderTaskResult,
} from "./image-provider.server";

const DEFAULT_API_BASE_URL = "https://image1.vibelearning.top/v1";
const CLOUDFLARE_ENV_GLOBAL_KEY = "__MUMO_CLOUDFLARE_ENV__";

const TASK_PATHS: Record<ProviderGenerationMode, string> = {
  "text-to-image": "/images/generations/tasks",
  "image-to-image": "/images/edits/tasks",
};

const PROVIDER_SIZE_MAP: Readonly<Record<string, string>> = {
  "1:1|1K": "1024x1024",
};

export const vibeLearningTaskRequestSchema = z
  .object({
    model: z.string().min(1),
    prompt: z.string().min(1),
    size: z.string().min(1),
    n: z.literal(1),
    response_format: z.literal("url"),
    output_format: z.literal("webp"),
  })
  .strict();

export const vibeLearningTaskCreatedResponseSchema = z
  .object({
    task_id: z.string().min(1).optional(),
    id: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    data: z
      .object({
        task_id: z.string().min(1).optional(),
        id: z.string().min(1).optional(),
        status: z.string().min(1).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const vibeLearningTaskPollResponseSchema = z
  .object({
    status: z.string().min(1),
    data: z.unknown().optional(),
    error: z.unknown().optional(),
    message: z.unknown().optional(),
    code: z.unknown().optional(),
  })
  .passthrough();

export type VibeLearningProviderOptions = {
  env?: VibeLearningImageEnv;
  fetchImpl?: typeof fetch;
  maxReferenceImages?: number;
};

type ResolvedConfiguration = {
  apiBaseUrl: string;
  apiKey: string;
};

type ExtractedProviderError = {
  message?: string;
  code?: string;
};

function asEnv(value: unknown): VibeLearningImageEnv {
  return value && typeof value === "object" ? (value as VibeLearningImageEnv) : {};
}

function getContextEnv(): VibeLearningImageEnv {
  const startContext = getStartContext({ throwIfNotFound: false });
  const context = startContext?.contextAfterGlobalMiddlewares as
    | { cloudflare?: { env?: unknown }; cloudflareEnv?: unknown }
    | undefined;
  return asEnv(context?.cloudflare?.env ?? context?.cloudflareEnv);
}

function getGlobalEnv(): VibeLearningImageEnv {
  const globalRecord = globalThis as Record<string, unknown>;
  return asEnv(globalRecord[CLOUDFLARE_ENV_GLOBAL_KEY] ?? globalRecord.__env__);
}

function resolveConfiguration(explicitEnv?: VibeLearningImageEnv): ResolvedConfiguration {
  const contextEnv = getContextEnv();
  const globalEnv = getGlobalEnv();
  const processEnv = typeof process === "undefined" ? undefined : process.env;
  const apiKey = String(
    explicitEnv?.VIBELEARNING_IMAGE_API_KEY ??
      contextEnv.VIBELEARNING_IMAGE_API_KEY ??
      globalEnv.VIBELEARNING_IMAGE_API_KEY ??
      processEnv?.VIBELEARNING_IMAGE_API_KEY ??
      "",
  ).trim();

  if (!apiKey) {
    throw new ImageProviderError({
      code: "CONFIGURATION_ERROR",
      message: "VibeLearning 图片 API Key 未配置。",
      retryable: false,
    });
  }

  const configuredBaseUrl = String(
    explicitEnv?.VIBELEARNING_IMAGE_API_BASE_URL ??
      contextEnv.VIBELEARNING_IMAGE_API_BASE_URL ??
      globalEnv.VIBELEARNING_IMAGE_API_BASE_URL ??
      processEnv?.VIBELEARNING_IMAGE_API_BASE_URL ??
      DEFAULT_API_BASE_URL,
  )
    .trim()
    .replace(/\/+$/, "");

  try {
    const url = new URL(configuredBaseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:")
      throw new Error("unsupported protocol");
  } catch (error) {
    throw new ImageProviderError(
      {
        code: "CONFIGURATION_ERROR",
        message: "VibeLearning 图片 API Base URL 配置无效。",
        retryable: false,
      },
      { cause: error },
    );
  }

  return { apiBaseUrl: configuredBaseUrl, apiKey };
}

export function resolveProviderSize(aspectRatio: string, quality: string): string {
  const resolved = PROVIDER_SIZE_MAP[`${aspectRatio.trim()}|${quality.trim()}`];
  if (!resolved) {
    throw new ImageProviderError({
      code: "UNSUPPORTED_PROVIDER_SIZE",
      message: "该比例与质量的供应商尺寸映射尚未确认。",
      retryable: false,
    });
  }
  return resolved;
}

function extractProviderError(payload: unknown): ExtractedProviderError {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") return {};
  const record = payload as Record<string, unknown>;
  const nestedError = record.error;
  const nestedRecord =
    nestedError && !Array.isArray(nestedError) && typeof nestedError === "object"
      ? (nestedError as Record<string, unknown>)
      : undefined;
  const message =
    (typeof nestedError === "string" ? nestedError : undefined) ??
    (typeof nestedRecord?.message === "string" ? nestedRecord.message : undefined) ??
    (typeof record.message === "string" ? record.message : undefined);
  const code =
    (typeof nestedRecord?.code === "string" ? nestedRecord.code : undefined) ??
    (typeof record.code === "string" ? record.code : undefined);
  return { message, code };
}

function createCommonRequest(input: ImageGenerationInput, size: string) {
  return vibeLearningTaskRequestSchema.parse({
    model: input.model,
    prompt: input.prompt,
    size,
    n: input.count,
    response_format: "url",
    output_format: "webp",
  });
}

function createReferenceBlob(image: ImageGenerationInput["referenceImages"][number]): Blob {
  const bytes = Uint8Array.from(image.bytes);
  return new Blob([bytes.buffer], { type: image.mimeType });
}

export class VibeLearningImageProvider implements ImageProvider {
  private readonly explicitEnv?: VibeLearningImageEnv;
  private readonly fetchImpl: typeof fetch;
  private readonly maxReferenceImages?: number;

  constructor(options: VibeLearningProviderOptions = {}) {
    if (
      options.maxReferenceImages !== undefined &&
      (!Number.isInteger(options.maxReferenceImages) || options.maxReferenceImages < 1)
    ) {
      throw new ImageProviderError({
        code: "CONFIGURATION_ERROR",
        message: "VibeLearning 参考图上限必须是正整数。",
        retryable: false,
      });
    }
    this.explicitEnv = options.env;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.maxReferenceImages = options.maxReferenceImages;
  }

  async createTask(input: ImageGenerationInput): Promise<ProviderTaskCreated> {
    const parsedInput = this.parseInput(input);
    return parsedInput.referenceImages.length === 0
      ? this.createTextToImageTask(parsedInput)
      : this.createImageToImageTask(parsedInput);
  }

  async pollTask(task: Pick<ProviderTaskCreated, "taskId" | "mode">): Promise<ProviderTaskResult> {
    return isImageToImageMode(task.mode)
      ? this.pollImageToImageTask(task.taskId)
      : this.pollTextToImageTask(task.taskId);
  }

  async createTextToImageTask(input: ImageGenerationInput): Promise<ProviderTaskCreated> {
    const parsedInput = this.parseInput(input);
    if (parsedInput.referenceImages.length !== 0) {
      throw new ImageProviderError({
        code: "INVALID_PROVIDER_INPUT",
        message: "文生图请求不能包含参考图。",
        retryable: false,
      });
    }

    const size = resolveProviderSize(parsedInput.aspectRatio, parsedInput.quality);
    const request = createCommonRequest(parsedInput, size);
    return this.createProviderTask("text-to-image", JSON.stringify(request), {
      "content-type": "application/json",
    });
  }

  async createImageToImageTask(input: ImageGenerationInput): Promise<ProviderTaskCreated> {
    const parsedInput = this.parseInput(input);
    if (parsedInput.referenceImages.length === 0) {
      throw new ImageProviderError({
        code: "INVALID_PROVIDER_INPUT",
        message: "图生图请求至少需要一张参考图。",
        retryable: false,
      });
    }
    if (
      this.maxReferenceImages !== undefined &&
      parsedInput.referenceImages.length > this.maxReferenceImages
    ) {
      throw new ImageProviderError({
        code: "TOO_MANY_REFERENCE_IMAGES",
        message: `参考图数量超过当前配置上限（${this.maxReferenceImages} 张）。`,
        retryable: false,
      });
    }

    const size = resolveProviderSize(parsedInput.aspectRatio, parsedInput.quality);
    const commonRequest = createCommonRequest(parsedInput, size);
    const formData = new FormData();
    for (const [field, value] of Object.entries(commonRequest)) {
      formData.append(field, String(value));
    }

    const imageField = parsedInput.referenceImages.length === 1 ? "image" : "image[]";
    for (const image of parsedInput.referenceImages) {
      formData.append(imageField, createReferenceBlob(image), image.filename);
    }

    return this.createProviderTask("image-to-image", formData);
  }

  async pollTextToImageTask(taskId: string): Promise<ProviderTaskResult> {
    return this.pollProviderTask("text-to-image", taskId);
  }

  async pollImageToImageTask(taskId: string): Promise<ProviderTaskResult> {
    return this.pollProviderTask("image-to-image", taskId);
  }

  private parseInput(input: ImageGenerationInput): ImageGenerationInput {
    const result = imageGenerationInputSchema.safeParse(input);
    if (!result.success) {
      throw new ImageProviderError({
        code: "INVALID_PROVIDER_INPUT",
        message: "图片生成输入不符合 Provider Schema。",
        retryable: false,
      });
    }
    return result.data;
  }

  private async createProviderTask(
    mode: ProviderGenerationMode,
    body: BodyInit,
    headers?: HeadersInit,
  ): Promise<ProviderTaskCreated> {
    const configuration = resolveConfiguration(this.explicitEnv);
    const payload = await this.requestJson(
      TASK_PATHS[mode],
      {
        method: "POST",
        headers,
        body,
      },
      configuration,
    );
    const parsed = vibeLearningTaskCreatedResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ImageProviderError({
        code: "INVALID_PROVIDER_RESPONSE",
        message: "供应商创建任务响应格式无效。",
        retryable: false,
      });
    }

    const taskId =
      parsed.data.task_id ?? parsed.data.id ?? parsed.data.data?.task_id ?? parsed.data.data?.id;
    if (!taskId) {
      throw new ImageProviderError({
        code: "INVALID_PROVIDER_RESPONSE",
        message: "供应商创建任务响应缺少 task_id。",
        retryable: false,
      });
    }
    const rawStatus = parsed.data.status ?? parsed.data.data?.status ?? "queued";
    return { taskId, mode, status: normalizeTaskStatus(rawStatus) };
  }

  private async pollProviderTask(
    mode: ProviderGenerationMode,
    taskId: string,
  ): Promise<ProviderTaskResult> {
    const normalizedTaskId = taskId.trim();
    if (!normalizedTaskId) {
      throw new ImageProviderError({
        code: "INVALID_PROVIDER_INPUT",
        message: "轮询任务必须提供 taskId。",
        retryable: false,
      });
    }

    const configuration = resolveConfiguration(this.explicitEnv);
    const payload = await this.requestJson(
      `${TASK_PATHS[mode]}/${encodeURIComponent(normalizedTaskId)}`,
      { method: "GET" },
      configuration,
    );
    const parsed = vibeLearningTaskPollResponseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new ImageProviderError({
        code: "INVALID_PROVIDER_RESPONSE",
        message: "供应商任务查询响应格式无效。",
        retryable: false,
      });
    }

    const status = normalizeTaskStatus(parsed.data.status);
    if (status === "completed") {
      return {
        taskId: normalizedTaskId,
        status,
        images: normalizeImageResults(parsed.data.data, "image/webp"),
      };
    }
    if (status === "failed") {
      const extractedError = extractProviderError(parsed.data);
      return createProviderTaskFailure(
        normalizedTaskId,
        extractedError.message ? new Error(extractedError.message) : undefined,
        {
          apiKey: configuration.apiKey,
          providerCode: extractedError.code,
        },
      );
    }
    return { taskId: normalizedTaskId, status, images: [] };
  }

  private async requestJson(
    path: string,
    init: RequestInit,
    configuration: ResolvedConfiguration,
  ): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${configuration.apiKey}`);

    let response: Response;
    try {
      response = await this.fetchImpl(`${configuration.apiBaseUrl}${path}`, {
        ...init,
        headers,
      });
    } catch (error) {
      throw new ImageProviderError(
        normalizeProviderError(error, {
          apiKey: configuration.apiKey,
          fallbackCode: "PROVIDER_NETWORK_ERROR",
          fallbackMessage: "无法连接到 VibeLearning 图片服务。",
          retryable: true,
        }),
        { cause: error },
      );
    }

    if (!response.ok) {
      let errorPayload: unknown;
      try {
        errorPayload = await response.json();
      } catch {
        errorPayload = undefined;
      }
      const extractedError = extractProviderError(errorPayload);
      const message = extractedError.message
        ? new Error(extractedError.message)
        : new Error(`VibeLearning 图片服务返回 HTTP ${response.status}。`);
      throw new ImageProviderError(
        normalizeProviderError(message, {
          apiKey: configuration.apiKey,
          fallbackCode: "PROVIDER_HTTP_ERROR",
          retryable: response.status === 429 || response.status >= 500,
          httpStatus: response.status,
          providerCode: extractedError.code,
        }),
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new ImageProviderError(
        {
          code: "INVALID_PROVIDER_RESPONSE",
          message: "供应商返回了无法解析的 JSON 响应。",
          retryable: false,
        },
        { cause: error },
      );
    }
  }
}

export function createVibeLearningImageProvider(
  options: VibeLearningProviderOptions = {},
): ImageProvider {
  return new VibeLearningImageProvider(options);
}
