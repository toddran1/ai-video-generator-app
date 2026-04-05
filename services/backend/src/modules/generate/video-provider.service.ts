import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { extendKlingVideoClip, generateKlingVideoClip } from "./video-providers/kling-video.provider.js";
import { extendMockVideoClip, generateMockVideoClip } from "./video-providers/mock-video.provider.js";
import type {
  ExtendVideoClipInput,
  GenerateVideoClipInput,
  GenerateVideoClipResult
} from "./video-providers/video-provider.types.js";

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

export async function extendVideoClip(
  input: ExtendVideoClipInput
): Promise<GenerateVideoClipResult> {
  switch (env.VIDEO_GENERATION_PROVIDER) {
    case "mock":
      return extendMockVideoClip(input);
    case "kling":
      return extendKlingVideoClip(input);
    default:
      throw new HttpError(500, "Unsupported video generation provider");
  }
}
