import { requestShotPlan } from "../ai-client.js";
import type { ShotPlanItem } from "../generate.types.js";

export async function buildPythonServiceShotPlan(prompt: string): Promise<ShotPlanItem[]> {
  return requestShotPlan(prompt);
}
