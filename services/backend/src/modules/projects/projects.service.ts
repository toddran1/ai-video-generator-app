import { v4 as uuidv4 } from "uuid";
import { HttpError } from "../../lib/http-error.js";
import { planShots } from "../generate/shot-planner.service.js";
import {
  createProject,
  getProjectById,
  listProjectShotPlans,
  listProjects,
  replaceProjectShotPlans,
  updateProjectPlanningSettings
} from "./projects.repository.js";
import type {
  CreateProjectInput,
  UpdateProjectPlanningSettingsInput,
  UpdateProjectShotPlanInput
} from "./projects.schemas.js";

export async function createProjectRecord(input: CreateProjectInput) {
  return createProject({
    id: uuidv4(),
    title: input.title,
    prompt: input.prompt,
    targetShotCount: input.targetShotCount ?? null,
    defaultBeatDuration: input.defaultBeatDuration ?? 5,
    aspectRatio: input.aspectRatio ?? null,
    styleHint: input.styleHint ?? null,
    negativePrompt: input.negativePrompt ?? null,
    cameraNotes: input.cameraNotes ?? null,
    narrativeMode: input.narrativeMode ?? null,
    autoBeatDescriptions: input.autoBeatDescriptions ?? true,
    klingModel: input.klingModel ?? null,
    klingMode: input.klingMode ?? null,
    klingCfgScale: input.klingCfgScale ?? null,
    klingCameraControlType: input.klingCameraControlType ?? null,
    klingCameraHorizontal: input.klingCameraHorizontal ?? null,
    klingCameraVertical: input.klingCameraVertical ?? null,
    klingCameraPan: input.klingCameraPan ?? null,
    klingCameraTilt: input.klingCameraTilt ?? null,
    klingCameraRoll: input.klingCameraRoll ?? null,
    klingCameraZoom: input.klingCameraZoom ?? null
  });
}

export async function getProjectOrThrow(projectId: string) {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  return project;
}

export async function listProjectRecords() {
  return listProjects();
}

export async function getProjectShotPlanOrThrow(projectId: string) {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  return listProjectShotPlans(projectId);
}

export async function updateProjectShotPlan(projectId: string, input: UpdateProjectShotPlanInput) {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  const normalizedShots = input.shots
    .slice()
    .sort((a, b) => a.shotNumber - b.shotNumber);

  const normalizedSequence = normalizedShots.map((shot, index) => {
    const shotNumber = index + 1;
    const generationMode: "generate" | "extend-previous" =
      shotNumber === 1 ? "generate" : shot.generationMode === "extend-previous" ? "extend-previous" : "generate";
    const sourceShotNumber =
      generationMode === "extend-previous"
        ? Math.min(Math.max(shot.sourceShotNumber ?? shotNumber - 1, 1), shotNumber - 1)
        : null;

    return {
      shotNumber,
      beatLabel: shot.beatLabel ?? null,
      description: shot.description,
      durationSeconds: shot.durationSeconds,
      generationMode,
      sourceShotNumber,
      extendPrompt: shot.extendPrompt ?? null,
      negativePrompt: shot.negativePrompt ?? null,
      cameraNotes: shot.cameraNotes ?? null,
      klingMode: generationMode === "generate" ? shot.klingMode ?? null : null,
      klingCfgScale: generationMode === "generate" ? shot.klingCfgScale ?? null : null,
      klingCameraControlType: generationMode === "generate" ? shot.klingCameraControlType ?? null : null,
      klingCameraHorizontal: generationMode === "generate" ? shot.klingCameraHorizontal ?? null : null,
      klingCameraVertical: generationMode === "generate" ? shot.klingCameraVertical ?? null : null,
      klingCameraPan: generationMode === "generate" ? shot.klingCameraPan ?? null : null,
      klingCameraTilt: generationMode === "generate" ? shot.klingCameraTilt ?? null : null,
      klingCameraRoll: generationMode === "generate" ? shot.klingCameraRoll ?? null : null,
      klingCameraZoom: generationMode === "generate" ? shot.klingCameraZoom ?? null : null
    };
  });

  return replaceProjectShotPlans(projectId, normalizedSequence);
}

export async function previewAutoShotPlan(projectId: string) {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  const shotPlan = await planShots(project.prompt, undefined, {
    targetShotCount: project.target_shot_count,
    defaultBeatDuration: project.default_beat_duration,
    aspectRatio: project.aspect_ratio,
    styleHint: project.style_hint,
    negativePrompt: project.negative_prompt,
    cameraNotes: project.camera_notes,
    narrativeMode: project.narrative_mode,
    autoBeatDescriptions: project.auto_beat_descriptions,
    klingModel: project.kling_model,
    klingMode: project.kling_mode,
    klingCfgScale: project.kling_cfg_scale,
    klingCameraControlType: project.kling_camera_control_type,
    klingCameraHorizontal: project.kling_camera_horizontal,
    klingCameraVertical: project.kling_camera_vertical,
    klingCameraPan: project.kling_camera_pan,
    klingCameraTilt: project.kling_camera_tilt,
    klingCameraRoll: project.kling_camera_roll,
    klingCameraZoom: project.kling_camera_zoom
  });
  return shotPlan.shots;
}

export async function updateProjectPlanningSettingsOrThrow(
  projectId: string,
  input: UpdateProjectPlanningSettingsInput
) {
  const project = await updateProjectPlanningSettings(projectId, {
    prompt: input.prompt ?? null,
    targetShotCount: input.targetShotCount ?? null,
    defaultBeatDuration: input.defaultBeatDuration ?? 5,
    aspectRatio: input.aspectRatio ?? null,
    styleHint: input.styleHint ?? null,
    negativePrompt: input.negativePrompt ?? null,
    cameraNotes: input.cameraNotes ?? null,
    narrativeMode: input.narrativeMode ?? null,
    autoBeatDescriptions: input.autoBeatDescriptions ?? true,
    klingModel: input.klingModel ?? null,
    klingMode: input.klingMode ?? null,
    klingCfgScale: input.klingCfgScale ?? null,
    klingCameraControlType: input.klingCameraControlType ?? null,
    klingCameraHorizontal: input.klingCameraHorizontal ?? null,
    klingCameraVertical: input.klingCameraVertical ?? null,
    klingCameraPan: input.klingCameraPan ?? null,
    klingCameraTilt: input.klingCameraTilt ?? null,
    klingCameraRoll: input.klingCameraRoll ?? null,
    klingCameraZoom: input.klingCameraZoom ?? null
  });

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  return project;
}
