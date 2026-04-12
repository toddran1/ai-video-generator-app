import fs from "node:fs/promises";
import crypto from "node:crypto";
import axios from "axios";
import { env } from "../../../config/env.js";
import { HttpError } from "../../../lib/http-error.js";
import type {
  ExtendVideoClipInput,
  GenerateVideoClipInput,
  GenerateVideoClipResult
} from "./video-provider.types.js";

interface KlingTaskResult {
  url?: string;
  video_url?: string;
  videoUrl?: string;
  videos?: Array<{
    id?: string;
    url?: string;
    video_url?: string;
    videoUrl?: string;
  }>;
}

interface KlingEnvelope<T> {
  code?: number;
  message?: string;
  request_id?: string;
  requestId?: string;
  data?: T;
}

interface KlingSubmitData {
  status?: string;
  state?: string;
  task_status?: string;
  task_id?: string;
  taskId?: string;
}

interface KlingStatusData {
  status?: string;
  state?: string;
  task_status?: string;
  video_url?: string;
  videoUrl?: string;
  output?: {
    url?: string;
    video_url?: string;
    videoUrl?: string;
  };
  outputs?: Array<{
    url?: string;
    video_url?: string;
    videoUrl?: string;
  }>;
  task_result?: KlingTaskResult;
  final_unit_deduction?: string;
}

function stringifyPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload);
  } catch {
    return "[unserializable payload]";
  }
}

function toBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generateKlingJwtToken(): string {
  if (!env.KLING_ACCESS_KEY || !env.KLING_SECRET_KEY) {
    throw new HttpError(500, "Kling access-key auth requires KLING_ACCESS_KEY and KLING_SECRET_KEY");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "HS256",
    typ: "JWT"
  };
  const payload = {
    iss: env.KLING_ACCESS_KEY,
    exp: now + 1800,
    nbf: now - 5
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", env.KLING_SECRET_KEY)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  return `${encodedHeader}.${encodedPayload}.${toBase64Url(signature)}`;
}

function getKlingAuthHeader(): string {
  if (env.KLING_API_KEY) {
    return `Bearer ${env.KLING_API_KEY}`;
  }

  if (env.KLING_ACCESS_KEY && env.KLING_SECRET_KEY) {
    return `Bearer ${generateKlingJwtToken()}`;
  }

  throw new HttpError(
    500,
    "Kling provider selected but no auth credentials are configured. Set KLING_API_KEY or KLING_ACCESS_KEY/KLING_SECRET_KEY."
  );
}

function getKlingErrorMessage<T>(payload: KlingEnvelope<T>): string | null {
  if (payload.code === undefined || payload.code === 0) {
    return null;
  }

  const requestId = payload.request_id ?? payload.requestId;
  return requestId
    ? `Kling API error ${payload.code}: ${payload.message ?? "Unknown error"} (request_id: ${requestId})`
    : `Kling API error ${payload.code}: ${payload.message ?? "Unknown error"}`;
}

function extractTaskId(payload: KlingEnvelope<KlingSubmitData>): string {
  return payload.data?.task_id ?? payload.data?.taskId ?? "";
}

function extractStatus(payload: KlingEnvelope<KlingStatusData>): string {
  return payload.data?.task_status ?? payload.data?.status ?? payload.data?.state ?? "";
}

function extractVideoUrl(payload: KlingEnvelope<KlingStatusData>): string | null {
  const data = payload.data;
  return (
    data?.video_url ??
    data?.videoUrl ??
    data?.output?.url ??
    data?.output?.video_url ??
    data?.output?.videoUrl ??
    data?.outputs?.[0]?.url ??
    data?.outputs?.[0]?.video_url ??
    data?.outputs?.[0]?.videoUrl ??
    data?.task_result?.url ??
    data?.task_result?.video_url ??
    data?.task_result?.videoUrl ??
    data?.task_result?.videos?.[0]?.url ??
    data?.task_result?.videos?.[0]?.video_url ??
    data?.task_result?.videos?.[0]?.videoUrl ??
    null
  );
}

function extractVideoId(payload: KlingEnvelope<KlingStatusData>): string | null {
  return payload.data?.task_result?.videos?.[0]?.id ?? null;
}

async function wait(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ensureNotCanceled(input: GenerateVideoClipInput): Promise<void> {
  if (await input.shouldAbort?.()) {
    throw new HttpError(499, "Generation canceled");
  }
}

function isTransientPollError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.response) {
    return false;
  }

  return ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED", "EAI_AGAIN", "ENOTFOUND"].includes(error.code ?? "");
}

