export interface Project {
  id: string;
  title: string;
  prompt: string;
  status: string;
  output_url: string | null;
  target_shot_count: number | null;
  default_beat_duration: number | null;
  aspect_ratio: string | null;
  style_hint: string | null;
  narrative_mode: string | null;
  auto_beat_descriptions: boolean;
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

export interface ProjectPlanningSettings {
  targetShotCount?: number | null;
  defaultBeatDuration?: number | null;
  aspectRatio?: "16:9" | "9:16" | "1:1" | null;
  styleHint?: string | null;
  narrativeMode?: "3-beat-story" | "5-beat-story" | "fight-scene" | "dialogue-scene" | "reveal-arc" | null;
  autoBeatDescriptions?: boolean | null;
  klingMode?: string | null;
  klingCfgScale?: number | null;
  klingCameraControlType?: "simple" | "down_back" | "forward_up" | "right_turn_forward" | "left_turn_forward" | null;
  klingCameraHorizontal?: number | null;
  klingCameraVertical?: number | null;
  klingCameraPan?: number | null;
  klingCameraTilt?: number | null;
  klingCameraRoll?: number | null;
  klingCameraZoom?: number | null;
}

export interface ProjectShotPlanItem {
  shotNumber: number;
  beatLabel?: string | null;
  description: string;
  durationSeconds: number;
  generationMode?: "generate" | "extend-previous" | null;
  sourceShotNumber?: number | null;
  extendPrompt?: string | null;
  negativePrompt?: string | null;
  cameraNotes?: string | null;
  klingMode?: "std" | "pro" | null;
  klingCfgScale?: number | null;
  klingCameraControlType?: "simple" | "down_back" | "forward_up" | "right_turn_forward" | "left_turn_forward" | null;
  klingCameraHorizontal?: number | null;
  klingCameraVertical?: number | null;
  klingCameraPan?: number | null;
  klingCameraTilt?: number | null;
  klingCameraRoll?: number | null;
  klingCameraZoom?: number | null;
}

export interface ApiResponse<T> {
  data: T;
}

export interface VideoProviderConfig {
  provider: string;
  durations: number[];
  aspectRatios: string[];
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
  beat_label?: string | null;
  description: string;
  duration_seconds: number;
  generation_mode?: string | null;
  source_shot_number?: number | null;
  extend_prompt?: string | null;
  negative_prompt?: string | null;
  camera_notes?: string | null;
  kling_mode?: string | null;
  kling_cfg_scale?: number | null;
  kling_camera_control_type?: string | null;
  kling_camera_horizontal?: number | null;
  kling_camera_vertical?: number | null;
  kling_camera_pan?: number | null;
  kling_camera_tilt?: number | null;
  kling_camera_roll?: number | null;
  kling_camera_zoom?: number | null;
  status: string;
  provider: string;
  asset_path: string | null;
  asset_url: string | null;
  provider_task_id: string | null;
  provider_request_id: string | null;
  source_provider_output_id?: string | null;
  source_provider_duration_seconds?: number | null;
  provider_output_id?: string | null;
  provider_output_duration_seconds?: number | null;
  provider_request_payload?: string | null;
  provider_units_consumed: string | null;
  provider_terminal_payload?: string | null;
  error_message?: string | null;
  stitched_segment_path?: string | null;
  stitched_segment_url?: string | null;
  stitched_segment_start_seconds?: number | null;
  stitched_segment_duration_seconds?: number | null;
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
