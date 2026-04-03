import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
  ASSET_CLEANUP_ENABLED: z.coerce.boolean().default(false),
  KLING_API_BASE_URL: z.string().url().default("https://api.klingai.com"),
  KLING_API_KEY: z.string().optional(),
  KLING_ACCESS_KEY: z.string().optional(),
  KLING_SECRET_KEY: z.string().optional(),
  KLING_MODEL: z.string().default("kling-v2.6-std"),
  KLING_TEST_MODEL: z.string().default("kling-v2.6-std"),
  KLING_PRODUCTION_MODEL: z.string().default("kling-v2.6-pro"),
  KLING_DURATION_SECONDS: z.coerce.number().default(5),
  KLING_TEST_DURATION_SECONDS: z.coerce.number().default(5),
  KLING_PRODUCTION_DURATION_SECONDS: z.coerce.number().default(5),
  KLING_ASPECT_RATIO: z.string().default("16:9"),
  KLING_MODE: z.string().optional(),
  KLING_NEGATIVE_PROMPT: z.string().optional(),
  KLING_POLL_INTERVAL_MS: z.coerce.number().default(5000),
  KLING_TIMEOUT_MS: z.coerce.number().default(900000)
});

export const env = envSchema.parse(process.env);
