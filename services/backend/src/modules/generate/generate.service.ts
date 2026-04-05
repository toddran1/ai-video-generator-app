import { v4 as uuidv4 } from "uuid";
import { env } from "../../config/env.js";
import { HttpError } from "../../lib/http-error.js";
import { generationQueue } from "../../queues/generation.queue.js";
import { localAssetService } from "../assets/local-asset.service.js";
import { getProjectById, resetProjectForRetry, updateProjectStatus } from "../projects/projects.repository.js";
import {
  createGenerationJob,
  getGenerationShot,
  getGenerationJobById,
  listGenerationJobsForProject,
  listGenerationShotsForJob,
  requestGenerationJobCancel,
  resetGenerationShotsForRetry,
  resetGenerationJobForRetry
} from "./generate.repository.js";
import { getVideoProviderCapabilities } from "./provider-capabilities.service.js";
import { resolveProviderExecutionConfig } from "./generation-profile.service.js";

async function queueGenerationJob(params: { jobId: string; projectId: string }) {
  const existingQueueJob = await generationQueue.getJob(params.jobId);

  if (existingQueueJob) {
    await existingQueueJob.remove();
  }

  await generationQueue.add(
    "generate-project-video",
    { jobId: params.jobId, projectId: params.projectId },
    {
      jobId: params.jobId,
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100
    }
  );
}

export async function enqueueGeneration(projectId: string) {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  const jobId = uuidv4();
  const executionConfig = resolveProviderExecutionConfig(project.kling_model);

  await createGenerationJob({
    id: jobId,
    projectId,
    status: "queued",
    generationProfile: executionConfig.profile,
    plannerProvider: env.SHOT_PLANNER_PROVIDER,
    videoProvider: env.VIDEO_GENERATION_PROVIDER,
    providerModel: executionConfig.model
  });

  await updateProjectStatus({ id: projectId, status: "queued" });

  await queueGenerationJob({ jobId, projectId });

  return {
    id: jobId,
    status: "queued",
    projectId,
    profile: executionConfig.profile,
    statusUrl: `${env.BACKEND_BASE_URL}/projects/${projectId}`,
    outputDirectory: localAssetService.getProjectOutputDirectory(projectId),
    plannerProvider: env.SHOT_PLANNER_PROVIDER,
    videoProvider: env.VIDEO_GENERATION_PROVIDER,
    providerModel: executionConfig.model
  };
}

export async function retryGenerationJob(jobId: string) {
  const job = await getGenerationJobById(jobId);

  if (!job) {
    throw new HttpError(404, "Generation job not found");
  }

  if (job.status === "completed") {
    throw new HttpError(409, "Completed jobs do not need retry");
  }

  await resetGenerationJobForRetry(jobId);
  await resetProjectForRetry(job.project_id);

  await queueGenerationJob({ jobId: job.id, projectId: job.project_id });

  return {
    id: job.id,
    status: "queued",
    projectId: job.project_id
  };
}

export async function retryGenerationShot(jobId: string, shotNumber: number) {
  const job = await getGenerationJobById(jobId);

  if (!job) {
    throw new HttpError(404, "Generation job not found");
  }

  const shot = await getGenerationShot(jobId, shotNumber);

  if (!shot) {
    throw new HttpError(404, "Generation shot not found");
  }

  await resetGenerationJobForRetry(jobId);
  await resetProjectForRetry(job.project_id);
  await resetGenerationShotsForRetry(jobId, shotNumber);
  await queueGenerationJob({ jobId: job.id, projectId: job.project_id });

  return {
    id: job.id,
    status: "queued",
    projectId: job.project_id,
    shotNumber
  };
}

export async function cancelGenerationShot(jobId: string, shotNumber: number) {
  const job = await getGenerationJobById(jobId);

  if (!job) {
    throw new HttpError(404, "Generation job not found");
  }

  const shot = await getGenerationShot(jobId, shotNumber);

  if (!shot) {
    throw new HttpError(404, "Generation shot not found");
  }

  if (shot.status !== "generating") {
    throw new HttpError(409, "Only generating shots can be canceled");
  }

  await requestGenerationJobCancel(jobId);

  return {
    id: job.id,
    status: "canceling",
    projectId: job.project_id,
    shotNumber
  };
}

export async function getGenerationJobStatus(jobId: string) {
  const job = await getGenerationJobById(jobId);

  if (!job) {
    throw new HttpError(404, "Generation job not found");
  }

  const shots = await listGenerationShotsForJob(jobId);

  return {
    job,
    shots
  };
}

export async function getProviderConfig() {
  return getVideoProviderCapabilities();
}

export async function getProjectGenerationStatus(projectId: string) {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  const jobs = await listGenerationJobsForProject(projectId);
  const latestJob = jobs[0] ?? null;
  const shots = latestJob ? await listGenerationShotsForJob(latestJob.id) : [];

  return {
    project,
    jobs,
    shots
  };
}
