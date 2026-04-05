import type { ProjectPlanningSettings, ShotPlanItem } from "../generate.types.js";

export async function buildMockShotPlan(prompt: string, settings?: ProjectPlanningSettings): Promise<ShotPlanItem[]> {
  const cleanedPrompt = prompt.trim() || "A cinematic scene";
  const requestedShotCount = Math.min(Math.max(settings?.targetShotCount ?? 1, 1), 12);
  const phases = ["Intro", "Continuation", "Climax", "Resolution", "Outro"];

  return Array.from({ length: requestedShotCount }, (_, index) => ({
    shotNumber: index + 1,
    beatLabel: phases[Math.min(index, phases.length - 1)],
    description: `${phases[Math.min(index, phases.length - 1)]} shot for ${cleanedPrompt}`,
    durationSeconds: settings?.defaultBeatDuration ?? 5,
    generationMode: index === 0 ? "generate" : "extend-previous",
    sourceShotNumber: index === 0 ? null : index,
    extendPrompt: index === 0 ? null : `${phases[Math.min(index, phases.length - 1)]} continuation for ${cleanedPrompt}`
  }));
}
