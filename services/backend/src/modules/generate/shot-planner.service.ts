import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { listProjectShotPlans } from "../projects/projects.repository.js";
import { buildMockShotPlan } from "./providers/mock-planner.provider.js";
import { buildPythonServiceShotPlan } from "./providers/python-shot-planner.provider.js";
import type { ProjectPlanningSettings, ShotPlanItem } from "./generate.types.js";

export interface ShotPlanResult {
  provider: string;
  shots: ShotPlanItem[];
}

function buildPlannerPrompt(prompt: string, settings?: ProjectPlanningSettings): string {
  if (!settings) {
    return prompt;
  }

  const instructions = [
    settings.targetShotCount ? `Target shot count: ${settings.targetShotCount}.` : null,
    settings.aspectRatio ? `Aspect ratio: ${settings.aspectRatio}.` : null,
    settings.styleHint ? `Style direction: ${settings.styleHint}.` : null
  ].filter(Boolean);

  if (instructions.length === 0) {
    return prompt;
  }

  return `${prompt}\n\nPlanning guidance:\n${instructions.join("\n")}`;
}

export async function planShots(
  prompt: string,
  projectId?: string,
  settings?: ProjectPlanningSettings
): Promise<ShotPlanResult> {
  if (projectId) {
    const savedShots = await listProjectShotPlans(projectId);

    if (savedShots.length > 0) {
      return {
        provider: "project-shot-plan",
        shots: savedShots.map((shot) => ({
          shotNumber: shot.shot_number,
          description: shot.description,
          durationSeconds: shot.duration_seconds,
          negativePrompt: shot.negative_prompt,
          cameraNotes: shot.camera_notes
        }))
      };
    }
  }

  switch (env.SHOT_PLANNER_PROVIDER) {
    case "mock":
      return {
        provider: "mock",
        shots: await buildMockShotPlan(buildPlannerPrompt(prompt, settings), settings)
      };
    case "python-service":
      return {
        provider: "python-service",
        shots: await buildPythonServiceShotPlan(buildPlannerPrompt(prompt, settings), settings)
      };
    default:
      throw new HttpError(500, "Unsupported shot planner provider");
  }
}
