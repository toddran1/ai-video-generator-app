import type { GenerationShot, Project, ProjectGenerationStatus, ProjectPlanningSettings, ProjectShotPlanItem } from "../../types";
import {
  DEFAULT_BEAT_DURATION,
  klingCameraControlTypes,
  terminalStatuses,
  type ProjectFormState,
  type ShotGenerationMode
} from "./config";

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isKlingMode(value: string | null | undefined): value is "std" | "pro" {
  return value === "std" || value === "pro";
}

export function isKlingCameraControlType(
  value: string | null | undefined
): value is NonNullable<ProjectPlanningSettings["klingCameraControlType"]> {
  return Boolean(value && klingCameraControlTypes.some((option) => option.value === value));
}

export function modelSupportsCameraControls(modelId: string | null | undefined) {
  return [
    "kling-v2.6-std",
    "kling-video-3.0",
    "kling-video-3.0-omni",
    "kling-3.0-omni",
    "kling-video-o3"
  ].includes(modelId ?? "");
}

export function getShotCameraControlNotice(shot: ProjectShotPlanItem, projectModel?: string | null) {
  if (shot.generationMode !== "generate") {
    return "Camera control only applies to Generate New Clip shots.";
  }

  const effectiveModel = projectModel ?? null;
  if (!modelSupportsCameraControls(effectiveModel)) {
    return "Camera control is only surfaced for verified compatible Kling models.";
  }

  if ((shot.klingMode ?? null) === "pro") {
    return "Camera control is omitted when Kling mode is Pro.";
  }

  if (shot.durationSeconds !== 5 && shot.durationSeconds !== 10) {
    return "Camera control is currently only sent on 5-second or 10-second generate shots.";
  }

  return "Camera control is eligible for this shot.";
}

export function shouldHideCameraControls(modelId: string | null | undefined, mode: string | null | undefined) {
  return !modelSupportsCameraControls(modelId) || mode === "pro";
}

export function clearProjectCameraFields<T extends ProjectPlanningSettings | ProjectFormState>(state: T): T {
  return {
    ...state,
    klingCameraControlType: null as T["klingCameraControlType"],
    klingCameraHorizontal: null as T["klingCameraHorizontal"],
    klingCameraVertical: null as T["klingCameraVertical"],
    klingCameraPan: null as T["klingCameraPan"],
    klingCameraTilt: null as T["klingCameraTilt"],
    klingCameraRoll: null as T["klingCameraRoll"],
    klingCameraZoom: null as T["klingCameraZoom"]
  };
}

export function clearProjectFormCameraFields(state: ProjectFormState): ProjectFormState {
  return {
    ...state,
    klingCameraControlType: "",
    klingCameraHorizontal: "",
    klingCameraVertical: "",
    klingCameraPan: "",
    klingCameraTilt: "",
    klingCameraRoll: "",
    klingCameraZoom: ""
  };
}

export function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

export function formatProvider(value: string) {
  return value.replace(/-/g, " ");
}

export interface ProviderEndpointContractField {
  name: string;
  required?: boolean;
  type: string;
  notes?: string;
}

export interface ProviderEndpointContract {
  endpointKey: string;
  label: string;
  method: string;
  url: string;
  notes?: string;
  fields: ProviderEndpointContractField[];
}

