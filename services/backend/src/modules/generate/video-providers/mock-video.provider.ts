import { createPlaceholderClip } from "../../../lib/ffmpeg.js";
import type {
  ExtendVideoClipInput,
  GenerateVideoClipInput,
  GenerateVideoClipResult
} from "./video-provider.types.js";

export async function generateMockVideoClip(
  input: GenerateVideoClipInput
): Promise<GenerateVideoClipResult> {
  if (await input.shouldAbort?.()) {
    throw new Error("Generation canceled");
  }

  await createPlaceholderClip(input.outputPath, input.prompt, input.durationSeconds ?? 3);

  return {
    provider: "mock",
    providerOutputId: `mock-${Date.now()}`,
    providerRequestPayload: JSON.stringify({
      prompt: input.prompt,
      duration: input.durationSeconds ?? 3,
      aspect_ratio: input.aspectRatio ?? null,
      negative_prompt: input.negativePrompt ?? null
    }),
    outputPath: input.outputPath
  };
}

export async function extendMockVideoClip(
  input: ExtendVideoClipInput
): Promise<GenerateVideoClipResult> {
  if (await input.shouldAbort?.()) {
    throw new Error("Generation canceled");
  }

  await createPlaceholderClip(input.outputPath, `Extend: ${input.prompt}`, 5);

  return {
    provider: "mock",
    providerOutputId: `mock-extend-${Date.now()}`,
    providerRequestPayload: JSON.stringify({
      video_id: input.videoId,
      prompt: input.prompt
    }),
    outputPath: input.outputPath
  };
}
