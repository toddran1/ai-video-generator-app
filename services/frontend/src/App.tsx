import { FormEvent, useEffect, useState } from "react";
import {
  cancelGenerationShot,
  createProject,
  generateProject,
  getGenerationJob,
  getProjectAutoShotPlan,
  getProjectShotPlan,
  getProjectGenerationStatus,
  listProjects,
  retryGenerationJob,
  retryGenerationShot,
  updateProjectSettings,
  updateProjectShotPlan
} from "./api";
import type {
  GenerationJob,
  GenerationJobStatus,
  GenerationShot,
  Project,
  ProjectGenerationStatus,
  ProjectPlanningSettings,
  ProjectShotPlanItem
} from "./types";

interface ProjectFormState {
  title: string;
  prompt: string;
  targetShotCount: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  styleHint: string;
}

type GenerationProfile = "testing" | "production";
type DetailTab = "workflow" | "diagnostics";

const initialFormState: ProjectFormState = {
  title: "",
  prompt: "",
  targetShotCount: 3,
  aspectRatio: "16:9",
  styleHint: ""
};

const defaultShotPlan: ProjectShotPlanItem[] = [
  { shotNumber: 1, description: "Establishing shot", durationSeconds: 3, negativePrompt: "", cameraNotes: "" },
  { shotNumber: 2, description: "Main action beat", durationSeconds: 3, negativePrompt: "", cameraNotes: "" },
  { shotNumber: 3, description: "Closing shot", durationSeconds: 3, negativePrompt: "", cameraNotes: "" }
];

const terminalStatuses = new Set(["completed", "failed"]);
const estimatedUnitsPerShot: Record<GenerationProfile, number> = {
  testing: 1,
  production: 2
};

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

function getShotPlanSummary(shots: ProjectShotPlanItem[]) {
  const totalDuration = shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  return `${shots.length} shots · ${totalDuration}s total`;
}

function normalizeShotNumbers(shots: ProjectShotPlanItem[]) {
  return shots.map((shot, index) => ({ ...shot, shotNumber: index + 1 }));
}

function getEstimatedCredits(shots: ProjectShotPlanItem[], profile: GenerationProfile) {
  return shots.length * estimatedUnitsPerShot[profile];
}

function getPerShotEstimatedCredits(profile: GenerationProfile) {
  return estimatedUnitsPerShot[profile];
}

