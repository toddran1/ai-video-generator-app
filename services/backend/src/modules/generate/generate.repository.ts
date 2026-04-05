import { pool } from "../../db/pool.js";
import { v4 as uuidv4 } from "uuid";
import type { GenerationJobRecord, GenerationShotRecord, ShotPlanItem } from "./generate.types.js";

export async function createGenerationJob(params: {
  id: string;
  projectId: string;
  status: string;
  generationProfile: string;
  plannerProvider: string;
  videoProvider: string;
  providerModel: string;
}): Promise<GenerationJobRecord> {
  const result = await pool.query<GenerationJobRecord>(
    `
      INSERT INTO generation_jobs (
        id,
        project_id,
        status,
        cancel_requested,
        generation_profile,
        planner_provider,
        video_provider,
        provider_model
      )
      VALUES ($1, $2, $3, FALSE, $4, $5, $6, $7)
      RETURNING *
    `,
    [
      params.id,
      params.projectId,
      params.status,
      params.generationProfile,
      params.plannerProvider,
      params.videoProvider,
      params.providerModel
    ]
  );

  return result.rows[0];
}

export async function updateGenerationJob(params: {
  id: string;
  status: string;
  cancelRequested?: boolean;
  generationProfile?: string;
  plannerProvider?: string;
  videoProvider?: string;
  providerModel?: string;
  shotCount?: number;
  outputPath?: string;
  outputUrl?: string;
  metadataUrl?: string;
  errorMessage?: string;
}): Promise<void> {
  await pool.query(
    `
      UPDATE generation_jobs
      SET status = $2,
          cancel_requested = COALESCE($3, cancel_requested),
          generation_profile = COALESCE($4, generation_profile),
          planner_provider = COALESCE($5, planner_provider),
          video_provider = COALESCE($6, video_provider),
          provider_model = COALESCE($7, provider_model),
          shot_count = COALESCE($8, shot_count),
          output_path = COALESCE($9, output_path),
          output_url = COALESCE($10, output_url),
          metadata_url = COALESCE($11, metadata_url),
          error_message = COALESCE($12, error_message),
          updated_at = NOW()
      WHERE id = $1
    `,
    [
      params.id,
      params.status,
      params.cancelRequested ?? null,
      params.generationProfile ?? null,
      params.plannerProvider ?? null,
      params.videoProvider ?? null,
      params.providerModel ?? null,
      params.shotCount ?? null,
      params.outputPath ?? null,
      params.outputUrl ?? null,
      params.metadataUrl ?? null,
      params.errorMessage ?? null
    ]
  );
}

export async function resetGenerationJobForRetry(id: string): Promise<void> {
  await pool.query(
    `
      UPDATE generation_jobs
      SET status = 'queued',
          cancel_requested = FALSE,
          output_path = NULL,
          output_url = NULL,
          metadata_url = NULL,
          error_message = NULL,
          updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );
}

export async function requestGenerationJobCancel(id: string): Promise<void> {
  await pool.query(
    `
      UPDATE generation_jobs
      SET cancel_requested = TRUE,
          status = 'canceling',
          updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );
}

export async function getGenerationJobById(id: string): Promise<GenerationJobRecord | null> {
  const result = await pool.query<GenerationJobRecord>("SELECT * FROM generation_jobs WHERE id = $1", [id]);
  return result.rows[0] ?? null;
}

export async function listGenerationJobsForProject(projectId: string): Promise<GenerationJobRecord[]> {
  const result = await pool.query<GenerationJobRecord>(
    `
      SELECT *
      FROM generation_jobs
      WHERE project_id = $1
      ORDER BY created_at DESC
    `,
    [projectId]
  );

  return result.rows;
}

export async function createGenerationShots(params: {
  jobId: string;
  projectId: string;
  provider: string;
  shots: ShotPlanItem[];
}): Promise<GenerationShotRecord[]> {
  const insertedShots: GenerationShotRecord[] = [];

  for (const shot of params.shots) {
    const result = await pool.query<GenerationShotRecord>(
      `
        INSERT INTO generation_shots (
          id,
          job_id,
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
          kling_camera_zoom,
          status,
          provider
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'planned', $22)
        ON CONFLICT (job_id, shot_number)
        DO UPDATE SET
          beat_label = EXCLUDED.beat_label,
          description = EXCLUDED.description,
          duration_seconds = EXCLUDED.duration_seconds,
          generation_mode = EXCLUDED.generation_mode,
          source_shot_number = EXCLUDED.source_shot_number,
          extend_prompt = EXCLUDED.extend_prompt,
          negative_prompt = EXCLUDED.negative_prompt,
          camera_notes = EXCLUDED.camera_notes,
          kling_mode = EXCLUDED.kling_mode,
          kling_cfg_scale = EXCLUDED.kling_cfg_scale,
          kling_camera_control_type = EXCLUDED.kling_camera_control_type,
          kling_camera_horizontal = EXCLUDED.kling_camera_horizontal,
          kling_camera_vertical = EXCLUDED.kling_camera_vertical,
          kling_camera_pan = EXCLUDED.kling_camera_pan,
          kling_camera_tilt = EXCLUDED.kling_camera_tilt,
          kling_camera_roll = EXCLUDED.kling_camera_roll,
          kling_camera_zoom = EXCLUDED.kling_camera_zoom,
          provider = EXCLUDED.provider,
          updated_at = NOW()
        RETURNING *
      `,
      [
        uuidv4(),
        params.jobId,
        params.projectId,
        shot.shotNumber,
        shot.beatLabel ?? null,
        shot.description,
        shot.durationSeconds,
        shot.generationMode ?? "generate",
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
        shot.klingCameraZoom ?? null,
        params.provider
      ]
    );

    insertedShots.push(result.rows[0]);
  }

  return insertedShots;
}

