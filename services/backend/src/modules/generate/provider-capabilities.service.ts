import { env } from "../../config/env.js";

const klingModelMetadata = {
  "kling-v2.6-std": {
    label: "Kling 2.6 Std",
    supportsCameraControl: true,
    estimatedUnitsPerShot: 1
  },
  "kling-v2.6-pro": {
    label: "Kling 2.6 Pro",
    supportsCameraControl: false,
    estimatedUnitsPerShot: 2
  },
  "kling-v2.5-turbo": {
    label: "Kling 2.5 Turbo",
    supportsCameraControl: false,
    estimatedUnitsPerShot: 1
  },
  "kling-video-o1": {
    label: "Kling O1",
    supportsCameraControl: false,
    estimatedUnitsPerShot: 3
  },
  "kling-video-3.0": {
    label: "Kling Video 3.0",
    supportsCameraControl: true,
    estimatedUnitsPerShot: 2
  },
  "kling-video-3.0-omni": {
    label: "Kling Video 3.0 Omni",
    supportsCameraControl: true,
    estimatedUnitsPerShot: 3
  },
  "kling-3.0-omni": {
    label: "Kling 3.0 Omni",
    supportsCameraControl: true,
    estimatedUnitsPerShot: 3
  },
  "kling-video-o3": {
    label: "Kling Video O3",
    supportsCameraControl: true,
    estimatedUnitsPerShot: 3
  }
} as const;

function formatModelLabel(modelId: string) {
  return modelId
    .replace(/^kling-/, "Kling ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

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
      aspectRatios: env.KLING_SUPPORTED_ASPECT_RATIO_VALUES,
      defaultModel: env.KLING_MODEL,
      models: env.KLING_SUPPORTED_MODEL_VALUES.map((modelId) => {
        const known = klingModelMetadata[modelId as keyof typeof klingModelMetadata];
        return {
          id: modelId,
          label: known?.label ?? formatModelLabel(modelId),
          supportsCameraControl: known?.supportsCameraControl ?? false,
          estimatedUnitsPerShot: known?.estimatedUnitsPerShot ?? 1
        };
      })
    };
  }

  return {
    provider: env.VIDEO_GENERATION_PROVIDER,
    durations: [],
    aspectRatios: [],
    defaultModel: null,
    models: []
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
