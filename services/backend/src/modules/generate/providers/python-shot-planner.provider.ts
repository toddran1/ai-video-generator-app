import { requestShotPlan } from "../ai-client.js";
import type { ProjectPlanningSettings, ShotPlanItem } from "../generate.types.js";

export async function buildPythonServiceShotPlan(
  prompt: string,
  settings?: ProjectPlanningSettings
): Promise<ShotPlanItem[]> {
  return requestShotPlan(prompt, settings);
}
