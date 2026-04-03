export interface ShotPlanItem {
  shotNumber: number;
  description: string;
  durationSeconds: number;
}

export interface GenerationJobRecord {
  id: string;
  project_id: string;
  status: string;
  cancel_requested?: boolean;
  generation_profile?: string;
  planner_provider: string;
  video_provider: string;
  provider_model?: string | null;
  shot_count: number | null;
  output_path: string | null;
  output_url: string | null;
  metadata_url?: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenerationShotRecord {
  id: string;
  job_id: string;
  project_id: string;
  shot_number: number;
  description: string;
  duration_seconds: number;
  status: string;
  provider: string;
  provider_task_id: string | null;
  provider_request_id: string | null;
  provider_units_consumed: string | null;
  provider_terminal_payload: string | null;
  asset_path: string | null;
  asset_url: string | null;
  created_at: string;
  updated_at: string;
}
