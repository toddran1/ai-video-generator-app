import { Worker } from "bullmq";
import fs from "node:fs/promises";
import axios from "axios";
import { env } from "../config/env.js";
import { bootstrapDatabase } from "../db/bootstrap.js";
import { extractClipTail, stitchClips } from "../lib/ffmpeg.js";
import { GENERATION_QUEUE_NAME, type GenerationJobPayload } from "../queues/generation.queue.js";
import { redisConnection } from "../queues/redis.js";
import { localAssetService } from "../modules/assets/local-asset.service.js";
import {
  createGenerationShots,
  getGenerationShot,
  getGenerationJobById,
  listGenerationShotsForJob,
  updateGenerationJob,
  updateGenerationShot
} from "../modules/generate/generate.repository.js";
import { resolveProviderExecutionConfig } from "../modules/generate/generation-profile.service.js";
import {
  normalizeAspectRatioForVideoProvider,
  normalizeDurationForVideoProvider
} from "../modules/generate/provider-capabilities.service.js";
import { planShots } from "../modules/generate/shot-planner.service.js";
import { extendVideoClip, generateVideoClip } from "../modules/generate/video-provider.service.js";
import { getProjectById, updateProjectStatus } from "../modules/projects/projects.repository.js";

async function isCancelRequested(jobId: string): Promise<boolean> {
  const job = await getGenerationJobById(jobId);
  return Boolean(job?.cancel_requested);
}

function stringifyPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return "[unserializable payload]";
  }
}

function getErrorDetails(error: unknown): { message: string; payload?: string } {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data ? stringifyPayload(error.response.data) : undefined;
    const providerMessage =
      typeof error.response?.data === "object" &&
      error.response?.data &&
      "message" in error.response.data &&
      typeof error.response.data.message === "string"
        ? error.response.data.message
        : null;

    return {
      message:
        providerMessage ??
        error.message ??
        `Provider request failed${error.response?.status ? ` with status ${error.response.status}` : ""}`,
      payload
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "Unknown worker error" };
}

