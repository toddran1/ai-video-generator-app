import type { ProjectPlanningSettings, ShotPlanItem } from "../generate.types.js";

export async function buildMockShotPlan(prompt: string, settings?: ProjectPlanningSettings): Promise<ShotPlanItem[]> {
  const cleanedPrompt = prompt.trim() || "A cinematic scene";
  const requestedShotCount = Math.min(Math.max(settings?.targetShotCount ?? 3, 1), 12);
  const phases = ["Establishing", "Build-up", "Action", "Transition", "Closing"];

  return Array.from({ length: requestedShotCount }, (_, index) => ({
    shotNumber: index + 1,
    description: `${phases[Math.min(index, phases.length - 1)]} shot for ${cleanedPrompt}`,
    durationSeconds: 3
  }));
}
