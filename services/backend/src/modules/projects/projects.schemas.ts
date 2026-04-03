import { z } from "zod";

export const createProjectSchema = z.object({
  title: z.string().min(1),
  prompt: z.string().min(1)
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
