import { z } from "zod";

export const createProjectSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1)
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
