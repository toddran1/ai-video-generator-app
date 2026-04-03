import { Worker } from "bullmq";
import fs from "node:fs/promises";
import { env } from "../config/env.js";
import { bootstrapDatabase } from "../db/bootstrap.js";
import { stitchClips } from "../lib/ffmpeg.js";
import { GENERATION_QUEUE_NAME, type GenerationJobPayload } from "../queues/generation.queue.js";
import { redisConnection } from "../queues/redis.js";
import { localAssetService } from "../modules/assets/local-asset.service.js";
import {
  createGenerationShots,
  getGenerationJobById,
  listGenerationShotsForJob,
  updateGenerationJob,
  updateGenerationShot
} from "../modules/generate/generate.repository.js";
import { resolveProviderExecutionConfig } from "../modules/generate/generation-profile.service.js";
import { planShots } from "../modules/generate/shot-planner.service.js";
import { generateVideoClip } from "../modules/generate/video-provider.service.js";
import { getProjectById, updateProjectStatus } from "../modules/projects/projects.repository.js";

async function isCancelRequested(jobId: string): Promise<boolean> {
  const job = await getGenerationJobById(jobId);
  return Boolean(job?.cancel_requested);
}

async function writeProviderMetadataArchive(jobId: string, projectId: string): Promise<string> {
  const job = await getGenerationJobById(jobId);
  const shots = await listGenerationShotsForJob(jobId);
  const metadataPath = localAssetService.getProviderMetadataPath(projectId);

  await fs.writeFile(
    metadataPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        job,
        shots
      },
      null,
      2
    )
  );

  return localAssetService.getPublicAssetUrl("outputs", projectId, "provider-metadata.json");
}

