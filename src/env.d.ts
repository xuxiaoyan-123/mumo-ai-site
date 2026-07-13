export interface VibeLearningImageEnv {
  readonly VIBELEARNING_IMAGE_API_BASE_URL?: string;
  readonly VIBELEARNING_IMAGE_API_KEY?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      readonly VIBELEARNING_IMAGE_API_BASE_URL?: string;
      readonly VIBELEARNING_IMAGE_API_KEY?: string;
    }
  }
}
