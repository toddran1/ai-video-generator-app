import { z } from "zod";

const projectPlanningSettingsSchema = z.object({
  targetShotCount: z.coerce.number().int().positive().max(12).optional().nullable(),
  defaultBeatDuration: z.coerce.number().int().positive().max(30).optional().nullable(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().nullable(),
  styleHint: z.string().max(500).optional().nullable(),
  narrativeMode: z.enum(["3-beat-story", "5-beat-story", "fight-scene", "dialogue-scene", "reveal-arc"]).optional().nullable(),
  autoBeatDescriptions: z.coerce.boolean().optional().nullable(),
  klingMode: z.enum(["std", "pro"]).optional().nullable(),
  klingCfgScale: z.coerce.number().min(0).max(1).optional().nullable(),
  klingCameraControlType: z
    .enum(["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"])
    .optional()
    .nullable(),
  klingCameraHorizontal: z.coerce.number().min(-10).max(10).optional().nullable(),
  klingCameraVertical: z.coerce.number().min(-10).max(10).optional().nullable(),
  klingCameraPan: z.coerce.number().min(-10).max(10).optional().nullable(),
  klingCameraTilt: z.coerce.number().min(-10).max(10).optional().nullable(),
  klingCameraRoll: z.coerce.number().min(-10).max(10).optional().nullable(),
  klingCameraZoom: z.coerce.number().min(-10).max(10).optional().nullable()
});

export const createProjectSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
  targetShotCount: projectPlanningSettingsSchema.shape.targetShotCount,
  defaultBeatDuration: projectPlanningSettingsSchema.shape.defaultBeatDuration,
  aspectRatio: projectPlanningSettingsSchema.shape.aspectRatio,
  styleHint: projectPlanningSettingsSchema.shape.styleHint,
  narrativeMode: projectPlanningSettingsSchema.shape.narrativeMode,
  autoBeatDescriptions: projectPlanningSettingsSchema.shape.autoBeatDescriptions,
  klingMode: projectPlanningSettingsSchema.shape.klingMode,
  klingCfgScale: projectPlanningSettingsSchema.shape.klingCfgScale,
  klingCameraControlType: projectPlanningSettingsSchema.shape.klingCameraControlType,
  klingCameraHorizontal: projectPlanningSettingsSchema.shape.klingCameraHorizontal,
  klingCameraVertical: projectPlanningSettingsSchema.shape.klingCameraVertical,
  klingCameraPan: projectPlanningSettingsSchema.shape.klingCameraPan,
  klingCameraTilt: projectPlanningSettingsSchema.shape.klingCameraTilt,
  klingCameraRoll: projectPlanningSettingsSchema.shape.klingCameraRoll,
  klingCameraZoom: projectPlanningSettingsSchema.shape.klingCameraZoom
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const projectShotPlanItemSchema = z.object({
  shotNumber: z.coerce.number().int().positive(),
  beatLabel: z.string().max(60).optional().nullable(),
  description: z.string().min(1),
  durationSeconds: z.coerce.number().int().positive().max(30),
  generationMode: z.enum(["generate", "extend-previous"]).optional().nullable(),
  sourceShotNumber: z.coerce.number().int().positive().optional().nullable(),
  extendPrompt: z.string().optional().nullable(),
  negativePrompt: z.string().optional().nullable(),
  cameraNotes: z.string().optional().nullable(),
  klingMode: projectPlanningSettingsSchema.shape.klingMode,
  klingCfgScale: projectPlanningSettingsSchema.shape.klingCfgScale,
  klingCameraControlType: projectPlanningSettingsSchema.shape.klingCameraControlType,
  klingCameraHorizontal: projectPlanningSettingsSchema.shape.klingCameraHorizontal,
  klingCameraVertical: projectPlanningSettingsSchema.shape.klingCameraVertical,
  klingCameraPan: projectPlanningSettingsSchema.shape.klingCameraPan,
  klingCameraTilt: projectPlanningSettingsSchema.shape.klingCameraTilt,
  klingCameraRoll: projectPlanningSettingsSchema.shape.klingCameraRoll,
  klingCameraZoom: projectPlanningSettingsSchema.shape.klingCameraZoom
});

export const updateProjectShotPlanSchema = z.object({
  shots: z.array(projectShotPlanItemSchema).max(12)
});

export type UpdateProjectShotPlanInput = z.infer<typeof updateProjectShotPlanSchema>;

export const updateProjectPlanningSettingsSchema = projectPlanningSettingsSchema;

export type UpdateProjectPlanningSettingsInput = z.infer<typeof updateProjectPlanningSettingsSchema>;
