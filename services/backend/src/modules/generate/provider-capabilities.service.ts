import { env } from "../../config/env.js";

function normalizeToSupportedValue(value: number, supportedValues: number[]) {
  if (supportedValues.length === 0) {
    return value;
  }

  return supportedValues.reduce((closest, current) => {
    const currentDistance = Math.abs(current - value);
    const closestDistance = Math.abs(closest - value);

    if (currentDistance < closestDistance) {
      return current;
    }

    if (currentDistance === closestDistance) {
      return current < closest ? current : closest;
    }

    return closest;
  }, supportedValues[0]);
}

export function getVideoProviderCapabilities() {
  if (env.VIDEO_GENERATION_PROVIDER === "kling") {
    return {
      provider: "kling",
      durations: env.KLING_SUPPORTED_DURATION_VALUES,
      aspectRatios: env.KLING_SUPPORTED_ASPECT_RATIO_VALUES
    };
  }

  return {
    provider: env.VIDEO_GENERATION_PROVIDER,
    durations: [],
    aspectRatios: []
  };
}

export function normalizeDurationForVideoProvider(durationSeconds: number) {
  if (env.VIDEO_GENERATION_PROVIDER !== "kling") {
    return durationSeconds;
  }

  return normalizeToSupportedValue(durationSeconds, env.KLING_SUPPORTED_DURATION_VALUES);
}

export function normalizeAspectRatioForVideoProvider(aspectRatio?: string | null) {
  if (env.VIDEO_GENERATION_PROVIDER !== "kling" || !aspectRatio) {
    return aspectRatio ?? undefined;
  }

  if (env.KLING_SUPPORTED_ASPECT_RATIO_VALUES.includes(aspectRatio)) {
    return aspectRatio;
  }

  return env.KLING_SUPPORTED_ASPECT_RATIO_VALUES[0] ?? aspectRatio;
}