async function processGenerationJob(payload: GenerationJobPayload): Promise<void> {
  const project = await getProjectById(payload.projectId);

  if (!project) {
    throw new Error(`Project ${payload.projectId} not found`);
  }

  await updateGenerationJob({ id: payload.jobId, status: "processing" });
  await updateProjectStatus({ id: payload.projectId, status: "processing" });
  const jobRecord = await getGenerationJobById(payload.jobId);

  if (!jobRecord) {
    throw new Error(`Generation job ${payload.jobId} not found`);
  }

  const executionConfig = resolveProviderExecutionConfig(
    (jobRecord.generation_profile as "testing" | "production" | undefined) ?? "testing"
  );

  const planningSettings = {
    targetShotCount: project.target_shot_count,
    aspectRatio: project.aspect_ratio,
    styleHint: project.style_hint
  };

  const shotPlan = await planShots(project.prompt, payload.projectId, planningSettings);
  const shots = shotPlan.shots;
  await localAssetService.ensureProjectDirectories(payload.projectId);
  const persistedShots = await createGenerationShots({
    jobId: payload.jobId,
    projectId: payload.projectId,
    provider: env.VIDEO_GENERATION_PROVIDER,
    shots
  });
  const persistedShotMap = new Map(persistedShots.map((shot) => [shot.shot_number, shot]));

  const clipPaths: string[] = [];

  for (const shot of shots) {
    const persistedShot = persistedShotMap.get(shot.shotNumber);
    const clipPath = localAssetService.getShotClipPath(payload.projectId, shot.shotNumber);
    const clipUrl = localAssetService.getPublicAssetUrl("temp", payload.projectId, `shot-${shot.shotNumber}.mp4`);

    if (persistedShot?.status === "completed") {
      const existingClipPath = persistedShot.asset_path ?? clipPath;

      try {
        await fs.access(existingClipPath);
        clipPaths.push(existingClipPath);
        continue;
      } catch {
        console.warn(
          `[worker] completed shot ${shot.shotNumber} for job ${payload.jobId} is missing asset at ${existingClipPath}; regenerating`
        );
      }
    }

    if (await isCancelRequested(payload.jobId)) {
      await updateGenerationShot({
        jobId: payload.jobId,
        shotNumber: shot.shotNumber,
        status: "canceled"
      });
      throw new Error("Generation canceled");
    }

    await updateGenerationShot({
      jobId: payload.jobId,
      shotNumber: shot.shotNumber,
      status: "generating"
    });

    let clipResult;
    try {
      clipResult = await generateVideoClip({
        prompt: shot.cameraNotes ? `${shot.description}\n\nCamera notes: ${shot.cameraNotes}` : shot.description,
        outputPath: clipPath,
        model: jobRecord.provider_model ?? executionConfig.model,
        durationSeconds: shot.durationSeconds || executionConfig.durationSeconds,
        aspectRatio: project.aspect_ratio ?? undefined,
        negativePrompt: shot.negativePrompt ?? undefined,
        providerTaskId: persistedShot?.provider_task_id ?? undefined,
        shouldAbort: async () => isCancelRequested(payload.jobId),
        onProviderTaskCreated: async ({ providerTaskId, providerRequestId, providerRequestPayload }) => {
          console.log(
            `[worker] shot=${shot.shotNumber} provider_request=${providerRequestPayload ?? "unavailable"}`
          );
          await updateGenerationShot({
            jobId: payload.jobId,
            shotNumber: shot.shotNumber,
            status: "generating",
            providerTaskId,
            providerRequestId,
            providerRequestPayload
          });
        }
      });
    } catch (error) {
      await updateGenerationShot({
        jobId: payload.jobId,
        shotNumber: shot.shotNumber,
        status: error instanceof Error && error.message === "Generation canceled" ? "canceled" : "failed"
      });
      throw error;
    }

    await updateGenerationShot({
      jobId: payload.jobId,
      shotNumber: shot.shotNumber,
      status: "completed",
      providerTaskId: clipResult.providerTaskId,
      providerRequestId: clipResult.providerRequestId,
      providerRequestPayload: clipResult.providerRequestPayload,
      providerUnitsConsumed: clipResult.providerUnitsConsumed,
      providerTerminalPayload: clipResult.providerTerminalPayload,
      assetPath: clipPath,
      assetUrl: clipUrl
    });

    clipPaths.push(clipPath);
  }

  const finalVideoPath = localAssetService.getFinalVideoPath(payload.projectId);
  await stitchClips(clipPaths, finalVideoPath);

  const publicUrl = localAssetService.getPublicAssetUrl("outputs", payload.projectId, "final.mp4");
  const metadataUrl = await writeProviderMetadataArchive(payload.jobId, payload.projectId);

  await updateGenerationJob({
    id: payload.jobId,
    status: "completed",
    cancelRequested: false,
    plannerProvider: shotPlan.provider,
    generationProfile: executionConfig.profile,
    videoProvider: env.VIDEO_GENERATION_PROVIDER,
    providerModel: jobRecord.provider_model ?? executionConfig.model,
    shotCount: shots.length,
    outputPath: finalVideoPath,
    outputUrl: publicUrl,
    metadataUrl
  });
  await updateProjectStatus({
    id: payload.projectId,
    status: "completed",
    outputUrl: publicUrl
  });

  await localAssetService.cleanupProjectTempAssets(payload.projectId);
}

async function startWorker(): Promise<void> {
  await bootstrapDatabase();

  const worker = new Worker<GenerationJobPayload>(
    GENERATION_QUEUE_NAME,
    async (job) => {
      try {
        await processGenerationJob(job.data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown worker error";

        if (errorMessage === "Generation canceled") {
          await updateGenerationJob({
            id: job.data.jobId,
            status: "canceled",
            cancelRequested: false,
            errorMessage: "Generation canceled by user"
          });
          await updateProjectStatus({
            id: job.data.projectId,
            status: "failed"
          });

          throw error;
        }

        await updateGenerationJob({
          id: job.data.jobId,
          status: "failed",
          errorMessage
        });
        await updateProjectStatus({
          id: job.data.projectId,
          status: "failed"
        });

        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 2
    }
  );

  worker.on("ready", () => {
    console.log(`Generation worker listening on queue "${GENERATION_QUEUE_NAME}"`);
  });

  worker.on("failed", (job, error) => {
    console.error(`Job ${job?.id ?? "unknown"} failed`, error);
  });
}

void startWorker();
