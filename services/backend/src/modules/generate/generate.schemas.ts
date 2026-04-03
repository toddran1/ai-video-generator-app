import { z } from "zod";

export const generateVideoSchema = z.object({
  projectId: z.string().uuid(),
  profile: z.enum(["testing", "production"]).default("testing")
});

export type GenerateVideoInput = z.infer<typeof generateVideoSchema>;
