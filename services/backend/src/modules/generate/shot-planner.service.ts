import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { buildMockShotPlan } from "./providers/mock-planner.provider.js";
import { buildPythonServiceShotPlan } from "./providers/python-shot-planner.provider.js";
import type { ShotPlanItem } from "./generate.types.js";

export interface ShotPlanResult {
  provider: string;
  shots: ShotPlanItem[];
}

export async function planShots(prompt: string): Promise<ShotPlanResult> {
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