function reorderShots(shots: ProjectShotPlanItem[], fromIndex: number, toIndex: number) {
  const next = [...shots];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return normalizeShotNumbers(next);
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

function getShotLabel(shotNumber: number) {
  if (shotNumber === 1) {
    return "Intro";
  }

  if (shotNumber === 2) {
    return "Continuation";
  }

  if (shotNumber === 3) {
    return "Climax";
  }

  return `Shot ${shotNumber}`;
}

function formatJsonPayload(payload?: string | null) {
  if (!payload) {
    return "";
  }

  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
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
  const [editableShotPlan, setEditableShotPlan] = useState<ProjectShotPlanItem[]>(defaultShotPlan);
  const [savedShotPlan, setSavedShotPlan] = useState<ProjectShotPlanItem[]>([]);
  const [autoShotPlanPreview, setAutoShotPlanPreview] = useState<ProjectShotPlanItem[]>([]);
  const [formState, setFormState] = useState<ProjectFormState>(initialFormState);
  const [planningSettings, setPlanningSettings] = useState<ProjectPlanningSettings>({
    targetShotCount: 3,
    aspectRatio: "16:9",
    styleHint: ""
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeRetryJobId, setActiveRetryJobId] = useState<string | null>(null);
  const [activeShotAction, setActiveShotAction] = useState<string | null>(null);
  const [generationProfile, setGenerationProfile] = useState<GenerationProfile>("testing");
  const [detailTab, setDetailTab] = useState<DetailTab>("workflow");
  const [isSavingShotPlan, setIsSavingShotPlan] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [pendingGenerateProjectId, setPendingGenerateProjectId] = useState<string | null>(null);
  const [draggedShotIndex, setDraggedShotIndex] = useState<number | null>(null);
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

  async function refreshProjectShotPlan(projectId: string) {
    const response = await getProjectShotPlan(projectId);
    const shots = response.data
      .map((shot) => ({
        shotNumber: shot.shot_number,
        description: shot.description,
        durationSeconds: shot.duration_seconds,
        negativePrompt: shot.negative_prompt,
        cameraNotes: shot.camera_notes
      }))
      .sort((a, b) => a.shotNumber - b.shotNumber);

    setSavedShotPlan(shots);
    setEditableShotPlan(shots.length > 0 ? shots : defaultShotPlan);
  }

  async function refreshAutoShotPlan(projectId: string) {
    const response = await getProjectAutoShotPlan(projectId);
    setAutoShotPlanPreview(response.data);
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
    if (!selectedProjectId) {
      return;
    }

    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    if (selectedProject) {
      setPlanningSettings({
        targetShotCount: selectedProject.target_shot_count ?? 3,
        aspectRatio: (selectedProject.aspect_ratio as "16:9" | "9:16" | "1:1" | null) ?? "16:9",
        styleHint: selectedProject.style_hint ?? ""
      });
    }

    void refreshProjectShotPlan(selectedProjectId).catch((shotPlanError) => {
      setError(shotPlanError instanceof Error ? shotPlanError.message : "Unable to load shot plan");
    });
    void refreshAutoShotPlan(selectedProjectId).catch((shotPlanError) => {
      setError(shotPlanError instanceof Error ? shotPlanError.message : "Unable to load auto shot plan");
    });
  }, [projects, selectedProjectId]);

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

  async function handleSaveProjectSettings() {
    if (!selectedProjectId) {
      return;
    }

    setIsSavingSettings(true);
    setError(null);

    try {
      await updateProjectSettings(selectedProjectId, {
        targetShotCount: planningSettings.targetShotCount ?? 3,
        aspectRatio: planningSettings.aspectRatio ?? "16:9",
        styleHint: planningSettings.styleHint ?? ""
      });
      await refreshDashboardData();
      await refreshAutoShotPlan(selectedProjectId);
    } catch (settingsError) {
      setError(settingsError instanceof Error ? settingsError.message : "Unable to save project settings");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function startGeneration(projectId: string) {
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

  async function handleGenerate(projectId: string) {
    const hasManualPlan = selectedProjectId === projectId ? savedShotPlan.length > 0 : false;

    if (hasManualPlan) {
      setPendingGenerateProjectId(projectId);
      return;
    }

    await startGeneration(projectId);
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

  async function handleSaveShotPlan() {
    if (!selectedProjectId) {
      return;
    }

    setIsSavingShotPlan(true);
    setError(null);

    try {
      const normalized = normalizeShotNumbers(editableShotPlan).map((shot) => ({
        shotNumber: shot.shotNumber,
        description: shot.description,
        durationSeconds: shot.durationSeconds,
        negativePrompt: shot.negativePrompt ?? "",
        cameraNotes: shot.cameraNotes ?? ""
      }));
      await updateProjectShotPlan(selectedProjectId, normalized);
      await refreshProjectShotPlan(selectedProjectId);
      await refreshAutoShotPlan(selectedProjectId);
    } catch (shotPlanError) {
      setError(shotPlanError instanceof Error ? shotPlanError.message : "Unable to save shot plan");
    } finally {
      setIsSavingShotPlan(false);
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
  const usingManualShotPlan = savedShotPlan.length > 0;
  const activePlanForEstimate = usingManualShotPlan ? savedShotPlan : editableShotPlan;
  const estimatedCredits = getEstimatedCredits(activePlanForEstimate, generationProfile);
  const perShotEstimate = getPerShotEstimatedCredits(generationProfile);

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

              <div className="project-settings-grid">
                <label>
                  <span>Target Shot Count</span>
                  <input
                    min={1}
                    max={12}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, targetShotCount: Number(event.target.value) || 3 }))
                    }
                    type="number"
                    value={formState.targetShotCount}
                  />
                </label>

                <label>
                  <span>Aspect Ratio</span>
                  <select
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        aspectRatio: event.target.value as "16:9" | "9:16" | "1:1"
                      }))
                    }
                    value={formState.aspectRatio}
                  >
                    <option value="16:9">16:9</option>
                    <option value="9:16">9:16</option>
                    <option value="1:1">1:1</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Style Hint</span>
                <input
                  value={formState.styleHint}
                  onChange={(event) => setFormState((current) => ({ ...current, styleHint: event.target.value }))}
                  placeholder="moody cinematic, bright product ad, anime-inspired..."
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
                <div className="detail-tab-row">
                  <button
                    className={`toggle-pill ${detailTab === "workflow" ? "toggle-pill-active" : ""}`}
                    onClick={() => setDetailTab("workflow")}
                    type="button"
                  >
                    Workflow
                  </button>
                  <button
                    className={`toggle-pill ${detailTab === "diagnostics" ? "toggle-pill-active" : ""}`}
                    onClick={() => setDetailTab("diagnostics")}
                    type="button"
                  >
                    Diagnostics
                  </button>
                </div>

                {detailTab === "workflow" ? (
                  <>
                <div className="detail-view-grid">
                  <div className="detail-stat-card">
                    <span className="metric-label">Project Status</span>
                    <strong>{formatStatus(selectedProject.status)}</strong>
                  </div>
                  <div className="detail-stat-card">
                    <span className="metric-label">Current Planner</span>
                    <strong>{featuredJob ? formatProvider(featuredJob.planner_provider) : usingManualShotPlan ? "project shot plan" : "Waiting"}</strong>
                  </div>
                  <div className="detail-stat-card">
                    <span className="metric-label">Latest Job ID</span>
                    <strong className="mono-text">{featuredJob ? featuredJob.id.slice(0, 8) : "n/a"}</strong>
                  </div>
                </div>

                <div className="detail-section">
                  <p className="eyebrow">Prompt</p>
                  <p className="detail-copy">{selectedProject.prompt}</p>
                  <div className="detail-row">
                    <span className="metric-label">Planning Source</span>
                    <span>{usingManualShotPlan ? "Manual shot plan" : "Automatic planner"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="metric-label">Manual Plan Summary</span>
                    <span>{usingManualShotPlan ? getShotPlanSummary(savedShotPlan) : "No saved manual plan"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="metric-label">Estimated Credits</span>
                    <span>
                      ~{estimatedCredits} unit{estimatedCredits === 1 ? "" : "s"} in {generationProfile} mode
                    </span>
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Project Planning Controls</p>
                      <h3>Guide auto planning and generation defaults</h3>
                    </div>
                    <button
                      className="primary-button"
                      disabled={isSavingSettings}
                      onClick={() => void handleSaveProjectSettings()}
                      type="button"
                    >
                      {isSavingSettings ? "Saving..." : "Save Settings"}
                    </button>
                  </div>

                  <div className="project-settings-grid">
                    <label>
                      <span>Target Shot Count</span>
                      <input
                        min={1}
                        max={12}
                        onChange={(event) =>
                          setPlanningSettings((current) => ({
                            ...current,
                            targetShotCount: Number(event.target.value) || 3
                          }))
                        }
                        type="number"
                        value={planningSettings.targetShotCount ?? 3}
                      />
                    </label>

                    <label>
                      <span>Aspect Ratio</span>
                      <select
                        onChange={(event) =>
                          setPlanningSettings((current) => ({
                            ...current,
                            aspectRatio: event.target.value as "16:9" | "9:16" | "1:1"
                          }))
                        }
                        value={planningSettings.aspectRatio ?? "16:9"}
                      >
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="1:1">1:1</option>
                      </select>
                    </label>
                  </div>

                  <label className="project-settings-stack">
                    <span>Style Hint</span>
                    <input
                      onChange={(event) =>
                        setPlanningSettings((current) => ({ ...current, styleHint: event.target.value }))
                      }
                      placeholder="moody cinematic, luxury fashion, documentary realism..."
                      value={planningSettings.styleHint ?? ""}
                    />
                  </label>
                </div>

                <div className="detail-section">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Shot Plan Editor</p>
                      <h3>Override automatic planning for this project</h3>
                      <p className="project-card-caption">
                        Reorder shots, tune camera notes, and save a manual plan before you spend credits.
                      </p>
                    </div>
                    <div className="section-actions">
                      <button
                        className="ghost-button"
                        onClick={() =>
                          setEditableShotPlan(usingManualShotPlan ? savedShotPlan : defaultShotPlan)
                        }
                        type="button"
                      >
                        Reset Editor
                      </button>
                      <button
                        className="ghost-button"
                        disabled={autoShotPlanPreview.length === 0}
                        onClick={() =>
                          setEditableShotPlan(
                            normalizeShotNumbers(
                              autoShotPlanPreview.map((shot) => ({
                                ...shot,
                                negativePrompt: shot.negativePrompt ?? "",
                                cameraNotes: shot.cameraNotes ?? ""
                              }))
                            )
                          )
                        }
                        type="button"
                      >
                        Copy Auto Plan Into Editor
                      </button>
                      <button
                        className="primary-button"
                        disabled={isSavingShotPlan}
                        onClick={() => void handleSaveShotPlan()}
                        type="button"
                      >
                        {isSavingShotPlan ? "Saving..." : "Save Shot Plan"}
                      </button>
                    </div>
                  </div>

                  <div className="shot-plan-editor">
                    {editableShotPlan.map((shot, index) => (
                      <div
                        className={`shot-plan-editor-row ${draggedShotIndex === index ? "shot-plan-editor-row-dragging" : ""}`}
                        draggable
                        key={`shot-plan-${index}`}
                        onDragEnd={() => setDraggedShotIndex(null)}
                        onDragOver={(event) => {
                          event.preventDefault();
                        }}
                        onDragStart={() => setDraggedShotIndex(index)}
                        onDrop={(event) => {
                          event.preventDefault();

                          if (draggedShotIndex === null || draggedShotIndex === index) {
                            setDraggedShotIndex(null);
                            return;
                          }

                          setEditableShotPlan((current) => reorderShots(current, draggedShotIndex, index));
                          setDraggedShotIndex(null);
                        }}
                      >
                        <div className="shot-plan-editor-head">
                          <div className="shot-index-group">
                            <span className="drag-handle" title="Drag to reorder">
                              Drag
                            </span>
                            <span className="shot-index">Shot {index + 1}</span>
                          </div>
                          <div className="editor-row-actions">
                            <button
                              className="ghost-button"
                              disabled={editableShotPlan.length <= 1}
                              onClick={() =>
                                setEditableShotPlan((current) =>
                                  normalizeShotNumbers(current.filter((_, currentIndex) => currentIndex !== index))
                                )
                              }
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <textarea
                          className="shot-plan-input"
                          onChange={(event) =>
                            setEditableShotPlan((current) =>
                              current.map((item, currentIndex) =>
                                currentIndex === index ? { ...item, description: event.target.value } : item
                              )
                            )
                          }
                          rows={3}
                          value={shot.description}
                        />
                        <textarea
                          className="shot-plan-input"
                          onChange={(event) =>
                            setEditableShotPlan((current) =>
                              current.map((item, currentIndex) =>
                                currentIndex === index ? { ...item, cameraNotes: event.target.value } : item
                              )
                            )
                          }
                          placeholder="Camera notes: dolly in, handheld, low angle..."
                          rows={2}
                          value={shot.cameraNotes ?? ""}
                        />
                        <textarea
                          className="shot-plan-input"
                          onChange={(event) =>
                            setEditableShotPlan((current) =>
                              current.map((item, currentIndex) =>
                                currentIndex === index ? { ...item, negativePrompt: event.target.value } : item
                              )
                            )
                          }
                          placeholder="Negative prompt: blurry, text, watermark..."
                          rows={2}
                          value={shot.negativePrompt ?? ""}
                        />
                        <label className="shot-plan-duration">
                          <span className="metric-label">Duration Seconds</span>
                          <input
                            min={1}
                            max={30}
                            onChange={(event) =>
                              setEditableShotPlan((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index
                                    ? { ...item, durationSeconds: Number(event.target.value) || 1 }
                                    : item
                                )
                              )
                            }
                            type="number"
                            value={shot.durationSeconds}
                          />
                        </label>
                        <div className="shot-plan-estimate-row">
                          <span className="metric-label">Shot Estimate</span>
                          <span>
                            ~{perShotEstimate} unit{perShotEstimate === 1 ? "" : "s"} · {shot.durationSeconds}s
                          </span>
                        </div>
                      </div>
                    ))}
                    <button
                      className="secondary-button"
                      onClick={() =>
                        setEditableShotPlan((current) =>
                          normalizeShotNumbers([
                            ...current,
                            {
                              shotNumber: current.length + 1,
                              description: `New shot ${current.length + 1}`,
                              durationSeconds: 3,
                              negativePrompt: "",
                              cameraNotes: ""
                            }
                          ])
                        )
                      }
                      type="button"
                    >
                      Add Shot
                    </button>
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Plan Compare</p>
                      <h3>Manual plan vs automatic planner preview</h3>
                    </div>
                  </div>

                  <div className="plan-compare-grid">
                    <div className="compare-card">
                      <p className="eyebrow">Saved Manual Plan</p>
                      <h4>{usingManualShotPlan ? getShotPlanSummary(savedShotPlan) : "Not saved yet"}</h4>
                      {usingManualShotPlan ? (
                        <div className="compare-shot-list">
                          {savedShotPlan.map((shot) => (
                            <div className="compare-shot-row" key={`manual-${shot.shotNumber}`}>
                              <strong>Shot {shot.shotNumber}</strong>
                              <span>{shot.description}</span>
                              {shot.cameraNotes ? <span className="timestamp">Camera: {shot.cameraNotes}</span> : null}
                              {shot.negativePrompt ? (
                                <span className="timestamp">Negative: {shot.negativePrompt}</span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">Save a manual shot plan to compare it against the automatic planner.</div>
                      )}
                    </div>

                    <div className="compare-card">
                      <p className="eyebrow">Automatic Planner Preview</p>
                      <h4>{autoShotPlanPreview.length > 0 ? getShotPlanSummary(autoShotPlanPreview) : "Loading..."}</h4>
                      {autoShotPlanPreview.length > 0 ? (
                        <div className="compare-shot-list">
                          {autoShotPlanPreview.map((shot) => (
                            <div className="compare-shot-row" key={`auto-${shot.shotNumber}`}>
                              <strong>Shot {shot.shotNumber}</strong>
                              <span>{shot.description}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">Automatic planner preview is not available yet.</div>
                      )}
                    </div>
                  </div>
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
                  </>
                ) : null}

                {detailTab === "diagnostics" ? (
                <>
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
                            <span className="shot-index">
                              Shot {shot.shot_number}: {getShotLabel(shot.shot_number)}
                            </span>
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
                          {(shot.provider_task_id ||
                            shot.provider_request_id ||
                            shot.provider_units_consumed ||
                            shot.provider_request_payload ||
                            shot.provider_terminal_payload) ? (
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
                              {shot.provider_request_payload ? (
                                <details className="payload-block">
                                  <summary>
                                    <span className="metric-label">Request Payload</span>
                                  </summary>
                                  <pre>{formatJsonPayload(shot.provider_request_payload)}</pre>
                                </details>
                              ) : null}
                              {shot.provider_terminal_payload ? (
                                <details className="payload-block">
                                  <summary>
                                    <span className="metric-label">Response Payload</span>
                                  </summary>
                                  <pre>{formatJsonPayload(shot.provider_terminal_payload)}</pre>
                                </details>
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
                </>
                ) : null}
              </div>
            ) : (
              <div className="empty-state">Select a project card to inspect its latest job and shots.</div>
            )}
          </section>
        </section>
      </main>
      {pendingGenerateProjectId ? (
        <div className="modal-backdrop">
            <div className="modal-card">
              <p className="eyebrow">Confirm Generation</p>
              <h3>Generate from saved manual shot plan?</h3>
              <p className="detail-copy">
                This project has a saved shot plan. Starting generation will use those manual shots instead of the automatic planner and will spend provider credits.
              </p>
              <div className="estimate-banner">
                <span className="metric-label">Estimated Usage</span>
                <strong>
                  ~{getEstimatedCredits(savedShotPlan, generationProfile)} unit{getEstimatedCredits(savedShotPlan, generationProfile) === 1 ? "" : "s"}
                </strong>
              </div>
              <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setPendingGenerateProjectId(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={() => {
                  const projectId = pendingGenerateProjectId;
                  setPendingGenerateProjectId(null);
                  if (projectId) {
                    void startGeneration(projectId);
                  }
                }}
                type="button"
              >
                Generate With Manual Plan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
