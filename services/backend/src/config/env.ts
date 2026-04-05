import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

function parseBooleanString(value: string | undefined, fallback: boolean) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().replace(/^['"]|['"]$/g, "").toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function parseCsvValues(value: string | undefined, fallback: string[]) {
  if (!value) {
    return fallback;
  }

  const parsed = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : fallback;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  AI_SERVICE_URL: z.string().url(),
  SHOT_PLANNER_PROVIDER: z.enum(["mock", "python-service"]).default("python-service"),
  VIDEO_GENERATION_PROVIDER: z.enum(["mock", "kling"]).default("mock"),
  REDIS_URL: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ASSET_ROOT: z.string().default("/app/storage"),
  BACKEND_BASE_URL: z.string().url().default("http://localhost:3000"),
  FFMPEG_PATH: z.string().min(1).optional(),
  ASSET_CLEANUP_ENABLED: z
    .string()
    .optional()
    .transform((value) => parseBooleanString(value, false)),
  KLING_API_BASE_URL: z.string().url().default("https://api.klingai.com"),
  KLING_API_KEY: z.string().optional(),
  KLING_ACCESS_KEY: z.string().optional(),
  KLING_SECRET_KEY: z.string().optional(),
  KLING_MODEL: z.string().default("kling-video-3.0"),
  KLING_SUPPORTED_MODELS: z
    .string()
    .default(
      "kling-v2.6-std,kling-v2.6-pro,kling-v2.5-turbo,kling-video-o1,kling-video-3.0,kling-video-3.0-omni,kling-3.0-omni,kling-video-o3"
    ),
  KLING_DURATION_SECONDS: z.coerce.number().default(5),
  KLING_ASPECT_RATIO: z.string().default("16:9"),
  KLING_SUPPORTED_DURATIONS: z.string().default("5,10,15"),
  KLING_SUPPORTED_ASPECT_RATIOS: z.string().default("16:9,9:16,1:1"),
  KLING_MODE: z.string().optional(),
  KLING_NEGATIVE_PROMPT: z.string().optional(),
  KLING_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  KLING_POLL_TRANSIENT_RETRY_LIMIT: z.coerce.number().int().min(0).default(5),
  KLING_TIMEOUT_MS: z.coerce.number().default(900000)
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  KLING_SUPPORTED_DURATION_VALUES: parseCsvValues(parsedEnv.KLING_SUPPORTED_DURATIONS, ["5", "10", "15"])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value)),
  KLING_SUPPORTED_MODEL_VALUES: parseCsvValues(parsedEnv.KLING_SUPPORTED_MODELS, [
    "kling-v2.6-std",
    "kling-v2.6-pro",
    "kling-v2.5-turbo",
    "kling-video-o1",
    "kling-video-3.0",
    "kling-video-3.0-omni",
    "kling-3.0-omni",
    "kling-video-o3"
  ]),
  KLING_SUPPORTED_ASPECT_RATIO_VALUES: parseCsvValues(parsedEnv.KLING_SUPPORTED_ASPECT_RATIOS, [
    "16:9",
    "9:16",
    "1:1"
  ])
} as const;
