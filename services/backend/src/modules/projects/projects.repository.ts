import { pool } from "../../db/pool.js";

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
