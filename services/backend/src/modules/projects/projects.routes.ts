import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { createProjectRecord, getProjectOrThrow, listProjectRecords } from "./projects.service.js";
import { createProjectSchema } from "./projects.schemas.js";

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
