import { env } from "../config/env.js";
import { pool } from "./pool.js";

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function bootstrapDatabase(): Promise<void> {
  const maxAttempts = 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY,
          title TEXT NOT NULL,
          prompt TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          output_url TEXT,
          target_shot_count INTEGER,
          default_beat_duration INTEGER,
          aspect_ratio TEXT,
          style_hint TEXT,
          narrative_mode TEXT,
          auto_beat_descriptions BOOLEAN NOT NULL DEFAULT TRUE,
          kling_model TEXT,
          kling_mode TEXT,
          kling_cfg_scale DOUBLE PRECISION,
          kling_camera_control_type TEXT,
          kling_camera_control_axis TEXT,
          kling_camera_control_value DOUBLE PRECISION,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS target_shot_count INTEGER
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS default_beat_duration INTEGER
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS aspect_ratio TEXT
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS style_hint TEXT
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS narrative_mode TEXT
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS auto_beat_descriptions BOOLEAN NOT NULL DEFAULT TRUE
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS kling_mode TEXT
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS kling_model TEXT
      `);

      await pool.query(
        `
          UPDATE projects
          SET kling_model = $1
          WHERE kling_model IS NULL
        `,
        [env.KLING_MODEL]
      );

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS kling_cfg_scale DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS kling_camera_control_type TEXT
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS kling_camera_control_axis TEXT
      `);

      await pool.query(`
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS kling_camera_control_value DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE projects
        ALTER COLUMN kling_camera_control_type TYPE TEXT
        USING kling_camera_control_type::TEXT
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS generation_jobs (
          id UUID PRIMARY KEY,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          status TEXT NOT NULL,
          cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
          generation_profile TEXT NOT NULL DEFAULT 'selected-model',
          planner_provider TEXT NOT NULL DEFAULT 'python-service',
          video_provider TEXT NOT NULL DEFAULT 'mock',
          provider_model TEXT,
          shot_count INTEGER,
          output_path TEXT,
          output_url TEXT,
          metadata_url TEXT,
          error_message TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await pool.query(`
        ALTER TABLE generation_jobs
        ADD COLUMN IF NOT EXISTS planner_provider TEXT NOT NULL DEFAULT 'python-service'
      `);

      await pool.query(`
        ALTER TABLE generation_jobs
        ADD COLUMN IF NOT EXISTS output_url TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_jobs
        ADD COLUMN IF NOT EXISTS video_provider TEXT NOT NULL DEFAULT 'mock'
      `);

      await pool.query(`
        ALTER TABLE generation_jobs
        ADD COLUMN IF NOT EXISTS cancel_requested BOOLEAN NOT NULL DEFAULT FALSE
      `);

      await pool.query(`
        ALTER TABLE generation_jobs
        ADD COLUMN IF NOT EXISTS generation_profile TEXT NOT NULL DEFAULT 'selected-model'
      `);

      await pool.query(`
        ALTER TABLE generation_jobs
        ALTER COLUMN generation_profile SET DEFAULT 'selected-model'
      `);

      await pool.query(`
        ALTER TABLE generation_jobs
        ADD COLUMN IF NOT EXISTS metadata_url TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_jobs
        ADD COLUMN IF NOT EXISTS provider_model TEXT
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS generation_shots (
          id UUID PRIMARY KEY,
          job_id UUID NOT NULL REFERENCES generation_jobs(id) ON DELETE CASCADE,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          shot_number INTEGER NOT NULL,
          beat_label TEXT,
          description TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          generation_mode TEXT,
          source_shot_number INTEGER,
          extend_prompt TEXT,
          negative_prompt TEXT,
          camera_notes TEXT,
          kling_mode TEXT,
          kling_cfg_scale DOUBLE PRECISION,
          kling_camera_control_type TEXT,
          kling_camera_horizontal DOUBLE PRECISION,
          kling_camera_vertical DOUBLE PRECISION,
          kling_camera_pan DOUBLE PRECISION,
          kling_camera_tilt DOUBLE PRECISION,
          kling_camera_roll DOUBLE PRECISION,
          kling_camera_zoom DOUBLE PRECISION,
          status TEXT NOT NULL,
          provider TEXT NOT NULL,
          provider_task_id TEXT,
          provider_request_id TEXT,
          source_provider_output_id TEXT,
          source_provider_duration_seconds DOUBLE PRECISION,
          provider_output_id TEXT,
          provider_output_duration_seconds DOUBLE PRECISION,
          provider_request_payload TEXT,
          provider_units_consumed TEXT,
          provider_terminal_payload TEXT,
          stitched_segment_path TEXT,
          stitched_segment_url TEXT,
          stitched_segment_start_seconds DOUBLE PRECISION,
          stitched_segment_duration_seconds DOUBLE PRECISION,
          asset_path TEXT,
          asset_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (job_id, shot_number)
        )
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS beat_label TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS provider_task_id TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS provider_request_id TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS source_provider_output_id TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS source_provider_duration_seconds DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS generation_mode TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS source_shot_number INTEGER
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS extend_prompt TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS negative_prompt TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS camera_notes TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS kling_mode TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS kling_cfg_scale DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS kling_camera_control_type TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS kling_camera_horizontal DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS kling_camera_vertical DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS kling_camera_pan DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS kling_camera_tilt DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS kling_camera_roll DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS kling_camera_zoom DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS provider_output_id TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS provider_output_duration_seconds DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS provider_request_payload TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS provider_units_consumed TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS provider_terminal_payload TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS stitched_segment_path TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS stitched_segment_url TEXT
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS stitched_segment_start_seconds DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS stitched_segment_duration_seconds DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE generation_shots
        ADD COLUMN IF NOT EXISTS error_message TEXT
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS project_shot_plans (
          id UUID PRIMARY KEY,
          project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          shot_number INTEGER NOT NULL,
          beat_label TEXT,
          description TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          generation_mode TEXT,
          source_shot_number INTEGER,
          extend_prompt TEXT,
          negative_prompt TEXT,
          camera_notes TEXT,
          kling_mode TEXT,
          kling_cfg_scale DOUBLE PRECISION,
          kling_camera_control_type TEXT,
          kling_camera_horizontal DOUBLE PRECISION,
          kling_camera_vertical DOUBLE PRECISION,
          kling_camera_pan DOUBLE PRECISION,
          kling_camera_tilt DOUBLE PRECISION,
          kling_camera_roll DOUBLE PRECISION,
          kling_camera_zoom DOUBLE PRECISION,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (project_id, shot_number)
        )
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS beat_label TEXT
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS negative_prompt TEXT
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS generation_mode TEXT
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS source_shot_number INTEGER
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS extend_prompt TEXT
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS camera_notes TEXT
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS kling_mode TEXT
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS kling_cfg_scale DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS kling_camera_control_type TEXT
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS kling_camera_horizontal DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS kling_camera_vertical DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS kling_camera_pan DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS kling_camera_tilt DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS kling_camera_roll DOUBLE PRECISION
      `);

      await pool.query(`
        ALTER TABLE project_shot_plans
        ADD COLUMN IF NOT EXISTS kling_camera_zoom DOUBLE PRECISION
      `);

      return;
    } catch (error) {
      if (attempt === maxAttempts) {
        throw error;
      }

      await sleep(2000);
    }
  }
}