async function pollKlingTask(taskId: string, input: GenerateVideoClipInput): Promise<{
  status: string;
  videoUrl: string | null;
  videoId: string | null;
  providerRequestId?: string;
  providerUnitsConsumed?: string;
  providerTerminalPayload?: string;
}> {
  const startedAt = Date.now();
  let lastStatus = "";
  let lastPayload: KlingEnvelope<KlingStatusData> | null = null;
  let transientFailureCount = 0;

  while (Date.now() - startedAt < env.KLING_TIMEOUT_MS) {
    await ensureNotCanceled(input);
    let response: { data: KlingEnvelope<KlingStatusData> } | undefined;
    try {
      // response = await axios.get<KlingEnvelope<KlingStatusData>>(
      //   `${env.KLING_API_BASE_URL}/v1/videos/text2video/${taskId}`,
      //   {
      //     headers: {
      //       Authorization: getKlingAuthHeader()
      //     }
      //   }
      // );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          `[kling] poll error task=${taskId} status=${error.response?.status ?? "network"} body=${stringifyPayload(error.response?.data)}`
        );
      }
      if (axios.isAxiosError(error) && isTransientPollError(error) && transientFailureCount < env.KLING_POLL_TRANSIENT_RETRY_LIMIT) {
        transientFailureCount += 1;
        console.warn(
          `[kling] transient poll failure task=${taskId} code=${error.code ?? "unknown"} retry=${transientFailureCount}/${env.KLING_POLL_TRANSIENT_RETRY_LIMIT}`
        );
        await wait(Math.min(env.KLING_POLL_INTERVAL_MS, 3000));
        continue;
      }
      throw error;
    }

    transientFailureCount = 0;

    if (!response) {
      throw new HttpError(503, "Kling polling is currently disabled in the provider code");
    }

    lastPayload = response.data;

    const apiError = getKlingErrorMessage(response.data);
    if (apiError) {
      throw new HttpError(502, apiError);
    }

    const status = extractStatus(response.data).toLowerCase();
    const videoUrl = extractVideoUrl(response.data);
    const videoId = extractVideoId(response.data);

    if (status && status !== lastStatus) {
      lastStatus = status;
      console.log(`[kling] task ${taskId} status=${status} payload=${stringifyPayload(response.data)}`);
    }

    if (status === "completed" || status === "succeeded" || status === "success" || status === "succeed") {
      if (!videoUrl) {
        console.warn(
          `[kling] task ${taskId} reached ${status} without video URL. Payload: ${JSON.stringify(response.data)}`
        );
      }
      return {
        status,
        videoUrl,
        videoId,
        providerRequestId: response.data.request_id ?? response.data.requestId,
        providerUnitsConsumed: response.data.data?.final_unit_deduction,
        providerTerminalPayload: stringifyPayload(response.data)
      };
    }

    if (status === "failed" || status === "error") {
      throw new HttpError(502, `Kling task ${taskId} failed`);
    }

    await wait(env.KLING_POLL_INTERVAL_MS);
  }

  console.warn(
    `[kling] task ${taskId} timed out after ${env.KLING_TIMEOUT_MS}ms lastPayload=${stringifyPayload(lastPayload)}`
  );
  throw new HttpError(504, `Kling task ${taskId} timed out`);
}

