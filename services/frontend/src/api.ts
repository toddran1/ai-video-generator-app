import type {
  ApiResponse,
  GenerationJobStatus,
  Project,
  ProjectGenerationStatus,
  ProjectPlanningSettings,
  ProjectShotPlanItem,
  VideoProviderConfig
} from "./types";

function toTitleCase(value: string) {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseApiError(body: string, status: number) {
  if (!body) {
    return `Request failed with status ${status}`;
  }

  try {
    const parsed = JSON.parse(body) as { error?: string };
    const errorText = parsed.error ?? body;

    try {
      const issues = JSON.parse(errorText) as Array<{
        path?: Array<string | number>;
        message?: string;
      }>;

      if (Array.isArray(issues) && issues.length > 0) {
        return issues
          .map((issue) => {
            const field = issue.path?.length ? toTitleCase(String(issue.path[0])) : "Field";
            return `${field}: ${issue.message ?? "Invalid value"}`;
          })
          .join("\n");
      }
    } catch {
      return errorText;
    }

    return errorText;
  } catch {
    return body;
  }
}

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
    throw new Error(parseApiError(body, response.status));
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
    beat_label: string | null;
    description: string;
    duration_seconds: number;
    generation_mode: string | null;
    source_shot_number: number | null;
    extend_prompt: string | null;
    negative_prompt: string | null;
    camera_notes: string | null;
    kling_mode: string | null;
    kling_cfg_scale: number | null;
    kling_camera_control_type: string | null;
    kling_camera_horizontal: number | null;
    kling_camera_vertical: number | null;
    kling_camera_pan: number | null;
    kling_camera_tilt: number | null;
    kling_camera_roll: number | null;
    kling_camera_zoom: number | null;
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
    beat_label: string | null;
    description: string;
    duration_seconds: number;
    generation_mode: string | null;
    source_shot_number: number | null;
    extend_prompt: string | null;
    negative_prompt: string | null;
    camera_notes: string | null;
    kling_mode: string | null;
    kling_cfg_scale: number | null;
    kling_camera_control_type: string | null;
    kling_camera_horizontal: number | null;
    kling_camera_vertical: number | null;
    kling_camera_pan: number | null;
    kling_camera_tilt: number | null;
    kling_camera_roll: number | null;
    kling_camera_zoom: number | null;
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

export async function getVideoProviderConfig() {
  return request<ApiResponse<VideoProviderConfig>>("/generate/provider-config");
}
