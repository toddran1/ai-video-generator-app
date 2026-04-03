import { env } from "../../config/env.js";

export type GenerationProfile = "testing" | "production";

export interface ProviderExecutionConfig {
  profile: GenerationProfile;
  model: string;
  durationSeconds: number;
}

export function resolveProviderExecutionConfig(profile: GenerationProfile): ProviderExecutionConfig {
  if (profile === "production") {
    return {
      profile,
      model: env.KLING_PRODUCTION_MODEL || env.KLING_MODEL,
      durationSeconds: env.KLING_PRODUCTION_DURATION_SECONDS || env.KLING_DURATION_SECONDS
    };
  }

  return {
    profile,
    model: env.KLING_TEST_MODEL || env.KLING_MODEL,
    durationSeconds: env.KLING_TEST_DURATION_SECONDS || env.KLING_DURATION_SECONDS
  };
}
