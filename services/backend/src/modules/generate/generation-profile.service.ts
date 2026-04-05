import { env } from "../../config/env.js";

export interface ProviderExecutionConfig {
  profile: string;
  model: string;
  durationSeconds: number;
}

export function resolveProviderExecutionConfig(model?: string | null): ProviderExecutionConfig {
  return {
    profile: "selected-model",
    model: model?.trim() || env.KLING_MODEL,
    durationSeconds: env.KLING_DURATION_SECONDS
  };
}
