import { ProjectShotsPreview } from "./ProjectShotsPreview";
import type { GenerationJob, GenerationShot, Project, ProjectGenerationStatus } from "../../types";
import {
  formatProvider,
  formatStatus,
  formatTime,
  getActiveProviderTask,
  getLatestJob,
  getLatestShots,
  getShotProgress,
  isActiveStatus
} from "../../lib/studio/utils";

export function ProjectQueuePanel({
  isLoading,
  projects,
  projectStatuses,
  selectedProjectId,
  activeProjectId,
  activeRetryJobId,
  onSelectProject,
  onGenerate,
  onRetryJob,
  onRefreshStatus
}: {
  isLoading: boolean;
  projects: Project[];
  projectStatuses: Record<string, ProjectGenerationStatus>;
  selectedProjectId: string | null;
  activeProjectId: string | null;
  activeRetryJobId: string | null;
  onSelectProject: (projectId: string) => void;
  onGenerate: (projectId: string) => void;
  onRetryJob: (jobId: string) => void;
  onRefreshStatus: (projectId: string) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <p className="eyebrow">Project Queue</p>
        <h2>Latest job and shot snapshots for every project.</h2>
      </div>

      {isLoading ? (
        <div className="empty-state">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="empty-state">No projects yet.</div>
      ) : (
        <div className="project-grid">
          {projects.map((project) => {
            const projectStatus = projectStatuses[project.id];
            const latestJob = getLatestJob(projectStatus);
            const latestShots = getLatestShots(projectStatus);
            const activeProviderTaskId = getActiveProviderTask(latestShots);
            const canRetryJob = latestJob ? latestJob.status === "failed" || latestJob.status === "processing" : false;
            const hasActiveJob = latestJob ? isActiveStatus(latestJob.status) : isActiveStatus(project.status);
            const canGenerate = !hasActiveJob;
            const generateLabel = latestJob ? "Regenerate Video" : "Generate Video";
            const isSelected = project.id === selectedProjectId;

            return (
              <ProjectQueueCard
                key={project.id}
                activeProjectId={activeProjectId}
                activeProviderTaskId={activeProviderTaskId}
                activeRetryJobId={activeRetryJobId}
                canGenerate={canGenerate}
                canRetryJob={canRetryJob}
                generateLabel={generateLabel}
                isSelected={isSelected}
                latestJob={latestJob}
                latestShots={latestShots}
                onGenerate={onGenerate}
                onRefreshStatus={onRefreshStatus}
                onRetryJob={onRetryJob}
                onSelectProject={onSelectProject}
                project={project}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function ProjectQueueCard({
  project,
  latestJob,
  latestShots,
  activeProviderTaskId,
  canRetryJob,
  canGenerate,
  generateLabel,
  isSelected,
  activeProjectId,
  activeRetryJobId,
  onSelectProject,
  onGenerate,
  onRetryJob,
  onRefreshStatus
}: {
  project: Project;
  latestJob: GenerationJob | null;
  latestShots: GenerationShot[];
  activeProviderTaskId: string | null;
  canRetryJob: boolean;
  canGenerate: boolean;
  generateLabel: string;
  isSelected: boolean;
  activeProjectId: string | null;
  activeRetryJobId: string | null;
  onSelectProject: (projectId: string) => void;
  onGenerate: (projectId: string) => void;
  onRetryJob: (jobId: string) => void;
  onRefreshStatus: (projectId: string) => void;
}) {
  return (
    <article className={`project-card ${isSelected ? "project-card-selected" : ""}`}>
      <button className="project-card-select" onClick={() => onSelectProject(project.id)} type="button">
        <div className="project-card-top">
          <div>
            <h3>{project.title}</h3>
            <p className="project-meta">{formatTime(project.created_at)}</p>
          </div>
          <span className={`status-pill status-${project.status}`}>{formatStatus(project.status)}</span>
        </div>

        <p className="project-prompt">{project.prompt}</p>

        {latestJob ? (
          <div className="project-detail-stack">
            <div className="detail-row">
              <span className="metric-label">Latest Job</span>
              <span>{formatStatus(latestJob.status)}</span>
            </div>
            <div className="detail-row">
              <span className="metric-label">Planner</span>
              <span>{formatProvider(latestJob.planner_provider)}</span>
            </div>
            <div className="detail-row">
              <span className="metric-label">Shot Progress</span>
              <span>{getShotProgress(latestShots)}</span>
            </div>
            <div className="detail-row">
              <span className="metric-label">Last Updated</span>
              <span>{formatTime(latestJob.updated_at)}</span>
            </div>
            {activeProviderTaskId ? (
              <div className="detail-row">
                <span className="metric-label">Provider Task</span>
                <span className="mono-text task-id-text">{activeProviderTaskId}</span>
              </div>
            ) : null}
            <ProjectShotsPreview shots={latestShots} />
            {latestJob.error_message ? (
              <div className="detail-row detail-error">
                <span className="metric-label">Error</span>
                <span>{latestJob.error_message}</span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="project-card-caption">No generation job has been created yet.</p>
        )}
      </button>

      <div className="project-card-footer">
        <button
          className="secondary-button"
          disabled={!canGenerate || activeProjectId === project.id}
          onClick={() => onGenerate(project.id)}
          type="button"
        >
          {activeProjectId === project.id ? "Queueing..." : canGenerate ? generateLabel : "In Progress"}
        </button>

        {project.output_url ? (
          <a className="text-link" href={project.output_url} target="_blank" rel="noreferrer">
            Open MP4
          </a>
        ) : canRetryJob && latestJob ? (
          <button
            className="ghost-button"
            disabled={activeRetryJobId === latestJob.id}
            onClick={() => onRetryJob(latestJob.id)}
            type="button"
          >
            {activeRetryJobId === latestJob.id ? "Retrying..." : "Retry / Resume"}
          </button>
        ) : latestJob ? (
          <button className="ghost-button" onClick={() => onRefreshStatus(project.id)} type="button">
            Refresh Status
          </button>
        ) : null}
      </div>
    </article>
  );
}
