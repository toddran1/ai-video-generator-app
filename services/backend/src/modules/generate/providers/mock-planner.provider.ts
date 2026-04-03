import type { ShotPlanItem } from "../generate.types.js";

export async function buildMockShotPlan(prompt: string): Promise<ShotPlanItem[]> {
  const cleanedPrompt = prompt.trim() || "A cinematic scene";

  return [
    {
      shotNumber: 1,
      description: `Establishing shot for ${cleanedPrompt}`,
      durationSeconds: 3
    },
    {
      shotNumber: 2,
      description: `Core action beat for ${cleanedPrompt}`,
      durationSeconds: 3
    },
    {
      shotNumber: 3,
      description: `Closing shot for ${cleanedPrompt}`,
      durationSeconds: 3
    }
  ];
}