export async function generateKlingVideoClip(
  input: GenerateVideoClipInput
): Promise<GenerateVideoClipResult> {
  const textToVideoUrl = `${env.KLING_API_BASE_URL}/v1/videos/text2video`;
  const resumeRequestPayload = stringifyPayload({
    model: input.model ?? env.KLING_MODEL,
    prompt: input.prompt,
    duration: input.durationSeconds ?? env.KLING_DURATION_SECONDS,
    aspect_ratio: input.aspectRatio ?? env.KLING_ASPECT_RATIO,
    negative_prompt: input.negativePrompt ?? env.KLING_NEGATIVE_PROMPT ?? undefined,
    mode: input.mode ?? env.KLING_MODE ?? undefined,
    cfg_scale: input.cfgScale ?? undefined,
    camera_control: input.cameraControl ?? undefined
  });
  const existingTaskId = input.providerTaskId?.trim();
  if (existingTaskId) {
    console.log(`[kling] resuming task=${existingTaskId} url=${textToVideoUrl} request=${resumeRequestPayload}`);
    await ensureNotCanceled(input);
    const taskResult = await pollKlingTask(existingTaskId, input);

    if (!taskResult.videoUrl) {
      throw new HttpError(502, `Kling task ${existingTaskId} completed without a downloadable video URL`);
    }

    const videoResponse = await axios.get<ArrayBuffer>(taskResult.videoUrl, {
      responseType: "arraybuffer"
    });

    await fs.writeFile(input.outputPath, Buffer.from(videoResponse.data));

    return {
      provider: "kling",
      providerTaskId: existingTaskId,
      providerRequestId: taskResult.providerRequestId,
      providerOutputId: taskResult.videoId ?? undefined,
      providerRequestPayload: resumeRequestPayload,
      providerUnitsConsumed: taskResult.providerUnitsConsumed,
      providerTerminalPayload: taskResult.providerTerminalPayload,
      outputPath: input.outputPath
    };
  }

  await ensureNotCanceled(input);
  const requestBody = {
    model: input.model ?? env.KLING_MODEL,
    prompt: input.prompt,
    duration: input.durationSeconds ?? env.KLING_DURATION_SECONDS,
    aspect_ratio: input.aspectRatio ?? env.KLING_ASPECT_RATIO,
    negative_prompt: input.negativePrompt ?? env.KLING_NEGATIVE_PROMPT ?? undefined,
    ...(input.mode ?? env.KLING_MODE ? { mode: input.mode ?? env.KLING_MODE } : {}),
    ...(input.cfgScale !== undefined ? { cfg_scale: input.cfgScale } : {}),
    ...(input.cameraControl ? { camera_control: input.cameraControl } : {})
  };
  const requestPayload = stringifyPayload(requestBody);

  let response: { data: KlingEnvelope<KlingSubmitData> } | undefined;
  try {
    console.log('body: ', requestBody);
    // response = await axios.post<KlingEnvelope<KlingSubmitData>>(
    //   textToVideoUrl,
    //   requestBody,
    //   {
    //     headers: {
    //       Authorization: getKlingAuthHeader(),
    //       "Content-Type": "application/json"
    //     }
    //   }
    // );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[kling] submit error status=${error.response?.status ?? "network"} body=${stringifyPayload(error.response?.data)}`
      );
    }
    throw error;
  }

  if (!response) {
    throw new HttpError(503, "Kling submit is currently disabled in the provider code");
  }

  console.log(`[kling] submit request url=${textToVideoUrl} payload=${requestPayload}`);
  console.log(`[kling] submit response payload=${stringifyPayload(response.data)}`);

  const apiError = getKlingErrorMessage(response.data);
  if (apiError) {
    throw new HttpError(502, apiError);
  }

  const taskId = extractTaskId(response.data);

  if (!taskId) {
    throw new HttpError(502, "Kling response did not include a task ID");
  }

  await input.onProviderTaskCreated?.({
    providerTaskId: taskId,
    providerRequestId: response.data.request_id ?? response.data.requestId,
    providerRequestPayload: requestPayload
  });

  const taskResult = await pollKlingTask(taskId, input);

  if (!taskResult.videoUrl) {
    throw new HttpError(502, `Kling task ${taskId} completed without a downloadable video URL`);
  }

  const videoResponse = await axios.get<ArrayBuffer>(taskResult.videoUrl, {
    responseType: "arraybuffer"
  });

  await fs.writeFile(input.outputPath, Buffer.from(videoResponse.data));

  return {
    provider: "kling",
    providerTaskId: taskId,
    providerRequestId: taskResult.providerRequestId,
    providerOutputId: taskResult.videoId ?? undefined,
    providerRequestPayload: requestPayload,
    providerUnitsConsumed: taskResult.providerUnitsConsumed,
    providerTerminalPayload: taskResult.providerTerminalPayload,
    outputPath: input.outputPath
  };
}

