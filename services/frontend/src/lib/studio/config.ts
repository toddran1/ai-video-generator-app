import type { ProjectPlanningSettings, ProjectShotPlanItem } from "../../types";

export interface ProjectFormState {
  title: string;
  prompt: string;
  targetShotCount: number;
  defaultBeatDuration: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  styleHint: string;
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

export function createDefaultShotPlan(durationSeconds = DEFAULT_BEAT_DURATION): ProjectShotPlanItem[] {
  return [
    {
      shotNumber: 1,
      beatLabel: "Intro",
      description: "Establishing shot",
      durationSeconds,
      generationMode: "generate",
      sourceShotNumber: null,
      extendPrompt: "",
      negativePrompt: "",
      cameraNotes: ""
    },
    {
      shotNumber: 2,
      beatLabel: "Continuation",
      description: "Main action beat",
      durationSeconds,
      generationMode: "extend-previous",
      sourceShotNumber: 1,
      extendPrompt: "Continue the established action and motion from shot 1.",
      negativePrompt: "",
      cameraNotes: ""
    },
    {
      shotNumber: 3,
      beatLabel: "Climax",
      description: "Closing shot",
      durationSeconds,
      generationMode: "extend-previous",
      sourceShotNumber: 2,
      extendPrompt: "Carry the sequence forward into the climactic payoff from shot 2.",
      negativePrompt: "",
      cameraNotes: ""
    }
  ];
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
