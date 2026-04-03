export interface Project {
  id: string;
  title: string;
  prompt: string;
  status: string;
  output_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectShotPlanItem {
  shotNumber: number;
  description: string;
  durationSeconds: number;
  negativePrompt?: string | null;
  cameraNotes?: string | null;
}

export interface ApiResponse<T> {
  data: T;
}

export interface GenerationJob {
  id: string;
  project_id: string;
  status: string;
  generation_profile?: string;
  planner_provider: string;
  video_provider?: string;
  metadata_url?: string | null;
  provider_model?: string | null;
  shot_count: number | null;
  output_path: string | null;
  output_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationShot {
  id: string;
  job_id: string;
  project_id: string;
  shot_number: number;
  description: string;
  duration_seconds: number;
  status: string;
  provider: string;
  asset_path: string | null;
  asset_url: string | null;
  provider_task_id: string | null;
  provider_request_id: string | null;
  provider_units_consumed: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectGenerationStatus {
  project: Project;
  jobs: GenerationJob[];
  shots: GenerationShot[];
}

export interface GenerationJobStatus {
  job: GenerationJob;
  shots: GenerationShot[];
}