export async function extendKlingVideoClip(
  input: ExtendVideoClipInput
): Promise<GenerateVideoClipResult> {
  const extendUrl = `${env.KLING_API_BASE_URL}/v1/videos/video-extend`;
  const resumeRequestPayload = stringifyPayload({
    video_id: input.videoId,
    prompt: input.prompt
  });
  const existingTaskId = input.providerTaskId?.trim();
  if (existingTaskId) {
    console.log(`[kling] resuming extend task=${existingTaskId} url=${extendUrl} request=${resumeRequestPayload}`);
    await ensureNotCanceled(input);
    const taskResult = await pollKlingTask(existingTaskId, input as GenerateVideoClipInput);

    if (!taskResult.videoUrl) {
      throw new HttpError(502, `Kling extend task ${existingTaskId} completed without a downloadable video URL`);
    }

    const videoResponse = await axios.get<ArrayBuffer>(taskResult.videoUrl, {
      responseType: "arraybuffer"
    });

    await fs.writeFile(input.outputPath, Buffer.from(videoResponse.data));

    return {
      provider: "kling",
      providerTaskId: existingTaskId,
      providerRequestId: taskResult.providerRequestId,
      providerOutputId: taskResult.videoId ?? undefined,
      providerRequestPayload: resumeRequestPayload,
      providerUnitsConsumed: taskResult.providerUnitsConsumed,
      providerTerminalPayload: taskResult.providerTerminalPayload,
      outputPath: input.outputPath
    };
  }

  await ensureNotCanceled(input as GenerateVideoClipInput);
  const requestBody = {
    video_id: input.videoId,
    prompt: input.prompt
  };
  const requestPayload = stringifyPayload(requestBody);

  let response: { data: KlingEnvelope<KlingSubmitData> } | undefined;
  try {
    response = await axios.post<KlingEnvelope<KlingSubmitData>>(
      extendUrl,
      requestBody,
      {
        headers: {
          Authorization: getKlingAuthHeader(),
          "Content-Type": "application/json"
        }
      }
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `[kling] extend submit error status=${error.response?.status ?? "network"} body=${stringifyPayload(error.response?.data)}`
      );
    }
    throw error;
  }

  if (!response) {
    throw new HttpError(503, "Kling extend submit is currently disabled in the provider code");
  }

  console.log(`[kling] extend request url=${extendUrl} payload=${requestPayload}`);
  console.log(`[kling] extend response payload=${stringifyPayload(response.data)}`);

  const apiError = getKlingErrorMessage(response.data);
  if (apiError) {
    throw new HttpError(502, apiError);
  }

  const taskId = extractTaskId(response.data);

  if (!taskId) {
    throw new HttpError(502, "Kling extend response did not include a task ID");
  }

  await input.onProviderTaskCreated?.({
    providerTaskId: taskId,
    providerRequestId: response.data.request_id ?? response.data.requestId,
    providerRequestPayload: requestPayload
  });

  const taskResult = await pollKlingTask(taskId, input as GenerateVideoClipInput);

  if (!taskResult.videoUrl) {
    throw new HttpError(502, `Kling extend task ${taskId} completed without a downloadable video URL`);
  }

  const videoResponse = await axios.get<ArrayBuffer>(taskResult.videoUrl, {
    responseType: "arraybuffer"
  });

  await fs.writeFile(input.outputPath, Buffer.from(videoResponse.data));

  return {
    provider: "kling",
    providerTaskId: taskId,
    providerRequestId: taskResult.providerRequestId,
    providerOutputId: taskResult.videoId ?? undefined,
    providerRequestPayload: requestPayload,
    providerUnitsConsumed: taskResult.providerUnitsConsumed,
    providerTerminalPayload: taskResult.providerTerminalPayload,
    outputPath: input.outputPath
  };
}
