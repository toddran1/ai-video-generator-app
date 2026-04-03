import { FormEvent, useEffect, useState } from "react";
import {
  cancelGenerationShot,
  createProject,
  generateProject,
  getGenerationJob,
  getProjectGenerationStatus,
  listProjects,
  retryGenerationJob,
  retryGenerationShot
} from "./api";
import type { GenerationJob, GenerationJobStatus, GenerationShot, Project, ProjectGenerationStatus } from "./types";

interface ProjectFormState {
  title: string;
  prompt: string;
}

type GenerationProfile = "testing" | "production";

const initialFormState: ProjectFormState = {
  title: "",
  prompt: ""
};

const terminalStatuses = new Set(["completed", "failed"]);

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function formatProvider(value: string) {
  return value.replace(/-/g, " ");
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function getShotProgress(shots: GenerationShot[]) {
  if (shots.length === 0) {
    return "No shots planned yet";
  }

  const completedShots = shots.filter((shot) => shot.status === "completed").length;
  return `${completedShots}/${shots.length} shots complete`;
}

function getLatestJob(projectStatus?: ProjectGenerationStatus) {
  return projectStatus?.jobs[0] ?? null;
}

function getLatestShots(projectStatus?: ProjectGenerationStatus) {
  return projectStatus?.shots ?? [];
}

function getProjectStats(projects: Project[]) {
  return {
    total: projects.length,
    active: projects.filter((project) => !terminalStatuses.has(project.status)).length,
    completed: projects.filter((project) => project.status === "completed").length
  };
}

function getShotStatusSummary(shots: GenerationShot[]) {
  return shots.slice(0, 3);
}

function getActiveProviderTask( shots: GenerationShot[]) {
  return shots.find((shot) => shot.provider_task_id)?.provider_task_id ?? null;
}

function ProjectShotsPreview({ shots }: { shots: GenerationShot[] }) {
  const previewShots = getShotStatusSummary(shots);

  if (previewShots.length === 0) {
    return <p className="project-card-caption">No shot plan recorded yet.</p>;
  }

  return (
    <div className="shot-pill-row">
      {previewShots.map((shot) => (
        <span className={`status-pill status-${shot.status}`} key={shot.id}>
          Shot {shot.shot_number}
        </span>
      ))}
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<Record<string, ProjectGenerationStatus>>({});
  const [jobDiagnostics, setJobDiagnostics] = useState<Record<string, GenerationJobStatus>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ProjectFormState>(initialFormState);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeRetryJobId, setActiveRetryJobId] = useState<string | null>(null);
  const [activeShotAction, setActiveShotAction] = useState<string | null>(null);
  const [generationProfile, setGenerationProfile] = useState<GenerationProfile>("testing");
  const [error, setError] = useState<string | null>(null);

  async function refreshProjectStatus(projectId: string) {
    const response = await getProjectGenerationStatus(projectId);

    setProjectStatuses((current) => ({
      ...current,
      [projectId]: response.data
    }));
  }

  async function refreshJobDiagnostics(jobId: string) {
    const response = await getGenerationJob(jobId);

    setJobDiagnostics((current) => ({
      ...current,
      [jobId]: response.data
    }));
  }

  async function refreshDashboardData() {
    const response = await listProjects();
    const nextProjects = response.data;
    setProjects(nextProjects);

    setSelectedProjectId((current) => {
      if (current && nextProjects.some((project) => project.id === current)) {
        return current;
      }

      return nextProjects[0]?.id ?? null;
    });

    const projectIdsToRefresh = new Set<string>();

    for (const project of nextProjects) {
      if (!terminalStatuses.has(project.status)) {
        projectIdsToRefresh.add(project.id);
      }
    }

    if (nextProjects[0]) {
      projectIdsToRefresh.add(nextProjects[0].id);
    }

    if (selectedProjectId) {
      projectIdsToRefresh.add(selectedProjectId);
    }

    if (projectIdsToRefresh.size === 0) {
      return;
    }

    const statuses = await Promise.all(
      Array.from(projectIdsToRefresh).map(async (projectId) => {
        const statusResponse = await getProjectGenerationStatus(projectId);
        return [projectId, statusResponse.data] as const;
      })
    );

    setProjectStatuses((current) => {
      const nextState = { ...current };

      for (const [projectId, status] of statuses) {
        nextState[projectId] = status;
      }

      return nextState;
    });
  }

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedJobId(null);
      return;
    }

    const jobs = projectStatuses[selectedProjectId]?.jobs ?? [];
    const nextSelectedJobId = jobs.some((job) => job.id === selectedJobId) ? selectedJobId : (jobs[0]?.id ?? null);
    setSelectedJobId(nextSelectedJobId);
  }, [projectStatuses, selectedProjectId, selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    void refreshJobDiagnostics(selectedJobId).catch((jobError) => {
      setError(jobError instanceof Error ? jobError.message : "Unable to load job diagnostics");
    });
  }, [selectedJobId]);

  useEffect(() => {
    void (async () => {
      try {
        await refreshDashboardData();
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const hasActiveJobs = projects.some((project) => !terminalStatuses.has(project.status));

    if (!hasActiveJobs) {
      return;
    }

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          await refreshDashboardData();

          if (selectedJobId) {
            await refreshJobDiagnostics(selectedJobId);
          }
        } catch (refreshError) {
          setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh projects");
        }
      })();
    }, 4000);

    return () => window.clearInterval(interval);
  }, [projects, selectedProjectId, selectedJobId]);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      await createProject(formState);
      setFormState(initialFormState);
      await refreshDashboardData();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Unable to create project");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleGenerate(projectId: string) {
    setActiveProjectId(projectId);
    setError(null);

    try {
      await generateProject(projectId, generationProfile);
      await refreshDashboardData();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to start generation");
    } finally {
      setActiveProjectId(null);
    }
  }

  async function handleRetryJob(jobId: string) {
    setActiveRetryJobId(jobId);
    setError(null);

    try {
      await retryGenerationJob(jobId);
      await refreshDashboardData();
      await refreshJobDiagnostics(jobId);
    } catch (retryError) {
      setError(retryError instanceof Error ? retryError.message : "Unable to retry generation");
    } finally {
      setActiveRetryJobId(null);
    }
  }

  async function handleRetryShot(jobId: string, shotNumber: number) {
    const actionKey = `${jobId}:${shotNumber}:retry`;
    setActiveShotAction(actionKey);
    setError(null);

    try {
      await retryGenerationShot(jobId, shotNumber);
      await refreshDashboardData();
      await refreshJobDiagnostics(jobId);
    } catch (shotError) {
      setError(shotError instanceof Error ? shotError.message : "Unable to retry shot");
    } finally {
      setActiveShotAction(null);
    }
  }

  async function handleCancelShot(jobId: string, shotNumber: number) {
    const actionKey = `${jobId}:${shotNumber}:cancel`;
    setActiveShotAction(actionKey);
    setError(null);

    try {
      await cancelGenerationShot(jobId, shotNumber);
      await refreshDashboardData();
      await refreshJobDiagnostics(jobId);
    } catch (shotError) {
      setError(shotError instanceof Error ? shotError.message : "Unable to cancel shot");
    } finally {
      setActiveShotAction(null);
    }
  }

  const stats = getProjectStats(projects);
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const selectedStatus = selectedProject ? projectStatuses[selectedProject.id] : undefined;
  const featuredJob = getLatestJob(selectedStatus);
  const featuredShots = getLatestShots(selectedStatus);
  const diagnosticJob = selectedJobId ? jobDiagnostics[selectedJobId] : null;
  const diagnosticShots = diagnosticJob?.shots ?? [];
  const projectJobs = selectedStatus?.jobs ?? [];
  const diagnosticJobId = diagnosticJob?.job.id ?? null;

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <main className="layout">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">React + TypeScript Control Room</p>
            <h1>Build prompt-to-video projects with a live visual workflow.</h1>
            <p className="hero-text">
              Create projects, inspect the latest job, review generated shots, and preview the stitched MP4
              from one control surface.
            </p>
          </div>

          <div className="hero-panel">
            <div className="metric-card">
              <span className="metric-label">Projects</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Active Jobs</span>
              <strong>{stats.active}</strong>
            </div>
            <div className="metric-card">
              <span className="metric-label">Completed</span>
              <strong>{stats.completed}</strong>
            </div>
          </div>
        </section>

        <section className="content-grid">
          <section className="panel panel-form">
            <div className="panel-header">
              <p className="eyebrow">New Project</p>
              <h2>Describe the video you want to produce.</h2>
            </div>

            <form className="project-form" onSubmit={handleCreateProject}>
              <label>
                <span>Project Title</span>
                <input
                  value={formState.title}
                  onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Launch film"
                  required
                />
              </label>

              <label>
                <span>Prompt</span>
                <textarea
                  value={formState.prompt}
                  onChange={(event) => setFormState((current) => ({ ...current, prompt: event.target.value }))}
                  placeholder="A cinematic drone shot over a futuristic city at sunrise..."
                  rows={6}
                  required
                />
              </label>

              <button className="primary-button" type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Project"}
              </button>
            </form>

            <div className="profile-toggle-card">
              <div>
                <p className="eyebrow">Generation Profile</p>
                <h3>{generationProfile === "testing" ? "Testing mode" : "Production mode"}</h3>
                <p className="project-card-caption">
                  Testing uses the lower-cost Kling path. Production is for higher-quality settings.
                </p>
              </div>
              <div className="toggle-row">
                <button
                  className={`toggle-pill ${generationProfile === "testing" ? "toggle-pill-active" : ""}`}
                  onClick={() => setGenerationProfile("testing")}
                  type="button"
                >
                  Testing
                </button>
                <button
                  className={`toggle-pill ${generationProfile === "production" ? "toggle-pill-active" : ""}`}
                  onClick={() => setGenerationProfile("production")}
                  type="button"
                >
                  Production
                </button>
              </div>
            </div>

            {error ? <p className="error-banner">{error}</p> : null}
          </section>

          <section className="panel panel-preview">
            <div className="panel-header">
              <p className="eyebrow">Featured Output</p>
              <h2>{selectedProject ? selectedProject.title : "No project yet"}</h2>
            </div>

            {selectedProject ? (
              <div className="featured-content">
                <div className="status-row">
                  <span className={`status-pill status-${selectedProject.status}`}>{formatStatus(selectedProject.status)}</span>
                  <span className="timestamp">Updated {formatTime(selectedProject.updated_at)}</span>
                </div>
                <p className="featured-prompt">{selectedProject.prompt}</p>
                <div className="featured-meta-grid">
                  <div className="featured-meta-card">
                    <span className="metric-label">Planner</span>
                    <strong>{featuredJob ? formatProvider(featuredJob.planner_provider) : "Waiting"}</strong>
                  </div>
                  <div className="featured-meta-card">
                    <span className="metric-label">Latest Job</span>
                    <strong>{featuredJob ? formatStatus(featuredJob.status) : "Not started"}</strong>
                  </div>
                  <div className="featured-meta-card">
                    <span className="metric-label">Shot Progress</span>
                    <strong>{getShotProgress(featuredShots)}</strong>
                  </div>
                </div>
                {selectedProject.output_url ? (
                  <video className="video-player" controls src={selectedProject.output_url} />
                ) : (
                  <div className="video-placeholder">Final video will appear here after stitching completes.</div>
                )}
              </div>
            ) : (
              <div className="empty-state">Create a project to start your first prompt-to-video run.</div>
            )}
          </section>
        </section>

        <section className="detail-grid">
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
                  const canGenerate = project.status === "draft" || project.status === "failed";
                  const projectStatus = projectStatuses[project.id];
                  const latestJob = getLatestJob(projectStatus);
                  const latestShots = getLatestShots(projectStatus);
                  const activeProviderTaskId = getActiveProviderTask(latestShots);
                  const canRetryJob = latestJob ? latestJob.status === "failed" || latestJob.status === "processing" : false;
                  const isSelected = project.id === selectedProject?.id;

                  return (
                    <article
                      className={`project-card ${isSelected ? "project-card-selected" : ""}`}
                      key={project.id}
                    >
                      <button
                        className="project-card-select"
                        onClick={() => setSelectedProjectId(project.id)}
                        type="button"
                      >
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
                          onClick={() => void handleGenerate(project.id)}
                          type="button"
                        >
                          {activeProjectId === project.id ? "Queueing..." : canGenerate ? "Generate Video" : "In Progress"}
                        </button>

                        {project.output_url ? (
                          <a className="text-link" href={project.output_url} target="_blank" rel="noreferrer">
                            Open MP4
                          </a>
                        ) : canRetryJob && latestJob ? (
                          <button
                            className="ghost-button"
                            disabled={activeRetryJobId === latestJob.id}
                            onClick={() => void handleRetryJob(latestJob.id)}
                            type="button"
                          >
                            {activeRetryJobId === latestJob.id ? "Retrying..." : "Retry / Resume"}
                          </button>
                        ) : latestJob ? (
                          <button
                            className="ghost-button"
                            onClick={() => void refreshProjectStatus(project.id)}
                            type="button"
                          >
                            Refresh Status
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panel-header">
              <p className="eyebrow">Project Detail View</p>
              <h2>{selectedProject ? selectedProject.title : "Select a project"}</h2>
            </div>

            {selectedProject ? (
              <div className="detail-view">
                <div className="detail-view-grid">
                  <div className="detail-stat-card">
                    <span className="metric-label">Project Status</span>
                    <strong>{formatStatus(selectedProject.status)}</strong>
                  </div>
                  <div className="detail-stat-card">
                    <span className="metric-label">Current Planner</span>
                    <strong>{featuredJob ? formatProvider(featuredJob.planner_provider) : "Waiting"}</strong>
                  </div>
                  <div className="detail-stat-card">
                    <span className="metric-label">Latest Job ID</span>
                    <strong className="mono-text">{featuredJob ? featuredJob.id.slice(0, 8) : "n/a"}</strong>
                  </div>
                </div>

                <div className="detail-section">
                  <p className="eyebrow">Prompt</p>
                  <p className="detail-copy">{selectedProject.prompt}</p>
                </div>

                <div className="detail-section">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Latest Job</p>
                      <h3>{featuredJob ? formatStatus(featuredJob.status) : "Not started"}</h3>
                    </div>
                    {featuredJob ? <span className="timestamp">Updated {formatTime(featuredJob.updated_at)}</span> : null}
                  </div>

                  {featuredJob ? (
                    <div className="detail-list">
                      <div className="detail-row">
                        <span className="metric-label">Planner Provider</span>
                        <span>{formatProvider(featuredJob.planner_provider)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Shot Count</span>
                        <span>{featuredJob.shot_count ?? 0}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Video Provider</span>
                        <span>{featuredJob.video_provider ? formatProvider(featuredJob.video_provider) : "Pending"}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Profile</span>
                        <span>{featuredJob.generation_profile ? formatStatus(featuredJob.generation_profile) : "Testing"}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Model</span>
                        <span className="mono-text task-id-text">{featuredJob.provider_model ?? "Pending"}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Output</span>
                        {featuredJob.output_url ? (
                          <a className="text-link" href={featuredJob.output_url} target="_blank" rel="noreferrer">
                            Open final MP4
                          </a>
                        ) : (
                          <span>Pending</span>
                        )}
                      </div>
                      {(featuredJob.status === "failed" || featuredJob.status === "processing") ? (
                        <div className="detail-row">
                          <span className="metric-label">Controls</span>
                          <button
                            className="ghost-button"
                            disabled={activeRetryJobId === featuredJob.id}
                            onClick={() => void handleRetryJob(featuredJob.id)}
                            type="button"
                          >
                            {activeRetryJobId === featuredJob.id ? "Retrying..." : "Retry / Resume Job"}
                          </button>
                        </div>
                      ) : null}
                      {featuredJob.error_message ? (
                        <div className="detail-row detail-error">
                          <span className="metric-label">Error</span>
                          <span>{featuredJob.error_message}</span>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="empty-state">No generation job has been queued for this project yet.</div>
                  )}
                </div>

                <div className="detail-section">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Job History</p>
                      <h3>{projectJobs.length} runs tracked</h3>
                    </div>
                  </div>

                  {projectJobs.length > 0 ? (
                    <div className="job-history-list">
                      {projectJobs.map((job) => {
                        const isActive = job.id === selectedJobId;

                        return (
                          <button
                            className={`job-history-item ${isActive ? "job-history-item-active" : ""}`}
                            key={job.id}
                            onClick={() => setSelectedJobId(job.id)}
                            type="button"
                          >
                            <div className="job-history-top">
                              <span className={`status-pill status-${job.status}`}>{formatStatus(job.status)}</span>
                              <span className="timestamp">{formatTime(job.updated_at)}</span>
                            </div>
                            <div className="detail-row">
                              <span className="metric-label">Job ID</span>
                              <span className="mono-text task-id-text">{job.id}</span>
                            </div>
                            <div className="detail-row">
                              <span className="metric-label">Provider</span>
                              <span>{job.video_provider ? formatProvider(job.video_provider) : "Pending"}</span>
                            </div>
                            {job.error_message ? (
                              <div className="detail-row detail-error">
                                <span className="metric-label">Error</span>
                                <span>{job.error_message}</span>
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">No job history recorded yet.</div>
                  )}
                </div>

                <div className="detail-section">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Provider Diagnostics</p>
                      <h3>{selectedJobId ? "Selected job details" : "No job selected"}</h3>
                    </div>
                  </div>

                  {diagnosticJob ? (
                    <div className="detail-list">
                      <div className="detail-row">
                        <span className="metric-label">Job ID</span>
                        <span className="mono-text task-id-text">{diagnosticJob.job.id}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Status</span>
                        <span>{formatStatus(diagnosticJob.job.status)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Planner</span>
                        <span>{formatProvider(diagnosticJob.job.planner_provider)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Video Provider</span>
                        <span>{diagnosticJob.job.video_provider ? formatProvider(diagnosticJob.job.video_provider) : "Pending"}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Profile</span>
                        <span>{diagnosticJob.job.generation_profile ? formatStatus(diagnosticJob.job.generation_profile) : "Testing"}</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Model</span>
                        <span className="mono-text task-id-text">{diagnosticJob.job.provider_model ?? "Pending"}</span>
                      </div>
                      {diagnosticJob.job.output_url ? (
                        <div className="detail-row">
                          <span className="metric-label">Final Output</span>
                          <a className="text-link" href={diagnosticJob.job.output_url} target="_blank" rel="noreferrer">
                            Open final MP4
                          </a>
                        </div>
                      ) : null}
                      {diagnosticJob.job.metadata_url ? (
                        <div className="detail-row">
                          <span className="metric-label">Metadata Archive</span>
                          <a className="text-link" href={diagnosticJob.job.metadata_url} target="_blank" rel="noreferrer">
                            Download JSON
                          </a>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="empty-state">Select a job to inspect its provider diagnostics.</div>
                  )}
                </div>

                <div className="detail-section">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Shot Timeline</p>
                      <h3>{getShotProgress(diagnosticShots)}</h3>
                    </div>
                  </div>

                  {diagnosticShots.length > 0 && diagnosticJobId ? (
                    <div className="shot-timeline">
                      {diagnosticShots.map((shot) => (
                        <div className="shot-row" key={shot.id}>
                          <div className="shot-row-head">
                            <span className="shot-index">Shot {shot.shot_number}</span>
                            <span className={`status-pill status-${shot.status}`}>{formatStatus(shot.status)}</span>
                          </div>
                          <p className="shot-description">{shot.description}</p>
                          <div className="shot-row-foot">
                            <span className="timestamp">{shot.duration_seconds}s</span>
                            <span className="timestamp">{formatProvider(shot.provider)}</span>
                            {shot.provider_task_id ? (
                              <span className="timestamp mono-text task-id-text">Task {shot.provider_task_id}</span>
                            ) : null}
                            {shot.asset_url ? (
                              <a className="text-link" href={shot.asset_url} target="_blank" rel="noreferrer">
                                Open Clip
                              </a>
                            ) : null}
                          </div>
                          <div className="shot-action-row">
                            {(shot.status === "failed" || shot.status === "canceled") ? (
                              <button
                                className="ghost-button"
                                disabled={activeShotAction === `${diagnosticJobId}:${shot.shot_number}:retry`}
                                onClick={() => void handleRetryShot(diagnosticJobId, shot.shot_number)}
                                type="button"
                              >
                                {activeShotAction === `${diagnosticJobId}:${shot.shot_number}:retry`
                                  ? "Retrying..."
                                  : "Retry From This Shot"}
                              </button>
                            ) : null}
                            {shot.status === "generating" ? (
                              <button
                                className="ghost-button"
                                disabled={activeShotAction === `${diagnosticJobId}:${shot.shot_number}:cancel`}
                                onClick={() => void handleCancelShot(diagnosticJobId, shot.shot_number)}
                                type="button"
                              >
                                {activeShotAction === `${diagnosticJobId}:${shot.shot_number}:cancel`
                                  ? "Canceling..."
                                  : "Cancel Shot"}
                              </button>
                            ) : null}
                          </div>
                          {(shot.provider_task_id || shot.provider_request_id || shot.provider_units_consumed) ? (
                            <div className="provider-meta-card">
                              {shot.provider_task_id ? (
                                <div className="detail-row">
                                  <span className="metric-label">Provider Task ID</span>
                                  <span className="mono-text task-id-text">{shot.provider_task_id}</span>
                                </div>
                              ) : null}
                              {shot.provider_request_id ? (
                                <div className="detail-row">
                                  <span className="metric-label">Request ID</span>
                                  <span className="mono-text task-id-text">{shot.provider_request_id}</span>
                                </div>
                              ) : null}
                              {shot.provider_units_consumed ? (
                                <div className="detail-row">
                                  <span className="metric-label">Units Consumed</span>
                                  <span>{shot.provider_units_consumed}</span>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">Shot metadata will appear here after planning begins.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="empty-state">Select a project card to inspect its latest job and shots.</div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
