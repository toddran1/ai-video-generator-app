import { Queue } from "bullmq";
import { redisConnection } from "./redis.js";

export interface GenerationJobPayload {
  jobId: string;
  projectId: string;
}

export const GENERATION_QUEUE_NAME = "video-generation";

export const generationQueue = new Queue<GenerationJobPayload>(GENERATION_QUEUE_NAME, {
  connection: redisConnection
});
