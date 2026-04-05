import { z } from "zod";

export const generateVideoSchema = z.object({
  projectId: z.string().uuid()
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;
