import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { listProjectShotPlans } from "../projects/projects.repository.js";
import { buildMockShotPlan } from "./providers/mock-planner.provider.js";
import { buildPythonServiceShotPlan } from "./providers/python-shot-planner.provider.js";
import type { ShotPlanItem } from "./generate.types.js";

export interface ShotPlanResult {
  provider: string;
  shots: ShotPlanItem[];
}

export async function planShots(prompt: string, projectId?: string): Promise<ShotPlanResult> {
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
        shots: await buildMockShotPlan(prompt)
      };
    case "python-service":
      return {
        provider: "python-service",
        shots: await buildPythonServiceShotPlan(prompt)
      };
    default:
      throw new HttpError(500, "Unsupported shot planner provider");
  }
}