export async function updateGenerationShot(params: {
  jobId: string;
  shotNumber: number;
  status: string;
  providerTaskId?: string;
  providerRequestId?: string;
  sourceProviderOutputId?: string;
  sourceProviderDurationSeconds?: number;
  providerOutputId?: string;
  providerOutputDurationSeconds?: number;
  providerRequestPayload?: string;
  providerUnitsConsumed?: string;
  providerTerminalPayload?: string;
  errorMessage?: string;
  stitchedSegmentPath?: string;
  stitchedSegmentUrl?: string;
  stitchedSegmentStartSeconds?: number;
  stitchedSegmentDurationSeconds?: number;
  assetPath?: string;
  assetUrl?: string;
}): Promise<void> {
  await pool.query(
    `
      UPDATE generation_shots
      SET status = $3,
          provider_task_id = COALESCE($4, provider_task_id),
          provider_request_id = COALESCE($5, provider_request_id),
          source_provider_output_id = COALESCE($6, source_provider_output_id),
          source_provider_duration_seconds = COALESCE($7, source_provider_duration_seconds),
          provider_output_id = COALESCE($8, provider_output_id),
          provider_output_duration_seconds = COALESCE($9, provider_output_duration_seconds),
          provider_request_payload = COALESCE($10, provider_request_payload),
          provider_units_consumed = COALESCE($11, provider_units_consumed),
          provider_terminal_payload = COALESCE($12, provider_terminal_payload),
          error_message = COALESCE($13, error_message),
          stitched_segment_path = COALESCE($14, stitched_segment_path),
          stitched_segment_url = COALESCE($15, stitched_segment_url),
          stitched_segment_start_seconds = COALESCE($16, stitched_segment_start_seconds),
          stitched_segment_duration_seconds = COALESCE($17, stitched_segment_duration_seconds),
          asset_path = COALESCE($18, asset_path),
          asset_url = COALESCE($19, asset_url),
          updated_at = NOW()
      WHERE job_id = $1 AND shot_number = $2
    `,
    [
      params.jobId,
      params.shotNumber,
      params.status,
      params.providerTaskId ?? null,
      params.providerRequestId ?? null,
      params.sourceProviderOutputId ?? null,
      params.sourceProviderDurationSeconds ?? null,
      params.providerOutputId ?? null,
      params.providerOutputDurationSeconds ?? null,
      params.providerRequestPayload ?? null,
      params.providerUnitsConsumed ?? null,
      params.providerTerminalPayload ?? null,
      params.errorMessage ?? null,
      params.stitchedSegmentPath ?? null,
      params.stitchedSegmentUrl ?? null,
      params.stitchedSegmentStartSeconds ?? null,
      params.stitchedSegmentDurationSeconds ?? null,
      params.assetPath ?? null,
      params.assetUrl ?? null
    ]
  );
}

export async function listGenerationShotsForJob(jobId: string): Promise<GenerationShotRecord[]> {
  const result = await pool.query<GenerationShotRecord>(
    `
      SELECT *
      FROM generation_shots
      WHERE job_id = $1
      ORDER BY shot_number ASC
    `,
    [jobId]
  );

  return result.rows;
}

export async function getGenerationShot(jobId: string, shotNumber: number): Promise<GenerationShotRecord | null> {
  const result = await pool.query<GenerationShotRecord>(
    `
      SELECT *
      FROM generation_shots
      WHERE job_id = $1 AND shot_number = $2
    `,
    [jobId, shotNumber]
  );

  return result.rows[0] ?? null;
}

export async function resetGenerationShotsForRetry(jobId: string, fromShotNumber: number): Promise<void> {
  await pool.query(
    `
      UPDATE generation_shots
      SET status = 'planned',
          provider_task_id = NULL,
          provider_request_id = NULL,
          source_provider_output_id = NULL,
          source_provider_duration_seconds = NULL,
          provider_output_id = NULL,
          provider_output_duration_seconds = NULL,
          provider_request_payload = NULL,
          provider_units_consumed = NULL,
          provider_terminal_payload = NULL,
          error_message = NULL,
          stitched_segment_path = NULL,
          stitched_segment_url = NULL,
          stitched_segment_start_seconds = NULL,
          stitched_segment_duration_seconds = NULL,
          asset_path = NULL,
          asset_url = NULL,
          updated_at = NOW()
      WHERE job_id = $1 AND shot_number >= $2
    `,
    [jobId, fromShotNumber]
  );
}
