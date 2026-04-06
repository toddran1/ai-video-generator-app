import type { ProjectPlanningSettings, ProjectShotPlanItem } from "../../types";

export interface ProjectFormState {
  title: string;
  prompt: string;
  targetShotCount: number;
  defaultBeatDuration: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  styleHint: string;
  negativePrompt: string;
  cameraNotes: string;
  narrativeMode: "3-beat-story" | "5-beat-story" | "fight-scene" | "dialogue-scene" | "reveal-arc";
  autoBeatDescriptions: boolean;
  klingModel: string;
  klingMode: "" | "std" | "pro";
  klingCfgScale: string;
  klingCameraControlType: "" | "simple" | "down_back" | "forward_up" | "right_turn_forward" | "left_turn_forward";
  klingCameraHorizontal: string;
  klingCameraVertical: string;
  klingCameraPan: string;
  klingCameraTilt: string;
  klingCameraRoll: string;
  klingCameraZoom: string;
}

export type DetailTab = "workflow" | "diagnostics";
export type ShotGenerationMode = "generate" | "extend-previous";

export const DEFAULT_BEAT_DURATION = 5;

export const initialFormState: ProjectFormState = {
  title: "",
  prompt: "",
  targetShotCount: 1,
  defaultBeatDuration: DEFAULT_BEAT_DURATION,
  aspectRatio: "16:9",
  styleHint: "",
  negativePrompt: "",
  cameraNotes: "",
  narrativeMode: "3-beat-story",
  autoBeatDescriptions: true,
  klingModel: "kling-video-3.0",
  klingMode: "",
  klingCfgScale: "",
  klingCameraControlType: "",
  klingCameraHorizontal: "",
  klingCameraVertical: "",
  klingCameraPan: "",
  klingCameraTilt: "",
  klingCameraRoll: "",
  klingCameraZoom: ""
};

export const terminalStatuses = new Set(["completed", "failed", "canceled"]);

export const klingCameraControlTypes = [
  { value: "simple", label: "Simple" },
  { value: "down_back", label: "Down Back" },
  { value: "forward_up", label: "Forward Up" },
  { value: "right_turn_forward", label: "Right Turn Forward" },
  { value: "left_turn_forward", label: "Left Turn Forward" }
] as const;

export function createDefaultShotPlan(
  durationSeconds = DEFAULT_BEAT_DURATION,
  shotCount = initialFormState.targetShotCount,
  shotDefaults?: { negativePrompt?: string | null; cameraNotes?: string | null }
): ProjectShotPlanItem[] {
  const normalizedShotCount = Math.min(Math.max(shotCount, 1), 12);
  const baseShots = [
    {
      beatLabel: normalizedShotCount === 1 ? "Clip" : "Intro",
      description: normalizedShotCount === 1 ? "Single clip" : "Establishing shot",
      extendPrompt: ""
    },
    {
      beatLabel: "Continuation",
      description: "Main action beat",
      extendPrompt: "Continue the established action and motion from shot 1."
    },
    {
      beatLabel: "Climax",
      description: "Closing shot",
      extendPrompt: "Carry the sequence forward into the climactic payoff from shot 2."
    }
  ];

  return Array.from({ length: normalizedShotCount }, (_, index) => {
    const fallback = baseShots[Math.min(index, baseShots.length - 1)];
    return {
      shotNumber: index + 1,
      beatLabel: fallback.beatLabel,
      description: fallback.description,
      durationSeconds,
      generationMode: index === 0 ? "generate" : "extend-previous",
      sourceShotNumber: index === 0 ? null : index,
      extendPrompt: index === 0 ? "" : fallback.extendPrompt,
      negativePrompt: shotDefaults?.negativePrompt ?? "",
      cameraNotes: shotDefaults?.cameraNotes ?? ""
    };
  });
}

export function resetKlingFormFields(state: ProjectFormState): ProjectFormState {
  return {
    ...state,
    klingMode: "",
    klingCfgScale: "",
    klingCameraControlType: "",
    klingCameraHorizontal: "",
    klingCameraVertical: "",
    klingCameraPan: "",
    klingCameraTilt: "",
    klingCameraRoll: "",
    klingCameraZoom: ""
  };
}

export function resetKlingPlanningSettings(settings: ProjectPlanningSettings): ProjectPlanningSettings {
  return {
    ...settings,
    klingMode: null,
    klingCfgScale: null,
    klingCameraControlType: null,
    klingCameraHorizontal: null,
    klingCameraVertical: null,
    klingCameraPan: null,
    klingCameraTilt: null,
    klingCameraRoll: null,
    klingCameraZoom: null
  };
}

export function resetShotKlingOverrides(shot: ProjectShotPlanItem): ProjectShotPlanItem {
  return {
    ...shot,
    klingMode: null,
    klingCfgScale: null,
    klingCameraControlType: null,
    klingCameraHorizontal: null,
    klingCameraVertical: null,
    klingCameraPan: null,
    klingCameraTilt: null,
    klingCameraRoll: null,
    klingCameraZoom: null
  };
}
