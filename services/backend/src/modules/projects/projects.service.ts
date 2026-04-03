import { v4 as uuidv4 } from "uuid";
import { HttpError } from "../../lib/http-error.js";
import { createProject, getProjectById, listProjects } from "./projects.repository.js";
import type { CreateProjectInput } from "./projects.schemas.js";

export async function createProjectRecord(input: CreateProjectInput) {
  return createProject({
    id: uuidv4(),
    title: input.title,
    prompt: input.prompt
  });
}

export async function getProjectOrThrow(projectId: string) {
  const project = await getProjectById(projectId);

  if (!project) {
    throw new HttpError(404, "Project not found");
  }

  return project;
}

export async function listProjectRecords() {
  return listProjects();
}
