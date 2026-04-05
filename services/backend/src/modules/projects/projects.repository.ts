import { pool } from "../../db/pool.js";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../config/env.js";
import type { ProjectPlanningSettings, ProjectShotPlanRecord, ShotPlanItem } from "../generate/generate.types.js";

export interface ProjectRecord {
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
  kling_model: string | null;
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

export async function createProject(params: {
  id: string;
  title: string;
  prompt: string;
  targetShotCount?: number | null;
  defaultBeatDuration?: number | null;
  aspectRatio?: string | null;
  styleHint?: string | null;
  narrativeMode?: string | null;
  autoBeatDescriptions?: boolean | null;
  klingModel?: string | null;
  klingMode?: string | null;
  klingCfgScale?: number | null;
  klingCameraControlType?: string | null;
  klingCameraHorizontal?: number | null;
  klingCameraVertical?: number | null;
  klingCameraPan?: number | null;
  klingCameraTilt?: number | null;
  klingCameraRoll?: number | null;
  klingCameraZoom?: number | null;
}): Promise<ProjectRecord> {
  const result = await pool.query<ProjectRecord>(
    `
      INSERT INTO projects (
        id,
        title,
        prompt,
        status,
        target_shot_count,
        default_beat_duration,
        aspect_ratio,
        style_hint,
        narrative_mode,
        auto_beat_descriptions,
        kling_model,
        kling_mode,
        kling_cfg_scale,
        kling_camera_control_type,
        kling_camera_horizontal,
        kling_camera_vertical,
        kling_camera_pan,
        kling_camera_tilt,
        kling_camera_roll,
        kling_camera_zoom
      )
      VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `,
    [
      params.id,
      params.title,
      params.prompt,
      params.targetShotCount ?? null,
      params.defaultBeatDuration ?? null,
      params.aspectRatio ?? null,
      params.styleHint ?? null,
      params.narrativeMode ?? null,
      params.autoBeatDescriptions ?? true,
      params.klingModel ?? env.KLING_MODEL,
      params.klingMode ?? null,
      params.klingCfgScale ?? null,
      params.klingCameraControlType ?? null,
      params.klingCameraHorizontal ?? null,
      params.klingCameraVertical ?? null,
      params.klingCameraPan ?? null,
      params.klingCameraTilt ?? null,
      params.klingCameraRoll ?? null,
      params.klingCameraZoom ?? null
    ]
  );

  return result.rows[0];
}

export async function getProjectById(id: string): Promise<ProjectRecord | null> {
  const result = await pool.query<ProjectRecord>("SELECT * FROM projects WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const result = await pool.query<ProjectRecord>(`
    SELECT *
    FROM projects
    ORDER BY created_at DESC
  `);

  return result.rows;
}

export async function updateProjectStatus(params: {
  id: string;
  status: string;
  outputUrl?: string | null;
}): Promise<void> {
  await pool.query(
    `
      UPDATE projects
      SET status = $2,
          output_url = COALESCE($3, output_url),
          updated_at = NOW()
      WHERE id = $1
    `,
    [params.id, params.status, params.outputUrl ?? null]
  );
}

export async function resetProjectForRetry(id: string): Promise<void> {
  await pool.query(
    `
      UPDATE projects
      SET status = 'queued',
          output_url = NULL,
          updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );
}

export async function updateProjectPlanningSettings(
  id: string,
  settings: ProjectPlanningSettings
): Promise<ProjectRecord | null> {
  const result = await pool.query<ProjectRecord>(
    `
      UPDATE projects
      SET target_shot_count = $2,
          default_beat_duration = $3,
          aspect_ratio = $4,
          style_hint = $5,
          narrative_mode = $6,
          auto_beat_descriptions = COALESCE($7, auto_beat_descriptions),
          kling_model = $8,
          kling_mode = $9,
          kling_cfg_scale = $10,
          kling_camera_control_type = $11,
          kling_camera_horizontal = $12,
          kling_camera_vertical = $13,
          kling_camera_pan = $14,
          kling_camera_tilt = $15,
          kling_camera_roll = $16,
          kling_camera_zoom = $17,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      settings.targetShotCount ?? null,
      settings.defaultBeatDuration ?? null,
      settings.aspectRatio ?? null,
      settings.styleHint ?? null,
      settings.narrativeMode ?? null,
      settings.autoBeatDescriptions ?? null,
      settings.klingModel ?? env.KLING_MODEL,
      settings.klingMode ?? null,
      settings.klingCfgScale ?? null,
      settings.klingCameraControlType ?? null,
      settings.klingCameraHorizontal ?? null,
      settings.klingCameraVertical ?? null,
      settings.klingCameraPan ?? null,
      settings.klingCameraTilt ?? null,
      settings.klingCameraRoll ?? null,
      settings.klingCameraZoom ?? null
    ]
  );

  return result.rows[0] ?? null;
}

export async function listProjectShotPlans(projectId: string): Promise<ProjectShotPlanRecord[]> {
  const result = await pool.query<ProjectShotPlanRecord>(
    `
      SELECT *
      FROM project_shot_plans
      WHERE project_id = $1
      ORDER BY shot_number ASC
    `,
    [projectId]
  );

  return result.rows;
}

export async function replaceProjectShotPlans(projectId: string, shots: ShotPlanItem[]): Promise<ProjectShotPlanRecord[]> {
  await pool.query("DELETE FROM project_shot_plans WHERE project_id = $1", [projectId]);

  const inserted: ProjectShotPlanRecord[] = [];

  for (const shot of shots) {
    const result = await pool.query<ProjectShotPlanRecord>(
      `
        INSERT INTO project_shot_plans (
          id,
          project_id,
          shot_number,
          beat_label,
          description,
          duration_seconds,
          generation_mode,
          source_shot_number,
          extend_prompt,
          negative_prompt,
          camera_notes,
          kling_mode,
          kling_cfg_scale,
          kling_camera_control_type,
          kling_camera_horizontal,
          kling_camera_vertical,
          kling_camera_pan,
          kling_camera_tilt,
          kling_camera_roll,
          kling_camera_zoom
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *
      `,
      [
        uuidv4(),
        projectId,
        shot.shotNumber,
        shot.beatLabel ?? null,
        shot.description,
        shot.durationSeconds,
        shot.generationMode ?? null,
        shot.sourceShotNumber ?? null,
        shot.extendPrompt ?? null,
        shot.negativePrompt ?? null,
        shot.cameraNotes ?? null,
        shot.klingMode ?? null,
        shot.klingCfgScale ?? null,
        shot.klingCameraControlType ?? null,
        shot.klingCameraHorizontal ?? null,
        shot.klingCameraVertical ?? null,
        shot.klingCameraPan ?? null,
        shot.klingCameraTilt ?? null,
        shot.klingCameraRoll ?? null,
        shot.klingCameraZoom ?? null
      ]
    );

    inserted.push(result.rows[0]);
  }

  return inserted;
}
