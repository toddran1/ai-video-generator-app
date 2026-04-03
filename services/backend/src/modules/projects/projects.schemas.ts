import { z } from "zod";

const projectPlanningSettingsSchema = z.object({
  targetShotCount: z.coerce.number().int().positive().max(12).optional().nullable(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().nullable(),
  styleHint: z.string().max(120).optional().nullable()
});

export const createProjectSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1),
  targetShotCount: projectPlanningSettingsSchema.shape.targetShotCount,
  aspectRatio: projectPlanningSettingsSchema.shape.aspectRatio,
  styleHint: projectPlanningSettingsSchema.shape.styleHint
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const projectShotPlanItemSchema = z.object({
  shotNumber: z.coerce.number().int().positive(),
  description: z.string().min(1),
  durationSeconds: z.coerce.number().int().positive().max(30),
  negativePrompt: z.string().optional().nullable(),
  cameraNotes: z.string().optional().nullable()
});

export const updateProjectShotPlanSchema = z.object({
  shots: z.array(projectShotPlanItemSchema).max(12)
});

export type UpdateProjectShotPlanInput = z.infer<typeof updateProjectShotPlanSchema>;

export const updateProjectPlanningSettingsSchema = projectPlanningSettingsSchema;

export type UpdateProjectPlanningSettingsInput = z.infer<typeof updateProjectPlanningSettingsSchema>;