export function getProviderEndpointContract(shot: GenerationShot): ProviderEndpointContract | null {
  if (shot.provider !== "kling") {
    return null;
  }

  if (shot.generation_mode === "extend-previous") {
    return {
      endpointKey: "kling-video-extend",
      label: "Kling video-extend",
      method: "POST",
      url: "https://api.klingai.com/v1/videos/video-extend",
      notes: "Used for continuation clips. The follow-up request is built from the prior provider video ID plus an extend prompt.",
      fields: [
        { name: "video_id", required: true, type: "string", notes: "Provider video ID from the source shot." },
        { name: "prompt", required: true, type: "string", notes: "Continuation instruction for the next visual beat." }
      ]
    };
  }

  return {
    endpointKey: "kling-text2video",
    label: "Kling text2video",
    method: "POST",
    url: "https://api.klingai.com/v1/videos/text2video",
    notes: "Used for fresh generated clips. Actual accepted values are based on live-verified support in our app.",
    fields: [
      { name: "model", required: true, type: "string", notes: "Current project or shot-level Kling model ID." },
      { name: "prompt", required: true, type: "string", notes: "Primary creative prompt sent to Kling." },
      { name: "duration", type: "number", notes: "Live-verified safe values in our app are currently 5 or 10." },
      { name: "aspect_ratio", type: "\"16:9\" | \"9:16\" | \"1:1\"" },
      { name: "negative_prompt", type: "string" },
      { name: "mode", type: "\"std\" | \"pro\"" },
      { name: "cfg_scale", type: "number", notes: "Expected range is 0.0 to 1.0." },
      {
        name: "camera_control",
        type: "object",
        notes: "Optional. Compatible combinations are narrower than the generic schema, so the UI only surfaces verified-safe cases."
      }
    ]
  };
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function getShotProgress(shots: GenerationShot[]) {
  if (shots.length === 0) {
    return "No shots planned yet";
  }

  const completedShots = shots.filter((shot) => shot.status === "completed").length;
  return `${completedShots}/${shots.length} shots complete`;
}

export function getShotPlanSummary(shots: ProjectShotPlanItem[]) {
  const totalDuration = shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  if (shots.length === 1) {
    return `1 shot · ${totalDuration}s single clip`;
  }

  return `${shots.length} shots · ${totalDuration}s total`;
}

export function normalizeShotNumbers(shots: ProjectShotPlanItem[]) {
  return shots.map((shot, index) => ({ ...shot, shotNumber: index + 1 }));
}

export function normalizeShotSequence(shots: ProjectShotPlanItem[]) {
  return shots.map((shot, index) => {
    const shotNumber = index + 1;
    const generationMode: ShotGenerationMode =
      shotNumber === 1 ? "generate" : shot.generationMode === "extend-previous" ? "extend-previous" : "generate";
    const sourceShotNumber =
      generationMode === "extend-previous"
        ? Math.min(Math.max(shot.sourceShotNumber ?? shotNumber - 1, 1), shotNumber - 1)
        : null;

    return {
      ...shot,
      shotNumber,
      generationMode,
      sourceShotNumber,
      extendPrompt: generationMode === "extend-previous" ? shot.extendPrompt ?? "" : ""
    };
  });
}

export function getEstimatedCredits(shots: ProjectShotPlanItem[], unitsPerShot: number) {
  return shots.length * unitsPerShot;
}

export function getPerShotEstimatedCredits(unitsPerShot: number) {
  return unitsPerShot;
}

export function getClosestSupportedDuration(durationSeconds: number, supportedDurations: number[]) {
  if (supportedDurations.length === 0) {
    return durationSeconds;
  }

  return supportedDurations.reduce((closest, current) => {
    const currentDistance = Math.abs(current - durationSeconds);
    const closestDistance = Math.abs(closest - durationSeconds);

    if (currentDistance < closestDistance) {
      return current;
    }

    if (currentDistance === closestDistance) {
      return current < closest ? current : closest;
    }

    return closest;
  }, supportedDurations[0]);
}

export function normalizeShotPlanDurations(shots: ProjectShotPlanItem[], supportedDurations: number[]): ProjectShotPlanItem[] {
  if (supportedDurations.length === 0) {
    return shots;
  }

  return shots.map((shot) => ({
    ...shot,
    durationSeconds: getClosestSupportedDuration(shot.durationSeconds, supportedDurations)
  }));
}

export function clampBeatDuration(value: number) {
  return Math.min(Math.max(value || DEFAULT_BEAT_DURATION, 1), 30);
}

export function reorderShots(shots: ProjectShotPlanItem[], fromIndex: number, toIndex: number) {
  const next = [...shots];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return normalizeShotSequence(next);
}

export function getLatestJob(projectStatus?: ProjectGenerationStatus) {
  return projectStatus?.jobs[0] ?? null;
}

export function getLatestShots(projectStatus?: ProjectGenerationStatus) {
  return projectStatus?.shots ?? [];
}

export function isTerminalStatus(status?: string | null) {
  return status ? terminalStatuses.has(status) : false;
}

export function isActiveStatus(status?: string | null) {
  return status === "queued" || status === "processing";
}

export function getProjectStats(projects: Project[]) {
  return {
    total: projects.length,
    active: projects.filter((project) => !terminalStatuses.has(project.status)).length,
    completed: projects.filter((project) => project.status === "completed").length
  };
}

export function getShotLabel(shotNumber: number) {
  if (shotNumber === 1) return "Intro";
  if (shotNumber === 2) return "Continuation";
  if (shotNumber === 3) return "Climax";
  return `Shot ${shotNumber}`;
}

export function getContinuitySummary(shots: ProjectShotPlanItem[]) {
  if (shots.length <= 1) {
    return "Single clip";
  }

  const extendCount = shots.filter((shot) => shot.generationMode === "extend-previous").length;
  return extendCount > 0 ? `${extendCount}/${shots.length - 1} follow-up shots extend prior clips` : "Independent clips";
}

export function buildNarrativeTemplate(
  narrativeMode: NonNullable<ProjectPlanningSettings["narrativeMode"]>,
  shotCount: number,
  defaultBeatDuration: number
) {
  const duration = clampBeatDuration(defaultBeatDuration);

  const templateMap: Record<NonNullable<ProjectPlanningSettings["narrativeMode"]>, Array<{ beatLabel: string; description: string; durationOffset?: number }>> = {
    "3-beat-story": [
      { beatLabel: "Intro", description: "Set up the subject, world, or opening situation." },
      { beatLabel: "Continuation", description: "Develop the action, conflict, or key progression." },
      { beatLabel: "Climax", description: "Deliver the peak action or emotional payoff.", durationOffset: 1 }
    ],
    "5-beat-story": [
      { beatLabel: "Hook", description: "Open with an attention-grabbing first visual.", durationOffset: -1 },
      { beatLabel: "Setup", description: "Establish context and main subject." },
      { beatLabel: "Rising Action", description: "Increase momentum and narrative tension." },
      { beatLabel: "Climax", description: "Deliver the main turning point or impact.", durationOffset: 1 },
      { beatLabel: "Resolution", description: "Close with a final image that resolves the moment.", durationOffset: -1 }
    ],
    "fight-scene": [
      { beatLabel: "Standoff", description: "Establish the opponents and the tension before impact." },
      { beatLabel: "First Clash", description: "Show the first exchange of force and movement." },
      { beatLabel: "Momentum Shift", description: "Escalate the fight with a surprise or reversal." },
      { beatLabel: "Finisher", description: "Deliver the decisive attack or ultimate move.", durationOffset: 1 },
      { beatLabel: "Aftershock", description: "Show the aftermath and emotional release.", durationOffset: -1 }
    ],
    "dialogue-scene": [
      { beatLabel: "Approach", description: "Introduce the characters and conversational tension." },
      { beatLabel: "Exchange", description: "Deliver the core dialogue beat and reactions." },
      { beatLabel: "Turn", description: "Reveal the emotional or narrative shift." },
      { beatLabel: "Response", description: "Show the consequences of what was said." }
    ],
    "reveal-arc": [
      { beatLabel: "Mystery", description: "Frame the unknown or hidden truth." },
      { beatLabel: "Clue", description: "Reveal a detail that changes interpretation." },
      { beatLabel: "Reveal", description: "Unveil the core surprise or transformation.", durationOffset: 1 },
      { beatLabel: "Reaction", description: "Show the emotional response and impact." }
    ]
  };

  const base = templateMap[narrativeMode];
  const targetCount = Math.min(Math.max(shotCount, 1), 12);

  return Array.from({ length: targetCount }, (_, index) => {
    const source = base[Math.min(index, base.length - 1)];
    return {
      shotNumber: index + 1,
      beatLabel: source.beatLabel,
      description: source.description,
      durationSeconds: clampBeatDuration(duration + (source.durationOffset ?? 0)),
      generationMode: index === 0 ? "generate" : "extend-previous",
      sourceShotNumber: index === 0 ? null : index,
      extendPrompt: index === 0 ? "" : source.description,
      negativePrompt: "",
      cameraNotes: ""
    };
  });
}

export function applyStoryTemplateWithOptions(
  narrativeMode: NonNullable<ProjectPlanningSettings["narrativeMode"]>,
  shotCount: number,
  defaultBeatDuration: number,
  preserveDescriptions: boolean,
  currentShots: ProjectShotPlanItem[]
): ProjectShotPlanItem[] {
  const template = buildNarrativeTemplate(narrativeMode, shotCount, defaultBeatDuration);

  return normalizeShotSequence(
    template.map((shot, index) => ({
      shotNumber: index + 1,
      beatLabel: shot.beatLabel,
      description: preserveDescriptions ? currentShots[index]?.description ?? "" : shot.description,
      durationSeconds: currentShots[index]?.durationSeconds ?? shot.durationSeconds,
      generationMode: currentShots[index]?.generationMode ?? (index === 0 ? "generate" : "extend-previous"),
      sourceShotNumber: currentShots[index]?.sourceShotNumber ?? (index === 0 ? null : index),
      extendPrompt: currentShots[index]?.extendPrompt ?? (index === 0 ? "" : shot.description),
      negativePrompt: currentShots[index]?.negativePrompt ?? "",
      cameraNotes: currentShots[index]?.cameraNotes ?? ""
    }))
  );
}

export function formatJsonPayload(payload?: string | null) {
  if (!payload) {
    return "";
  }

  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

export function getShotStatusSummary(shots: GenerationShot[]) {
  return shots.slice(0, 3);
}

export function getActiveProviderTask(shots: GenerationShot[]) {
  return shots.find((shot) => shot.provider_task_id)?.provider_task_id ?? null;
}
