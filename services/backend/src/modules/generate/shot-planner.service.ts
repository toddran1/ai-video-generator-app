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
  const targetShotCount = Math.min(Math.max(settings?.targetShotCount ?? 1, 1), 12);
  const planningLabel =
    targetShotCount <= 1 ? "single clip" : targetShotCount === 2 ? "short sequence" : "multi-shot story";
  const suggestedBeats =
    targetShotCount <= 1
      ? ["Clip"]
      : targetShotCount === 2
        ? ["Opening", "Continuation"]
        : ["Intro", "Continuation", "Climax", "Resolution", "Outro"].slice(0, targetShotCount);
  const narrativeMode = settings?.narrativeMode ? `Narrative mode: ${settings.narrativeMode}.` : null;
  const beatDescriptionInstruction =
    settings?.autoBeatDescriptions === false
      ? "Do not auto-generate beat descriptions. Prefer concise structural shot labels and minimal assumptions."
      : "Generate beat-aware shot descriptions that reflect the story progression.";

  if (!settings) {
    return `${prompt}\n\nPlanning guidance:\nProject shape: ${planningLabel}.\nSuggested beats: ${suggestedBeats.join(", ")}.\n${beatDescriptionInstruction}`;
  }

  const instructions = [
    settings.targetShotCount ? `Target shot count: ${settings.targetShotCount}.` : null,
    settings.defaultBeatDuration ? `Default beat duration: ${settings.defaultBeatDuration} seconds.` : null,
    settings.aspectRatio ? `Aspect ratio: ${settings.aspectRatio}.` : null,
    settings.styleHint ? `Style direction: ${settings.styleHint}.` : null,
    settings.negativePrompt ? `Default negative prompt: ${settings.negativePrompt}.` : null,
    settings.cameraNotes ? `Default camera notes: ${settings.cameraNotes}.` : null,
    targetShotCount > 2 ? narrativeMode : null,
    `Project shape: ${planningLabel}.`,
    `Suggested beats: ${suggestedBeats.join(", ")}.`,
    beatDescriptionInstruction
  ].filter(Boolean);

  return `${prompt}\n\nPlanning guidance:\n${instructions.join("\n")}`;
}

function applyShotDefaults(shots: ShotPlanItem[], settings?: ProjectPlanningSettings): ShotPlanItem[] {
  return shots.map((shot) => ({
    ...shot,
    negativePrompt: shot.negativePrompt ?? settings?.negativePrompt ?? null,
    cameraNotes: shot.cameraNotes ?? settings?.cameraNotes ?? null
  }));
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
        shots: applyShotDefaults(await buildMockShotPlan(buildPlannerPrompt(prompt, settings), settings), settings)
      };
    case "python-service":
      return {
        provider: "python-service",
        shots: applyShotDefaults(await buildPythonServiceShotPlan(buildPlannerPrompt(prompt, settings), settings), settings)
      };
    default:
      throw new HttpError(500, "Unsupported shot planner provider");
  }
}
