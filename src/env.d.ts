import type { D1Database } from "./lib/d1";

export interface VibeLearningImageEnv {
  readonly VIBELEARNING_IMAGE_API_BASE_URL?: string;
  readonly VIBELEARNING_IMAGE_API_KEY?: string;
}

export interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete?(key: string): Promise<unknown>;
}

export interface MumoCloudflareEnv extends VibeLearningImageEnv {
  readonly MUMO_DB?: D1Database;
  readonly MUMO_GENERATED_IMAGES?: R2BucketLike;
  readonly R2_PUBLIC_BASE_URL?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly VIBELEARNING_IMAGE_API_BASE_URL?: string;
      readonly VIBELEARNING_IMAGE_API_KEY?: string;
    }
  }
}
