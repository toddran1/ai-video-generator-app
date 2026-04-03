import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { generateKlingVideoClip } from "./video-providers/kling-video.provider.js";
import { generateMockVideoClip } from "./video-providers/mock-video.provider.js";
import type { GenerateVideoClipInput, GenerateVideoClipResult } from "./video-providers/video-provider.types.js";

export async function generateVideoClip(
  input: GenerateVideoClipInput
): Promise<GenerateVideoClipResult> {
  switch (env.VIDEO_GENERATION_PROVIDER) {
    case "mock":
      return generateMockVideoClip(input);
    case "kling":
      return generateKlingVideoClip(input);
    default:
      throw new HttpError(500, "Unsupported video generation provider");
  }
}
