import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import {
  createProjectRecord,
  getProjectOrThrow,
  getProjectShotPlanOrThrow,
  listProjectRecords,
  previewAutoShotPlan,
  updateProjectShotPlan
} from "./projects.service.js";
import { createProjectSchema, updateProjectShotPlanSchema } from "./projects.schemas.js";

export const projectsRouter = Router();

projectsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const projects = await listProjectRecords();
    res.json({ data: projects });
  })
);

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createProjectSchema.parse(req.body);
    const project = await createProjectRecord(input);
    res.status(201).json({ data: project });
  })
);

projectsRouter.get(
  "/:projectId",
  asyncHandler(async (req, res) => {
    const project = await getProjectOrThrow(String(req.params.projectId));
    res.json({ data: project });
  })
);

projectsRouter.get(
  "/:projectId/auto-shot-plan",
  asyncHandler(async (req, res) => {
    const shots = await previewAutoShotPlan(String(req.params.projectId));
    res.json({ data: shots });
  })
);

projectsRouter.get(
  "/:projectId/shot-plan",
  asyncHandler(async (req, res) => {
    const shots = await getProjectShotPlanOrThrow(String(req.params.projectId));
    res.json({ data: shots });
  })
);

projectsRouter.put(
  "/:projectId/shot-plan",
  asyncHandler(async (req, res) => {
    const input = updateProjectShotPlanSchema.parse(req.body);
    const shots = await updateProjectShotPlan(String(req.params.projectId), input);
    res.json({ data: shots });
  })
);
