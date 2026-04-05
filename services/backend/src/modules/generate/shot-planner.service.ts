import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { listProjectShotPlans } from "../projects/projects.repository.js";
import { buildMockShotPlan } from "./providers/mock-planner.provider.js";
import { buildPythonServiceShotPlan } from "./providers/python-shot-planner.provider.js";
import type { ProjectPlanningSettings, ShotPlanItem } from "./generate.types.js";

export interface ShotPlanResult {
  provider: string;
  shots: ShotPlanItem[];
}

function buildPlannerPrompt(prompt: string, settings?: ProjectPlanningSettings): string {
  const targetShotCount = Math.min(Math.max(settings?.targetShotCount ?? 3, 1), 12);
  const defaultStoryBeats = ["Intro", "Continuation", "Climax", "Resolution", "Outro"].slice(
    0,
    targetShotCount
  );
  const narrativeMode = settings?.narrativeMode ? `Narrative mode: ${settings.narrativeMode}.` : null;
  const beatDescriptionInstruction =
    settings?.autoBeatDescriptions === false
      ? "Do not auto-generate beat descriptions. Prefer concise structural shot labels and minimal assumptions."
      : "Generate beat-aware shot descriptions that reflect the story progression.";

  if (!settings) {
    return `${prompt}\n\nPlanning guidance:\nSuggested story beats: ${defaultStoryBeats.join(", ")}.\n${beatDescriptionInstruction}`;
  }

  const instructions = [
    settings.targetShotCount ? `Target shot count: ${settings.targetShotCount}.` : null,
    settings.defaultBeatDuration ? `Default beat duration: ${settings.defaultBeatDuration} seconds.` : null,
    settings.aspectRatio ? `Aspect ratio: ${settings.aspectRatio}.` : null,
    settings.styleHint ? `Style direction: ${settings.styleHint}.` : null,
    narrativeMode,
    `Suggested story beats: ${defaultStoryBeats.join(", ")}.`,
    beatDescriptionInstruction
  ].filter(Boolean);

  return `${prompt}\n\nPlanning guidance:\n${instructions.join("\n")}`;
}

export async function planShots(
  prompt: string,
  projectId?: string,
  settings?: ProjectPlanningSettings
): Promise<ShotPlanResult> {
  if (projectId) {
    const savedShots = await listProjectShotPlans(projectId);

    if (savedShots.length > 0) {
      return {
        provider: "project-shot-plan",
        shots: savedShots.map((shot) => ({
          shotNumber: shot.shot_number,
          beatLabel: shot.beat_label,
          description: shot.description,
          durationSeconds: shot.duration_seconds,
          generationMode: shot.generation_mode as "generate" | "extend-previous" | null,
          sourceShotNumber: shot.source_shot_number,
          extendPrompt: shot.extend_prompt,
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
        shots: await buildMockShotPlan(buildPlannerPrompt(prompt, settings), settings)
      };
    case "python-service":
      return {
        provider: "python-service",
        shots: await buildPythonServiceShotPlan(buildPlannerPrompt(prompt, settings), settings)
      };
    default:
      throw new HttpError(500, "Unsupported shot planner provider");
  }
}
