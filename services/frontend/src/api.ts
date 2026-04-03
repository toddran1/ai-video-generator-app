import type {
  ApiResponse,
  GenerationJobStatus,
  Project,
  ProjectGenerationStatus,
  ProjectPlanningSettings,
  ProjectShotPlanItem
} from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function listProjects() {
  return request<ApiResponse<Project[]>>("/projects");
}

export async function createProject(input: { title: string; prompt: string } & ProjectPlanningSettings) {
  return request<ApiResponse<Project>>("/projects", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export async function updateProjectSettings(projectId: string, input: ProjectPlanningSettings) {
  return request<ApiResponse<Project>>(`/projects/${projectId}/settings`, {
    method: "PUT",
    body: JSON.stringify(input)
  });
}

export async function getProjectShotPlan(projectId: string) {
  return request<ApiResponse<Array<{
    id: string;
    project_id: string;
    shot_number: number;
    description: string;
    duration_seconds: number;
    negative_prompt: string | null;
    camera_notes: string | null;
    created_at: string;
    updated_at: string;
  }>>>(`/projects/${projectId}/shot-plan`);
}

export async function getProjectAutoShotPlan(projectId: string) {
  return request<ApiResponse<ProjectShotPlanItem[]>>(`/projects/${projectId}/auto-shot-plan`);
}

export async function updateProjectShotPlan(projectId: string, shots: ProjectShotPlanItem[]) {
  return request<ApiResponse<Array<{
    id: string;
    project_id: string;
    shot_number: number;
    description: string;
    duration_seconds: number;
    negative_prompt: string | null;
    camera_notes: string | null;
    created_at: string;
    updated_at: string;
  }>>>(`/projects/${projectId}/shot-plan`, {
    method: "PUT",
    body: JSON.stringify({ shots })
  });
}

export async function generateProject(projectId: string, profile: "testing" | "production") {
  return request<ApiResponse<{ id: string; status: string; projectId: string }>>("/generate", {
    method: "POST",
    body: JSON.stringify({ projectId, profile })
  });
}

export async function retryGenerationJob(jobId: string) {
  return request<ApiResponse<{ id: string; status: string; projectId: string }>>(`/generate/jobs/${jobId}/retry`, {
    method: "POST"
  });
}

export async function retryGenerationShot(jobId: string, shotNumber: number) {
  return request<ApiResponse<{ id: string; status: string; projectId: string; shotNumber: number }>>(
    `/generate/jobs/${jobId}/shots/${shotNumber}/retry`,
    { method: "POST" }
  );
}

export async function cancelGenerationShot(jobId: string, shotNumber: number) {
  return request<ApiResponse<{ id: string; status: string; projectId: string; shotNumber: number }>>(
    `/generate/jobs/${jobId}/shots/${shotNumber}/cancel`,
    { method: "POST" }
  );
}

export async function getProjectGenerationStatus(projectId: string) {
  return request<ApiResponse<ProjectGenerationStatus>>(`/generate/projects/${projectId}/status`);
}

export async function getGenerationJob(jobId: string) {
  return request<ApiResponse<GenerationJobStatus>>(`/generate/jobs/${jobId}`);
}
