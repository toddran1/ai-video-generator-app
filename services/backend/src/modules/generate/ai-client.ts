import axios from "axios";
import { env } from "../../config/env.js";
import type { ProjectPlanningSettings, ShotPlanItem } from "./generate.types.js";

export async function requestShotPlan(prompt: string, settings?: ProjectPlanningSettings): Promise<ShotPlanItem[]> {
  const response = await axios.post<{ shots: ShotPlanItem[] }>(
    `${env.AI_SERVICE_URL}/plan-shots`,
    {
      prompt,
      targetShotCount: settings?.targetShotCount ?? undefined,
      defaultBeatDuration: settings?.defaultBeatDuration ?? undefined,
      aspectRatio: settings?.aspectRatio ?? undefined,
      styleHint: settings?.styleHint ?? undefined,
      narrativeMode: settings?.narrativeMode ?? undefined,
      autoBeatDescriptions: settings?.autoBeatDescriptions ?? undefined
    }
  );

  return response.data.shots;
}
