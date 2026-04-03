import { pool } from "../../db/pool.js";
import { v4 as uuidv4 } from "uuid";
import type { ProjectShotPlanRecord, ShotPlanItem } from "../generate/generate.types.js";

export interface ProjectRecord {
  id: string;
  title: string;
  prompt: string;
  status: string;
  output_url: string | null;
  created_at: string;
  updated_at: string;
}

export async function createProject(params: {
  id: string;
  title: string;
  prompt: string;
}): Promise<ProjectRecord> {
  const result = await pool.query<ProjectRecord>(
    `
      INSERT INTO projects (id, title, prompt, status)
      VALUES ($1, $2, $3, 'draft')
      RETURNING *
    `,
    [params.id, params.title, params.prompt]
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
          description,
          duration_seconds,
          negative_prompt,
          camera_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        uuidv4(),
        projectId,
        shot.shotNumber,
        shot.description,
        shot.durationSeconds,
        shot.negativePrompt ?? null,
        shot.cameraNotes ?? null
      ]
    );

    inserted.push(result.rows[0]);
  }

  return inserted;
}
