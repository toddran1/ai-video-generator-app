import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { generateVideoSchema } from "./generate.schemas.js";
import {
  cancelGenerationJob,
  cancelGenerationShot,
  enqueueGeneration,
  getProviderConfig,
  getGenerationJobStatus,
  getProjectGenerationStatus,
  retryGenerationJob,
  retryGenerationShot
} from "./generate.service.js";

export const generateRouter = Router();

generateRouter.get(
  "/provider-config",
  asyncHandler(async (_req, res) => {
    const result = await getProviderConfig();
    res.json({ data: result });
  })
);

generateRouter.get(
  "/jobs/:jobId",
  asyncHandler(async (req, res) => {
    const result = await getGenerationJobStatus(String(req.params.jobId));
    res.json({ data: result });
  })
);

generateRouter.get(
  "/projects/:projectId/status",
  asyncHandler(async (req, res) => {
    const result = await getProjectGenerationStatus(String(req.params.projectId));
    res.json({ data: result });
  })
);

generateRouter.post(
  "/jobs/:jobId/cancel",
  asyncHandler(async (req, res) => {
    const result = await cancelGenerationJob(String(req.params.jobId));
    res.status(202).json({ data: result });
  })
);

generateRouter.post(
  "/jobs/:jobId/retry",
  asyncHandler(async (req, res) => {
    const result = await retryGenerationJob(String(req.params.jobId));
    res.status(202).json({ data: result });
  })
);

generateRouter.post(
  "/jobs/:jobId/shots/:shotNumber/retry",
  asyncHandler(async (req, res) => {
    const result = await retryGenerationShot(String(req.params.jobId), Number(req.params.shotNumber));
    res.status(202).json({ data: result });
  })
);

generateRouter.post(
  "/jobs/:jobId/shots/:shotNumber/cancel",
  asyncHandler(async (req, res) => {
    const result = await cancelGenerationShot(String(req.params.jobId), Number(req.params.shotNumber));
    res.status(202).json({ data: result });
  })
);

generateRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = generateVideoSchema.parse(req.body);
    const job = await enqueueGeneration(input.projectId);
    res.status(202).json({ data: job });
  })
);
