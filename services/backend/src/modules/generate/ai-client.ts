import axios from "axios";
import { env } from "../../config/env.js";
import type { ShotPlanItem } from "./generate.types.js";

export async function requestShotPlan(prompt: string): Promise<ShotPlanItem[]> {
  const response = await axios.post<{ shots: ShotPlanItem[] }>(
    `${env.AI_SERVICE_URL}/plan-shots`,
    { prompt }
  );

  return response.data.shots;
}
