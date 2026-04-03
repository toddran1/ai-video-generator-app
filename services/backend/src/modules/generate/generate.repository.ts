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
          description,
          duration_seconds,
          status,
          provider
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'planned', $7)
        ON CONFLICT (job_id, shot_number)
        DO UPDATE SET
          description = EXCLUDED.description,
          duration_seconds = EXCLUDED.duration_seconds,
          provider = EXCLUDED.provider,
          updated_at = NOW()
        RETURNING *
      `,
      [
        uuidv4(),
        params.jobId,
        params.projectId,
        shot.shotNumber,
        shot.description,
        shot.durationSeconds,
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
  providerRequestPayload?: string;
  providerUnitsConsumed?: string;
  providerTerminalPayload?: string;
  assetPath?: string;
  assetUrl?: string;
}): Promise<void> {
  await pool.query(
    `
      UPDATE generation_shots
      SET status = $3,
          provider_task_id = COALESCE($4, provider_task_id),
          provider_request_id = COALESCE($5, provider_request_id),
          provider_request_payload = COALESCE($6, provider_request_payload),
          provider_units_consumed = COALESCE($7, provider_units_consumed),
          provider_terminal_payload = COALESCE($8, provider_terminal_payload),
          asset_path = COALESCE($9, asset_path),
          asset_url = COALESCE($10, asset_url),
          updated_at = NOW()
      WHERE job_id = $1 AND shot_number = $2
    `,
    [
      params.jobId,
      params.shotNumber,
      params.status,
      params.providerTaskId ?? null,
      params.providerRequestId ?? null,
      params.providerRequestPayload ?? null,
      params.providerUnitsConsumed ?? null,
      params.providerTerminalPayload ?? null,
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
          provider_request_payload = NULL,
          provider_units_consumed = NULL,
          provider_terminal_payload = NULL,
          asset_path = NULL,
          asset_url = NULL,
          updated_at = NOW()
      WHERE job_id = $1 AND shot_number >= $2
    `,
    [jobId, fromShotNumber]
  );
}
