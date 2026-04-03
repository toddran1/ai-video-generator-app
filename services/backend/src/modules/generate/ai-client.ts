import axios from "axios";
import { env } from "../../config/env.js";
import type { ProjectPlanningSettings, ShotPlanItem } from "./generate.types.js";

export async function requestShotPlan(prompt: string, settings?: ProjectPlanningSettings): Promise<ShotPlanItem[]> {
  const response = await axios.post<{ shots: ShotPlanItem[] }>(
    `${env.AI_SERVICE_URL}/plan-shots`,
    {
      prompt,
      targetShotCount: settings?.targetShotCount ?? undefined,
      aspectRatio: settings?.aspectRatio ?? undefined,
      styleHint: settings?.styleHint ?? undefined
    }
  );

  return response.data.shots;
}
