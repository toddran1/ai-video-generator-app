import { createPlaceholderClip } from "../../../lib/ffmpeg.js";
import type { GenerateVideoClipInput, GenerateVideoClipResult } from "./video-provider.types.js";

export async function generateMockVideoClip(
  input: GenerateVideoClipInput
): Promise<GenerateVideoClipResult> {
  if (await input.shouldAbort?.()) {
    throw new Error("Generation canceled");
  }

  await createPlaceholderClip(input.outputPath, input.prompt, input.durationSeconds ?? 3);

  return {
    provider: "mock",
    outputPath: input.outputPath
  };
}
