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
    aspectRatio: input.aspectRatio ?? null,
    styleHint: input.styleHint ?? null
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
    .sort((a, b) => a.shotNumber - b.shotNumber)
    .map((shot, index) => ({
      shotNumber: index + 1,
      description: shot.description,
      durationSeconds: shot.durationSeconds,
      negativePrompt: shot.negativePrompt ?? null,
      cameraNotes: shot.cameraNotes ?? null
    }));

  return replaceProjectShotPlans(projectId, normalizedShots);
}

export async function previewAutoShotPlan(projectId: string) {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  const shotPlan = await planShots(project.prompt, undefined, {
    targetShotCount: project.target_shot_count,
    aspectRatio: project.aspect_ratio,
    styleHint: project.style_hint
  });
  return shotPlan.shots;
}

export async function updateProjectPlanningSettingsOrThrow(
  projectId: string,
  input: UpdateProjectPlanningSettingsInput
) {
  const project = await updateProjectPlanningSettings(projectId, {
    targetShotCount: input.targetShotCount ?? null,
    aspectRatio: input.aspectRatio ?? null,
    styleHint: input.styleHint ?? null
  });

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  return project;
}