function extractOutputVideoId(providerTerminalPayload?: string | null): string | null {
  if (!providerTerminalPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(providerTerminalPayload) as {
      data?: { task_result?: { videos?: Array<{ id?: string }> } };
    };

    return parsed.data?.task_result?.videos?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

function extractOutputVideoDuration(providerTerminalPayload?: string | null): number | null {
  if (!providerTerminalPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(providerTerminalPayload) as {
      data?: { task_result?: { videos?: Array<{ duration?: string | number }> } };
    };
    const value = parsed.data?.task_result?.videos?.[0]?.duration;

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "string") {
      const parsedValue = Number.parseFloat(value);
      return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    return null;
  } catch {
    return null;
  }
}

function buildSimpleKlingCameraConfig(
  entries: Array<[string, number | null | undefined]>,
  allowedAxes: Set<string>
): Record<string, number> | undefined {
  const candidates = entries
    .filter(([axis, value]) => allowedAxes.has(axis) && typeof value === "number" && Number.isFinite(value) && value !== 0)
    .sort(([, left], [, right]) => Math.abs((right as number) ?? 0) - Math.abs((left as number) ?? 0));

  const selected = candidates[0];

  if (!selected) {
    return undefined;
  }

  const [axis, value] = selected;
  return { [axis]: value as number };
}

function buildKlingCameraControl(project: Awaited<ReturnType<typeof getProjectById>>) {
  const type = project?.kling_camera_control_type?.trim();
  const allowedTypes = new Set(["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"]);
  const allowedAxes = new Set(["horizontal", "vertical", "pan", "tilt", "roll", "zoom"]);

  if (!type || !allowedTypes.has(type)) {
    return undefined;
  }

  if (type !== "simple") {
    return { type };
  }
  const validConfig = buildSimpleKlingCameraConfig(
    [
      ["horizontal", project?.kling_camera_horizontal],
      ["vertical", project?.kling_camera_vertical],
      ["pan", project?.kling_camera_pan],
      ["tilt", project?.kling_camera_tilt],
      ["roll", project?.kling_camera_roll],
      ["zoom", project?.kling_camera_zoom]
    ],
    allowedAxes
  );

  if (!validConfig) {
    return undefined;
  }

  return {
    type,
    config: validConfig as Record<string, number>
  };
}

function buildShotLevelKlingCameraControl(shot: {
  kling_camera_control_type?: string | null;
  kling_camera_horizontal?: number | null;
  kling_camera_vertical?: number | null;
  kling_camera_pan?: number | null;
  kling_camera_tilt?: number | null;
  kling_camera_roll?: number | null;
  kling_camera_zoom?: number | null;
  klingCameraControlType?: string | null;
  klingCameraHorizontal?: number | null;
  klingCameraVertical?: number | null;
  klingCameraPan?: number | null;
  klingCameraTilt?: number | null;
  klingCameraRoll?: number | null;
  klingCameraZoom?: number | null;
}) {
  const type = (shot.kling_camera_control_type ?? shot.klingCameraControlType)?.trim();
  const allowedTypes = new Set(["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"]);
  const allowedAxes = new Set(["horizontal", "vertical", "pan", "tilt", "roll", "zoom"]);

  if (!type || !allowedTypes.has(type)) {
    return undefined;
  }

  if (type !== "simple") {
    return { type };
  }

  const validConfig = buildSimpleKlingCameraConfig(
    [
      ["horizontal", shot.kling_camera_horizontal ?? shot.klingCameraHorizontal],
      ["vertical", shot.kling_camera_vertical ?? shot.klingCameraVertical],
      ["pan", shot.kling_camera_pan ?? shot.klingCameraPan],
      ["tilt", shot.kling_camera_tilt ?? shot.klingCameraTilt],
      ["roll", shot.kling_camera_roll ?? shot.klingCameraRoll],
      ["zoom", shot.kling_camera_zoom ?? shot.klingCameraZoom]
    ],
    allowedAxes
  );

  if (!validConfig) {
    return undefined;
  }

  return { type, config: validConfig as Record<string, number> };
}

function resolveCompatibleCameraControl(params: {
  durationSeconds: number;
  requestedMode?: string | null;
  cameraControl?: ReturnType<typeof buildKlingCameraControl>;
}) {
  if (!params.cameraControl) {
    return undefined;
  }

  if (params.durationSeconds !== 5) {
    return undefined;
  }

  if (params.requestedMode === "pro") {
    return undefined;
  }

  return params.cameraControl;
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

  const executionConfig = resolveProviderExecutionConfig(jobRecord.provider_model ?? project.kling_model);

  const planningSettings = {
    targetShotCount: project.target_shot_count,
    defaultBeatDuration: project.default_beat_duration,
    aspectRatio: project.aspect_ratio,
    styleHint: project.style_hint,
    narrativeMode: project.narrative_mode,
    autoBeatDescriptions: project.auto_beat_descriptions
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
    const segmentPath = localAssetService.getShotSegmentPath(payload.projectId, shot.shotNumber);
    const clipUrl = localAssetService.getShotClipUrl(payload.projectId, shot.shotNumber);

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
    let stitchClipPath = clipPath;
    let sourceProviderOutputId: string | undefined;
    let sourceProviderDurationSeconds: number | undefined;
    let providerOutputDurationSeconds: number | undefined;
    let stitchedSegmentPath: string | undefined;
    let stitchedSegmentUrl: string | undefined;
    let stitchedSegmentStartSeconds: number | undefined;
    let stitchedSegmentDurationSeconds: number | undefined;
    try {
      const providerPrompt = [
        shot.beatLabel ? `Story beat: ${shot.beatLabel}` : null,
        shot.description,
        shot.cameraNotes ? `Camera notes: ${shot.cameraNotes}` : null
      ]
        .filter(Boolean)
        .join("\n\n");

      const handleProviderTaskCreated = async ({
        providerTaskId,
        providerRequestId,
        providerRequestPayload
      }: {
        providerTaskId: string;
        providerRequestId?: string;
        providerRequestPayload?: string;
      }) => {
        console.log(`[worker] shot=${shot.shotNumber} provider_request=${providerRequestPayload ?? "unavailable"}`);
        await updateGenerationShot({
          jobId: payload.jobId,
          shotNumber: shot.shotNumber,
          status: "generating",
          providerTaskId,
          providerRequestId,
          providerRequestPayload
        });
      };

      if (shot.generationMode === "extend-previous") {
        const sourceShotNumber = shot.sourceShotNumber ?? shot.shotNumber - 1;
        const sourceShot = await getGenerationShot(payload.jobId, sourceShotNumber);

        if (!sourceShot || sourceShot.status !== "completed") {
          throw new Error(`Source shot ${sourceShotNumber} must be completed before extending shot ${shot.shotNumber}`);
        }

        const sourceVideoId = sourceShot.provider_output_id ?? extractOutputVideoId(sourceShot.provider_terminal_payload);
        const sourceDurationSeconds = extractOutputVideoDuration(sourceShot.provider_terminal_payload);
        sourceProviderOutputId = sourceVideoId ?? undefined;
        sourceProviderDurationSeconds = sourceDurationSeconds ?? undefined;

        if (!sourceVideoId) {
          throw new Error(`Source shot ${sourceShotNumber} does not have a provider video ID for extension`);
        }

        if (!sourceDurationSeconds || sourceDurationSeconds <= 0) {
          throw new Error(`Source shot ${sourceShotNumber} does not have a valid provider duration for extension`);
        }

        clipResult = await extendVideoClip({
          videoId: sourceVideoId,
          prompt: shot.extendPrompt ?? providerPrompt,
          outputPath: clipPath,
          providerTaskId: persistedShot?.provider_task_id ?? undefined,
          shouldAbort: async () => isCancelRequested(payload.jobId),
          onProviderTaskCreated: handleProviderTaskCreated
        });

        const currentDurationSeconds =
          extractOutputVideoDuration(clipResult.providerTerminalPayload) ?? sourceDurationSeconds;
        providerOutputDurationSeconds = currentDurationSeconds ?? undefined;

        if (currentDurationSeconds > sourceDurationSeconds + 0.05) {
          await extractClipTail(clipPath, segmentPath, sourceDurationSeconds, currentDurationSeconds);
          stitchClipPath = segmentPath;
          stitchedSegmentPath = segmentPath;
          stitchedSegmentUrl = localAssetService.getShotSegmentUrl(payload.projectId, shot.shotNumber);
          stitchedSegmentStartSeconds = sourceDurationSeconds;
          stitchedSegmentDurationSeconds = Math.max(currentDurationSeconds - sourceDurationSeconds, 0);
        } else {
          console.warn(
            `[worker] extend shot ${shot.shotNumber} did not increase duration beyond source shot ${sourceShotNumber}; using full clip for stitching`
          );
          stitchedSegmentPath = clipPath;
          stitchedSegmentUrl = clipUrl;
          stitchedSegmentStartSeconds = 0;
          stitchedSegmentDurationSeconds = currentDurationSeconds;
        }
      } else {
        const shotRequestedMode = shot.klingMode ?? project.kling_mode ?? undefined;
        const shotDuration = normalizeDurationForVideoProvider(shot.durationSeconds || executionConfig.durationSeconds);
        const shotCameraControl = buildShotLevelKlingCameraControl(persistedShot ?? shot) ?? buildKlingCameraControl(project);
        const compatibleCameraControl = resolveCompatibleCameraControl({
          durationSeconds: shotDuration,
          requestedMode: shotRequestedMode,
          cameraControl: shotCameraControl
        });

        clipResult = await generateVideoClip({
          prompt: providerPrompt,
          outputPath: clipPath,
          model: jobRecord.provider_model ?? executionConfig.model,
          durationSeconds: shotDuration,
          aspectRatio: normalizeAspectRatioForVideoProvider(project.aspect_ratio ?? undefined),
          mode: compatibleCameraControl ? shotRequestedMode && shotRequestedMode !== "pro" ? shotRequestedMode : undefined : shotRequestedMode,
          cfgScale: shot.klingCfgScale ?? project.kling_cfg_scale ?? undefined,
          cameraControl: compatibleCameraControl,
          negativePrompt: shot.negativePrompt ?? undefined,
          providerTaskId: persistedShot?.provider_task_id ?? undefined,
          shouldAbort: async () => isCancelRequested(payload.jobId),
          onProviderTaskCreated: handleProviderTaskCreated
        });
        providerOutputDurationSeconds = extractOutputVideoDuration(clipResult.providerTerminalPayload) ?? undefined;
        stitchedSegmentPath = clipPath;
        stitchedSegmentUrl = clipUrl;
        stitchedSegmentStartSeconds = 0;
        stitchedSegmentDurationSeconds = providerOutputDurationSeconds;
      }
    } catch (error) {
      const errorDetails = getErrorDetails(error);
      await updateGenerationShot({
        jobId: payload.jobId,
        shotNumber: shot.shotNumber,
        status: error instanceof Error && error.message === "Generation canceled" ? "canceled" : "failed",
        errorMessage: errorDetails.message,
        providerTerminalPayload: errorDetails.payload
      });
      throw error;
    }

    await updateGenerationShot({
      jobId: payload.jobId,
      shotNumber: shot.shotNumber,
      status: "completed",
      providerTaskId: clipResult.providerTaskId,
      providerRequestId: clipResult.providerRequestId,
      sourceProviderOutputId,
      sourceProviderDurationSeconds,
      providerOutputId: clipResult.providerOutputId,
      providerOutputDurationSeconds,
      providerRequestPayload: clipResult.providerRequestPayload,
      providerUnitsConsumed: clipResult.providerUnitsConsumed,
      providerTerminalPayload: clipResult.providerTerminalPayload,
      stitchedSegmentPath,
      stitchedSegmentUrl,
      stitchedSegmentStartSeconds,
      stitchedSegmentDurationSeconds,
      assetPath: clipPath,
      assetUrl: clipUrl
    });

    clipPaths.push(stitchClipPath);
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
        const errorDetails = getErrorDetails(error);
        const errorMessage = errorDetails.message;

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
