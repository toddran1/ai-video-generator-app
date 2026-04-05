export interface ShotPlanItem {
  shotNumber: number;
  beatLabel?: string | null;
  description: string;
  durationSeconds: number;
  generationMode?: "generate" | "extend-previous" | null;
  sourceShotNumber?: number | null;
  extendPrompt?: string | null;
  negativePrompt?: string | null;
  cameraNotes?: string | null;
  klingMode?: string | null;
  klingCfgScale?: number | null;
  klingCameraControlType?: string | null;
  klingCameraHorizontal?: number | null;
  klingCameraVertical?: number | null;
  klingCameraPan?: number | null;
  klingCameraTilt?: number | null;
  klingCameraRoll?: number | null;
  klingCameraZoom?: number | null;
}

export interface ProjectPlanningSettings {
  targetShotCount?: number | null;
  defaultBeatDuration?: number | null;
  aspectRatio?: string | null;
  styleHint?: string | null;
  narrativeMode?: string | null;
  autoBeatDescriptions?: boolean | null;
  klingMode?: string | null;
  klingCfgScale?: number | null;
  klingCameraControlType?: string | null;
  klingCameraHorizontal?: number | null;
  klingCameraVertical?: number | null;
  klingCameraPan?: number | null;
  klingCameraTilt?: number | null;
  klingCameraRoll?: number | null;
  klingCameraZoom?: number | null;
}

export interface ProjectShotPlanRecord {
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
  status: string;
  provider: string;
  provider_task_id: string | null;
  provider_request_id: string | null;
  source_provider_output_id: string | null;
  source_provider_duration_seconds: number | null;
  provider_output_id: string | null;
  provider_output_duration_seconds: number | null;
  provider_request_payload: string | null;
  provider_units_consumed: string | null;
  provider_terminal_payload: string | null;
  error_message: string | null;
  stitched_segment_path: string | null;
  stitched_segment_url: string | null;
  stitched_segment_start_seconds: number | null;
  stitched_segment_duration_seconds: number | null;
  asset_path: string | null;
  asset_url: string | null;
  created_at: string;
  updated_at: string;
}
