import { FormEvent, useEffect, useState } from "react";
import {
  cancelGenerationShot,
  createProject,
  generateProject,
  getGenerationJob,
  getProjectAutoShotPlan,
  getProjectShotPlan,
  getProjectGenerationStatus,
  getVideoProviderConfig,
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
  ProjectShotPlanItem,
  VideoProviderConfig
} from "./types";

interface ProjectFormState {
  title: string;
  prompt: string;
  targetShotCount: number;
  defaultBeatDuration: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  styleHint: string;
  narrativeMode: "3-beat-story" | "5-beat-story" | "fight-scene" | "dialogue-scene" | "reveal-arc";
  autoBeatDescriptions: boolean;
  klingMode: "" | "std" | "pro";
  klingCfgScale: string;
  klingCameraControlType: "" | "simple" | "down_back" | "forward_up" | "right_turn_forward" | "left_turn_forward";
  klingCameraHorizontal: string;
  klingCameraVertical: string;
  klingCameraPan: string;
  klingCameraTilt: string;
  klingCameraRoll: string;
  klingCameraZoom: string;
}

type GenerationProfile = "testing" | "production";
type DetailTab = "workflow" | "diagnostics";
type ShotGenerationMode = "generate" | "extend-previous";
const DEFAULT_BEAT_DURATION = 5;

const initialFormState: ProjectFormState = {
  title: "",
  prompt: "",
  targetShotCount: 3,
  defaultBeatDuration: DEFAULT_BEAT_DURATION,
  aspectRatio: "16:9",
  styleHint: "",
  narrativeMode: "3-beat-story",
  autoBeatDescriptions: true,
  klingMode: "",
  klingCfgScale: "",
  klingCameraControlType: "",
  klingCameraHorizontal: "",
  klingCameraVertical: "",
  klingCameraPan: "",
  klingCameraTilt: "",
  klingCameraRoll: "",
  klingCameraZoom: ""
};

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const klingCameraControlTypes = [
  { value: "simple", label: "Simple" },
  { value: "down_back", label: "Down Back" },
  { value: "forward_up", label: "Forward Up" },
  { value: "right_turn_forward", label: "Right Turn Forward" },
  { value: "left_turn_forward", label: "Left Turn Forward" }
] as const;

function isKlingMode(value: string | null | undefined): value is "std" | "pro" {
  return value === "std" || value === "pro";
}

function isKlingCameraControlType(
  value: string | null | undefined
): value is NonNullable<ProjectPlanningSettings["klingCameraControlType"]> {
  return Boolean(value && klingCameraControlTypes.some((option) => option.value === value));
}

function resetKlingFormFields(state: ProjectFormState): ProjectFormState {
  return {
    ...state,
    klingMode: "",
    klingCfgScale: "",
    klingCameraControlType: "",
    klingCameraHorizontal: "",
    klingCameraVertical: "",
    klingCameraPan: "",
    klingCameraTilt: "",
    klingCameraRoll: "",
    klingCameraZoom: ""
  };
}

function resetKlingPlanningSettings(settings: ProjectPlanningSettings): ProjectPlanningSettings {
  return {
    ...settings,
    klingMode: null,
    klingCfgScale: null,
    klingCameraControlType: null,
    klingCameraHorizontal: null,
    klingCameraVertical: null,
    klingCameraPan: null,
    klingCameraTilt: null,
    klingCameraRoll: null,
    klingCameraZoom: null
  };
}

function resetShotKlingOverrides(shot: ProjectShotPlanItem): ProjectShotPlanItem {
  return {
    ...shot,
    klingMode: null,
    klingCfgScale: null,
    klingCameraControlType: null,
    klingCameraHorizontal: null,
    klingCameraVertical: null,
    klingCameraPan: null,
    klingCameraTilt: null,
    klingCameraRoll: null,
    klingCameraZoom: null
  };
}

function getShotCameraControlNotice(shot: ProjectShotPlanItem) {
  if (shot.generationMode !== "generate") {
    return "Camera control only applies to Generate New Clip shots.";
  }

  if ((shot.klingMode ?? null) === "pro") {
    return "Camera control is omitted when Kling mode is Pro.";
  }

  if (shot.durationSeconds !== 5) {
    return "Camera control is only sent on 5-second generate shots.";
  }

  return "Camera control is eligible for this shot.";
}

function shouldHideCameraControls(mode: string | null | undefined) {
  return mode === "pro";
}

function clearProjectCameraFields<T extends ProjectPlanningSettings | ProjectFormState>(state: T): T {
  return {
    ...state,
    klingCameraControlType: null as T["klingCameraControlType"],
    klingCameraHorizontal: null as T["klingCameraHorizontal"],
    klingCameraVertical: null as T["klingCameraVertical"],
    klingCameraPan: null as T["klingCameraPan"],
    klingCameraTilt: null as T["klingCameraTilt"],
    klingCameraRoll: null as T["klingCameraRoll"],
    klingCameraZoom: null as T["klingCameraZoom"]
  };
}

function clearProjectFormCameraFields(state: ProjectFormState): ProjectFormState {
  return {
    ...state,
    klingCameraControlType: "",
    klingCameraHorizontal: "",
    klingCameraVertical: "",
    klingCameraPan: "",
    klingCameraTilt: "",
    klingCameraRoll: "",
    klingCameraZoom: ""
  };
}

function createDefaultShotPlan(durationSeconds = DEFAULT_BEAT_DURATION): ProjectShotPlanItem[] {
  return [
    { shotNumber: 1, beatLabel: "Intro", description: "Establishing shot", durationSeconds, generationMode: "generate", sourceShotNumber: null, extendPrompt: "", negativePrompt: "", cameraNotes: "" },
    { shotNumber: 2, beatLabel: "Continuation", description: "Main action beat", durationSeconds, generationMode: "extend-previous", sourceShotNumber: 1, extendPrompt: "Continue the established action and motion from shot 1.", negativePrompt: "", cameraNotes: "" },
    { shotNumber: 3, beatLabel: "Climax", description: "Closing shot", durationSeconds, generationMode: "extend-previous", sourceShotNumber: 2, extendPrompt: "Carry the sequence forward into the climactic payoff from shot 2.", negativePrompt: "", cameraNotes: "" }
  ];
}

const terminalStatuses = new Set(["completed", "failed", "canceled"]);
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

function normalizeShotSequence(shots: ProjectShotPlanItem[]) {
  return shots.map((shot, index) => {
    const shotNumber = index + 1;
    const generationMode: ShotGenerationMode =
      shotNumber === 1 ? "generate" : shot.generationMode === "extend-previous" ? "extend-previous" : "generate";
    const sourceShotNumber =
      generationMode === "extend-previous"
        ? Math.min(Math.max(shot.sourceShotNumber ?? shotNumber - 1, 1), shotNumber - 1)
        : null;

    return {
      ...shot,
      shotNumber,
      generationMode,
      sourceShotNumber,
      extendPrompt: generationMode === "extend-previous" ? shot.extendPrompt ?? "" : ""
    };
  });
}

function getEstimatedCredits(shots: ProjectShotPlanItem[], profile: GenerationProfile) {
  return shots.length * estimatedUnitsPerShot[profile];
}

function getPerShotEstimatedCredits(profile: GenerationProfile) {
  return estimatedUnitsPerShot[profile];
}

function getClosestSupportedDuration(durationSeconds: number, supportedDurations: number[]) {
  if (supportedDurations.length === 0) {
    return durationSeconds;
  }

  return supportedDurations.reduce((closest, current) => {
    const currentDistance = Math.abs(current - durationSeconds);
    const closestDistance = Math.abs(closest - durationSeconds);

    if (currentDistance < closestDistance) {
      return current;
    }

    if (currentDistance === closestDistance) {
      return current < closest ? current : closest;
    }

    return closest;
  }, supportedDurations[0]);
}

function normalizeShotPlanDurations(
  shots: ProjectShotPlanItem[],
  supportedDurations: number[]
): ProjectShotPlanItem[] {
  if (supportedDurations.length === 0) {
    return shots;
  }

  return shots.map((shot) => ({
    ...shot,
    durationSeconds: getClosestSupportedDuration(shot.durationSeconds, supportedDurations)
  }));
}

function clampBeatDuration(value: number) {
  return Math.min(Math.max(value || DEFAULT_BEAT_DURATION, 1), 30);
}

function reorderShots(shots: ProjectShotPlanItem[], fromIndex: number, toIndex: number) {
  const next = [...shots];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return normalizeShotSequence(next);
}

function getLatestJob(projectStatus?: ProjectGenerationStatus) {
  return projectStatus?.jobs[0] ?? null;
}

function getLatestShots(projectStatus?: ProjectGenerationStatus) {
  return projectStatus?.shots ?? [];
}

function isTerminalStatus(status?: string | null) {
  return status ? terminalStatuses.has(status) : false;
}

function isActiveStatus(status?: string | null) {
  return status === "queued" || status === "processing";
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

function getContinuitySummary(shots: ProjectShotPlanItem[]) {
  if (shots.length <= 1) {
    return "Single clip";
  }

  const extendCount = shots.filter((shot) => shot.generationMode === "extend-previous").length;
  return extendCount > 0 ? `${extendCount}/${shots.length - 1} follow-up shots extend prior clips` : "Independent clips";
}

function buildNarrativeTemplate(
  narrativeMode: NonNullable<ProjectPlanningSettings["narrativeMode"]>,
  shotCount: number,
  defaultBeatDuration: number
) {
  const duration = clampBeatDuration(defaultBeatDuration);

  const templateMap: Record<NonNullable<ProjectPlanningSettings["narrativeMode"]>, Array<{ beatLabel: string; description: string; durationOffset?: number }>> = {
    "3-beat-story": [
      { beatLabel: "Intro", description: "Set up the subject, world, or opening situation." },
      { beatLabel: "Continuation", description: "Develop the action, conflict, or key progression." },
      { beatLabel: "Climax", description: "Deliver the peak action or emotional payoff.", durationOffset: 1 }
    ],
    "5-beat-story": [
      { beatLabel: "Hook", description: "Open with an attention-grabbing first visual.", durationOffset: -1 },
      { beatLabel: "Setup", description: "Establish context and main subject." },
      { beatLabel: "Rising Action", description: "Increase momentum and narrative tension." },
      { beatLabel: "Climax", description: "Deliver the main turning point or impact.", durationOffset: 1 },
      { beatLabel: "Resolution", description: "Close with a final image that resolves the moment.", durationOffset: -1 }
    ],
    "fight-scene": [
      { beatLabel: "Standoff", description: "Establish the opponents and the tension before impact." },
      { beatLabel: "First Clash", description: "Show the first exchange of force and movement." },
      { beatLabel: "Momentum Shift", description: "Escalate the fight with a surprise or reversal." },
      { beatLabel: "Finisher", description: "Deliver the decisive attack or ultimate move.", durationOffset: 1 },
      { beatLabel: "Aftershock", description: "Show the aftermath and emotional release.", durationOffset: -1 }
    ],
    "dialogue-scene": [
      { beatLabel: "Approach", description: "Introduce the characters and conversational tension." },
      { beatLabel: "Exchange", description: "Deliver the core dialogue beat and reactions." },
      { beatLabel: "Turn", description: "Reveal the emotional or narrative shift." },
      { beatLabel: "Response", description: "Show the consequences of what was said." }
    ],
    "reveal-arc": [
      { beatLabel: "Mystery", description: "Frame the unknown or hidden truth." },
      { beatLabel: "Clue", description: "Reveal a detail that changes interpretation." },
      { beatLabel: "Reveal", description: "Unveil the core surprise or transformation.", durationOffset: 1 },
      { beatLabel: "Reaction", description: "Show the emotional response and impact." }
    ]
  };

  const base = templateMap[narrativeMode];
  const targetCount = Math.min(Math.max(shotCount, 1), 12);

  return Array.from({ length: targetCount }, (_, index) => {
    const source = base[Math.min(index, base.length - 1)];
    return {
      shotNumber: index + 1,
      beatLabel: source.beatLabel,
      description: source.description,
      durationSeconds: clampBeatDuration(duration + (source.durationOffset ?? 0)),
      generationMode: index === 0 ? "generate" : "extend-previous",
      sourceShotNumber: index === 0 ? null : index,
      extendPrompt: index === 0 ? "" : source.description,
      negativePrompt: "",
      cameraNotes: ""
    };
  });
}

function applyStoryTemplateWithOptions(
  narrativeMode: NonNullable<ProjectPlanningSettings["narrativeMode"]>,
  shotCount: number,
  defaultBeatDuration: number,
  preserveDescriptions: boolean,
  currentShots: ProjectShotPlanItem[]
): ProjectShotPlanItem[] {
  const template = buildNarrativeTemplate(narrativeMode, shotCount, defaultBeatDuration);

  return normalizeShotSequence(
    template.map((shot, index) => ({
      shotNumber: index + 1,
      beatLabel: shot.beatLabel,
      description: preserveDescriptions ? currentShots[index]?.description ?? "" : shot.description,
      durationSeconds: currentShots[index]?.durationSeconds ?? shot.durationSeconds,
      generationMode: currentShots[index]?.generationMode ?? (index === 0 ? "generate" : "extend-previous"),
      sourceShotNumber: currentShots[index]?.sourceShotNumber ?? (index === 0 ? null : index),
      extendPrompt: currentShots[index]?.extendPrompt ?? (index === 0 ? "" : shot.description),
      negativePrompt: currentShots[index]?.negativePrompt ?? "",
      cameraNotes: currentShots[index]?.cameraNotes ?? ""
    }))
  );
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
          {shot.beat_label ? `${shot.beat_label}` : `Shot ${shot.shot_number}`}
        </span>
      ))}
    </div>
  );
}

function ContinuityChain({
  shots,
  title,
  emptyMessage
}: {
  shots: Array<{
    shotNumber: number;
    beatLabel?: string | null;
    generationMode?: string | null;
    sourceShotNumber?: number | null;
  }>;
  title: string;
  emptyMessage: string;
}) {
  if (shots.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="continuity-card">
      <p className="eyebrow">{title}</p>
      <div className="continuity-chain">
        {shots.map((shot, index) => (
          <div className="continuity-node-wrap" key={`${title}-${shot.shotNumber}`}>
            <div className="continuity-node">
              <strong>
                Shot {shot.shotNumber}
                {shot.beatLabel ? `: ${shot.beatLabel}` : ""}
              </strong>
              <span className="timestamp">
                {shot.generationMode === "extend-previous"
                  ? `Extends Shot ${shot.sourceShotNumber ?? "?"}`
                  : "Generates new clip"}
              </span>
            </div>
            {index < shots.length - 1 ? <div className="continuity-arrow">→</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<Record<string, ProjectGenerationStatus>>({});
  const [jobDiagnostics, setJobDiagnostics] = useState<Record<string, GenerationJobStatus>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editableShotPlan, setEditableShotPlan] = useState<ProjectShotPlanItem[]>(createDefaultShotPlan());
  const [savedShotPlan, setSavedShotPlan] = useState<ProjectShotPlanItem[]>([]);
  const [autoShotPlanPreview, setAutoShotPlanPreview] = useState<ProjectShotPlanItem[]>([]);
  const [videoProviderConfig, setVideoProviderConfig] = useState<VideoProviderConfig | null>(null);
  const [formState, setFormState] = useState<ProjectFormState>(initialFormState);
  const [planningSettings, setPlanningSettings] = useState<ProjectPlanningSettings>({
    targetShotCount: 3,
    defaultBeatDuration: DEFAULT_BEAT_DURATION,
    aspectRatio: "16:9",
    styleHint: "",
    narrativeMode: "3-beat-story",
    autoBeatDescriptions: true,
    klingMode: null,
    klingCfgScale: null,
    klingCameraControlType: null,
    klingCameraHorizontal: null,
    klingCameraVertical: null,
    klingCameraPan: null,
    klingCameraTilt: null,
    klingCameraRoll: null,
    klingCameraZoom: null
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

  function optimisticUpdateProjectJob(
    projectId: string,
    jobId: string,
    updates: Partial<GenerationJob>,
    options?: { prependIfMissing?: boolean }
  ) {
    const now = new Date().toISOString();

    setProjects((current) =>
      current.map((project) =>
        project.id === projectId
          ? {
              ...project,
              status: (updates.status as string | undefined) ?? project.status,
              updated_at: updates.updated_at ?? now,
              output_url: updates.output_url === undefined ? project.output_url : updates.output_url
            }
          : project
      )
    );

    setProjectStatuses((current) => {
      const existing = current[projectId];

      if (!existing) {
        return current;
      }

      const existingJob = existing.jobs.find((job) => job.id === jobId);
      const nextJob: GenerationJob = existingJob
        ? { ...existingJob, ...updates, updated_at: updates.updated_at ?? now }
        : {
            id: jobId,
            project_id: projectId,
            status: (updates.status as string | undefined) ?? "queued",
            generation_profile: generationProfile,
            planner_provider: updates.planner_provider ?? "pending",
            video_provider: updates.video_provider ?? undefined,
            metadata_url: updates.metadata_url ?? null,
            provider_model: updates.provider_model ?? null,
            shot_count: updates.shot_count ?? null,
            output_path: updates.output_path ?? null,
            output_url: updates.output_url ?? null,
            error_message: updates.error_message ?? null,
            created_at: updates.created_at ?? now,
            updated_at: updates.updated_at ?? now
          };

      const nextJobs = existingJob
        ? existing.jobs.map((job) => (job.id === jobId ? nextJob : job))
        : options?.prependIfMissing
          ? [nextJob, ...existing.jobs]
          : existing.jobs;

      return {
        ...current,
        [projectId]: {
          ...existing,
          project: {
            ...existing.project,
            status: (updates.status as string | undefined) ?? existing.project.status,
            updated_at: updates.updated_at ?? now,
            output_url: updates.output_url === undefined ? existing.project.output_url : updates.output_url
          },
          jobs: nextJobs
        }
      };
    });
  }

  function optimisticUpdateJobDiagnostics(jobId: string, updates: Partial<GenerationJob>, shotUpdater?: (shots: GenerationShot[]) => GenerationShot[]) {
    const now = new Date().toISOString();

    setJobDiagnostics((current) => {
      const existing = current[jobId];

      if (!existing) {
        return current;
      }

      return {
        ...current,
        [jobId]: {
          ...existing,
          job: {
            ...existing.job,
            ...updates,
            updated_at: updates.updated_at ?? now
          },
          shots: shotUpdater ? shotUpdater(existing.shots) : existing.shots
        }
      };
    });
  }

  async function refreshProjectShotPlan(projectId: string, options?: { preserveEditor?: boolean }) {
    const response = await getProjectShotPlan(projectId);
    const shots = response.data
      .map((shot) => ({
        shotNumber: shot.shot_number,
        beatLabel: shot.beat_label,
        description: shot.description,
        durationSeconds: shot.duration_seconds,
        generationMode: (shot.generation_mode as "generate" | "extend-previous" | null) ?? "generate",
        sourceShotNumber: shot.source_shot_number,
        extendPrompt: shot.extend_prompt,
        negativePrompt: shot.negative_prompt,
        cameraNotes: shot.camera_notes,
        klingMode: isKlingMode(shot.kling_mode) ? shot.kling_mode : null,
        klingCfgScale: shot.kling_cfg_scale,
        klingCameraControlType: isKlingCameraControlType(shot.kling_camera_control_type)
          ? shot.kling_camera_control_type
          : null,
        klingCameraHorizontal: shot.kling_camera_horizontal,
        klingCameraVertical: shot.kling_camera_vertical,
        klingCameraPan: shot.kling_camera_pan,
        klingCameraTilt: shot.kling_camera_tilt,
        klingCameraRoll: shot.kling_camera_roll,
        klingCameraZoom: shot.kling_camera_zoom
      }))
      .sort((a, b) => a.shotNumber - b.shotNumber);

    setSavedShotPlan(shots);

    if (!options?.preserveEditor) {
      setEditableShotPlan(
        normalizeShotSequence(
          normalizeShotPlanDurations(shots.length > 0 ? shots : createDefaultShotPlan(), supportedDurations)
        )
      );
    }
  }

  async function refreshAutoShotPlan(projectId: string) {
    const response = await getProjectAutoShotPlan(projectId);
    setAutoShotPlanPreview(normalizeShotSequence(normalizeShotPlanDurations(response.data, supportedDurations)));
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
      setSavedShotPlan([]);
      setEditableShotPlan(createDefaultShotPlan());
      setAutoShotPlanPreview([]);
      setSelectedJobId(null);
      return;
    }

    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    if (selectedProject) {
      setPlanningSettings({
        targetShotCount: selectedProject.target_shot_count ?? 3,
        defaultBeatDuration: selectedProject.default_beat_duration ?? DEFAULT_BEAT_DURATION,
        aspectRatio: (selectedProject.aspect_ratio as "16:9" | "9:16" | "1:1" | null) ?? "16:9",
        styleHint: selectedProject.style_hint ?? "",
        narrativeMode:
          (selectedProject.narrative_mode as
            | "3-beat-story"
            | "5-beat-story"
            | "fight-scene"
            | "dialogue-scene"
            | "reveal-arc"
            | null) ?? "3-beat-story",
        autoBeatDescriptions: selectedProject.auto_beat_descriptions ?? true,
        klingMode: isKlingMode(selectedProject.kling_mode) ? selectedProject.kling_mode : null,
        klingCfgScale: selectedProject.kling_cfg_scale ?? null,
        klingCameraControlType: isKlingCameraControlType(selectedProject.kling_camera_control_type)
          ? selectedProject.kling_camera_control_type
          : null,
        klingCameraHorizontal: selectedProject.kling_camera_horizontal ?? null,
        klingCameraVertical: selectedProject.kling_camera_vertical ?? null,
        klingCameraPan: selectedProject.kling_camera_pan ?? null,
        klingCameraTilt: selectedProject.kling_camera_tilt ?? null,
        klingCameraRoll: selectedProject.kling_camera_roll ?? null,
        klingCameraZoom: selectedProject.kling_camera_zoom ?? null
      });
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    void refreshProjectShotPlan(selectedProjectId).catch((shotPlanError) => {
      setError(shotPlanError instanceof Error ? shotPlanError.message : "Unable to load shot plan");
    });
    void refreshAutoShotPlan(selectedProjectId).catch((shotPlanError) => {
      setError(shotPlanError instanceof Error ? shotPlanError.message : "Unable to load auto shot plan");
    });
  }, [selectedProjectId]);

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
        const providerConfig = await getVideoProviderConfig();
        setVideoProviderConfig(providerConfig.data);
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
      const response = await createProject({
        ...formState,
        klingMode: formState.klingMode || null,
        klingCfgScale: parseOptionalNumber(formState.klingCfgScale),
        klingCameraControlType: formState.klingCameraControlType || null,
        klingCameraHorizontal:
          formState.klingCameraControlType === "simple" ? parseOptionalNumber(formState.klingCameraHorizontal) : null,
        klingCameraVertical:
          formState.klingCameraControlType === "simple" ? parseOptionalNumber(formState.klingCameraVertical) : null,
        klingCameraPan: formState.klingCameraControlType === "simple" ? parseOptionalNumber(formState.klingCameraPan) : null,
        klingCameraTilt:
          formState.klingCameraControlType === "simple" ? parseOptionalNumber(formState.klingCameraTilt) : null,
        klingCameraRoll:
          formState.klingCameraControlType === "simple" ? parseOptionalNumber(formState.klingCameraRoll) : null,
        klingCameraZoom: formState.klingCameraControlType === "simple" ? parseOptionalNumber(formState.klingCameraZoom) : null
      });
      setFormState(initialFormState);
      setSelectedProjectId(response.data.id);
      setPlanningSettings({
        targetShotCount: response.data.target_shot_count ?? 3,
        defaultBeatDuration: response.data.default_beat_duration ?? DEFAULT_BEAT_DURATION,
        aspectRatio: (response.data.aspect_ratio as "16:9" | "9:16" | "1:1" | null) ?? "16:9",
        styleHint: response.data.style_hint ?? "",
        narrativeMode:
          (response.data.narrative_mode as ProjectFormState["narrativeMode"] | null) ?? "3-beat-story",
        autoBeatDescriptions: response.data.auto_beat_descriptions ?? true,
        klingMode: isKlingMode(response.data.kling_mode) ? response.data.kling_mode : null,
        klingCfgScale: response.data.kling_cfg_scale ?? null,
        klingCameraControlType: isKlingCameraControlType(response.data.kling_camera_control_type)
          ? response.data.kling_camera_control_type
          : null,
        klingCameraHorizontal: response.data.kling_camera_horizontal ?? null,
        klingCameraVertical: response.data.kling_camera_vertical ?? null,
        klingCameraPan: response.data.kling_camera_pan ?? null,
        klingCameraTilt: response.data.kling_camera_tilt ?? null,
        klingCameraRoll: response.data.kling_camera_roll ?? null,
        klingCameraZoom: response.data.kling_camera_zoom ?? null
      });
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
        defaultBeatDuration: planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION,
        aspectRatio: planningSettings.aspectRatio ?? "16:9",
        styleHint: planningSettings.styleHint ?? "",
        narrativeMode: planningSettings.narrativeMode ?? "3-beat-story",
        autoBeatDescriptions: planningSettings.autoBeatDescriptions ?? true,
        klingMode: planningSettings.klingMode ?? null,
        klingCfgScale: planningSettings.klingCfgScale ?? null,
        klingCameraControlType: planningSettings.klingCameraControlType ?? null,
        klingCameraHorizontal: planningSettings.klingCameraHorizontal ?? null,
        klingCameraVertical: planningSettings.klingCameraVertical ?? null,
        klingCameraPan: planningSettings.klingCameraPan ?? null,
        klingCameraTilt: planningSettings.klingCameraTilt ?? null,
        klingCameraRoll: planningSettings.klingCameraRoll ?? null,
        klingCameraZoom: planningSettings.klingCameraZoom ?? null
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
      const response = await generateProject(projectId, generationProfile);
      const optimisticTimestamp = new Date().toISOString();

      setSelectedProjectId(projectId);
      setSelectedJobId(response.data.id);
      setDetailTab("workflow");
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? {
                ...project,
                status: "queued",
                updated_at: new Date().toISOString()
              }
            : project
        )
      );
      optimisticUpdateProjectJob(
        projectId,
        response.data.id,
        {
          status: "queued",
          generation_profile: generationProfile,
          planner_provider: "pending",
          video_provider: undefined,
          output_url: null,
          error_message: null,
          created_at: optimisticTimestamp,
          updated_at: optimisticTimestamp
        },
        { prependIfMissing: true }
      );
      setJobDiagnostics((current) => ({
        ...current,
        [response.data.id]: {
          job: {
            id: response.data.id,
            project_id: projectId,
            status: "queued",
            generation_profile: generationProfile,
            planner_provider: "pending",
            video_provider: undefined,
            metadata_url: null,
            provider_model: null,
            shot_count: null,
            output_path: null,
            output_url: null,
            error_message: null,
            created_at: optimisticTimestamp,
            updated_at: optimisticTimestamp
          },
          shots: []
        }
      }));

      await Promise.all([
        refreshDashboardData(),
        refreshProjectStatus(projectId),
        refreshJobDiagnostics(response.data.id)
      ]);
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
      const response = await retryGenerationJob(jobId);
      const optimisticTimestamp = new Date().toISOString();
      optimisticUpdateProjectJob(response.data.projectId, jobId, {
        status: "queued",
        output_url: null,
        error_message: null,
        updated_at: optimisticTimestamp
      });
      optimisticUpdateJobDiagnostics(
        jobId,
        {
          status: "queued",
          output_url: null,
          error_message: null,
          updated_at: optimisticTimestamp
        },
        (shots) =>
          shots.map((shot) => ({
            ...shot,
            status: shot.status === "completed" ? "completed" : "planned",
            error_message: null,
            updated_at: optimisticTimestamp
          }))
      );
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
      const response = await retryGenerationShot(jobId, shotNumber);
      const optimisticTimestamp = new Date().toISOString();
      optimisticUpdateProjectJob(response.data.projectId, jobId, {
        status: "processing",
        error_message: null,
        output_url: null,
        updated_at: optimisticTimestamp
      });
      optimisticUpdateJobDiagnostics(
        jobId,
        {
          status: "processing",
          error_message: null,
          output_url: null,
          updated_at: optimisticTimestamp
        },
        (shots) =>
          shots.map((shot) =>
            shot.shot_number < shotNumber
              ? shot
              : {
                  ...shot,
                  status: shot.shot_number === shotNumber ? "planned" : shot.status === "completed" ? "completed" : "planned",
                  error_message: null,
                  updated_at: optimisticTimestamp
                }
          )
      );
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
      const normalized = normalizeShotSequence(editableShotPlan).map((shot) => ({
        shotNumber: shot.shotNumber,
        beatLabel: shot.beatLabel ?? "",
        description: shot.description,
        durationSeconds: getClosestSupportedDuration(shot.durationSeconds, supportedDurations),
        generationMode: shot.generationMode ?? "generate",
        sourceShotNumber: shot.generationMode === "extend-previous" ? shot.sourceShotNumber ?? null : null,
        extendPrompt: shot.generationMode === "extend-previous" ? shot.extendPrompt ?? "" : "",
        negativePrompt: shot.negativePrompt ?? "",
        cameraNotes: shot.cameraNotes ?? "",
        klingMode: shot.generationMode === "generate" ? shot.klingMode ?? null : null,
        klingCfgScale: shot.generationMode === "generate" ? shot.klingCfgScale ?? null : null,
        klingCameraControlType: shot.generationMode === "generate" ? shot.klingCameraControlType ?? null : null,
        klingCameraHorizontal: shot.generationMode === "generate" ? shot.klingCameraHorizontal ?? null : null,
        klingCameraVertical: shot.generationMode === "generate" ? shot.klingCameraVertical ?? null : null,
        klingCameraPan: shot.generationMode === "generate" ? shot.klingCameraPan ?? null : null,
        klingCameraTilt: shot.generationMode === "generate" ? shot.klingCameraTilt ?? null : null,
        klingCameraRoll: shot.generationMode === "generate" ? shot.klingCameraRoll ?? null : null,
        klingCameraZoom: shot.generationMode === "generate" ? shot.klingCameraZoom ?? null : null
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
  const supportedDurations = videoProviderConfig?.durations ?? [];
  const supportedAspectRatios =
    videoProviderConfig?.aspectRatios.filter(
      (value): value is "16:9" | "9:16" | "1:1" => value === "16:9" || value === "9:16" || value === "1:1"
    ) ?? ["16:9", "9:16", "1:1"];
  const usesFixedDurationOptions = supportedDurations.length > 0;
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
                  <span>Default Beat Duration</span>
                  {usesFixedDurationOptions ? (
                    <select
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          defaultBeatDuration: Number(event.target.value) || DEFAULT_BEAT_DURATION
                        }))
                      }
                      value={String(formState.defaultBeatDuration)}
                    >
                      {supportedDurations.map((duration) => (
                        <option key={duration} value={duration}>
                          {duration}s
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      min={1}
                      max={30}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          defaultBeatDuration: Number(event.target.value) || DEFAULT_BEAT_DURATION
                        }))
                      }
                      type="number"
                      value={formState.defaultBeatDuration}
                    />
                  )}
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
                    {supportedAspectRatios.map((aspectRatio) => (
                      <option key={aspectRatio} value={aspectRatio}>
                        {aspectRatio}
                      </option>
                    ))}
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

              <div className="project-settings-grid">
                <label>
                  <span>Narrative Mode</span>
                  <select
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        narrativeMode: event.target.value as ProjectFormState["narrativeMode"]
                      }))
                    }
                    value={formState.narrativeMode}
                  >
                    <option value="3-beat-story">3-Beat Story</option>
                    <option value="5-beat-story">5-Beat Story</option>
                    <option value="fight-scene">Fight Scene</option>
                    <option value="dialogue-scene">Dialogue Scene</option>
                    <option value="reveal-arc">Reveal Arc</option>
                  </select>
                </label>

                <label className="checkbox-label">
                  <span>Auto-Fill Beat Descriptions</span>
                  <input
                    checked={formState.autoBeatDescriptions}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, autoBeatDescriptions: event.target.checked }))
                    }
                    type="checkbox"
                  />
                </label>
              </div>

                <div className="advanced-tab-panel">
                  <div className="advanced-panel-header">
                    <div>
                      <p className="eyebrow">Kling Advanced</p>
                      <p className="project-card-caption">
                        Optional expert controls for Kling. In <strong>Simple</strong> mode you can tune multiple camera
                        axes together.
                      </p>
                    </div>
                    <button className="ghost-button" onClick={() => setFormState((current) => resetKlingFormFields(current))} type="button">
                      Reset Kling Controls
                    </button>
                  </div>

                <div className="project-settings-grid">
                  <label>
                    <span>Kling Mode</span>
                    <select
                      onChange={(event) =>
                        setFormState((current) => {
                          const nextState = {
                            ...current,
                            klingMode: event.target.value as ProjectFormState["klingMode"]
                          };

                          return shouldHideCameraControls(nextState.klingMode)
                            ? clearProjectFormCameraFields(nextState)
                            : nextState;
                        })
                      }
                      value={formState.klingMode}
                    >
                      <option value="">Default</option>
                      <option value="std">Std</option>
                      <option value="pro">Pro</option>
                    </select>
                  </label>

                  <label className="slider-label">
                    <span>CFG Scale</span>
                    <div className="slider-control">
                      <input
                        onChange={(event) => setFormState((current) => ({ ...current, klingCfgScale: event.target.value }))}
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formState.klingCfgScale || "0.5"}
                      />
                      <strong>{formState.klingCfgScale || "0.5"}</strong>
                    </div>
                  </label>
                </div>

                {!shouldHideCameraControls(formState.klingMode || null) ? (
                  <div className="project-settings-grid">
                    <label>
                      <span>Camera Type</span>
                      <select
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            klingCameraControlType: event.target.value as ProjectFormState["klingCameraControlType"],
                            klingCameraHorizontal: event.target.value === "simple" ? current.klingCameraHorizontal : "",
                            klingCameraVertical: event.target.value === "simple" ? current.klingCameraVertical : "",
                            klingCameraPan: event.target.value === "simple" ? current.klingCameraPan : "",
                            klingCameraTilt: event.target.value === "simple" ? current.klingCameraTilt : "",
                            klingCameraRoll: event.target.value === "simple" ? current.klingCameraRoll : "",
                            klingCameraZoom: event.target.value === "simple" ? current.klingCameraZoom : ""
                          }))
                        }
                        value={formState.klingCameraControlType}
                      >
                        <option value="">None</option>
                        {klingCameraControlTypes.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    {formState.klingCameraControlType !== "simple" ? (
                      <p className="project-card-caption">
                        Select <strong>Simple</strong> to tune one or more camera axes.
                      </p>
                    ) : null}

                    {formState.klingCameraControlType === "simple" ? (
                      <>
                        <label className="slider-label">
                          <span>Horizontal</span>
                          <div className="slider-control">
                            <input onChange={(event) => setFormState((current) => ({ ...current, klingCameraHorizontal: event.target.value }))} type="range" min="-10" max="10" step="0.1" value={formState.klingCameraHorizontal || "0"} />
                            <strong>{formState.klingCameraHorizontal || "0"}</strong>
                          </div>
                        </label>
                        <label className="slider-label">
                          <span>Vertical</span>
                          <div className="slider-control">
                            <input onChange={(event) => setFormState((current) => ({ ...current, klingCameraVertical: event.target.value }))} type="range" min="-10" max="10" step="0.1" value={formState.klingCameraVertical || "0"} />
                            <strong>{formState.klingCameraVertical || "0"}</strong>
                          </div>
                        </label>
                        <label className="slider-label">
                          <span>Pan</span>
                          <div className="slider-control">
                            <input onChange={(event) => setFormState((current) => ({ ...current, klingCameraPan: event.target.value }))} type="range" min="-10" max="10" step="0.1" value={formState.klingCameraPan || "0"} />
                            <strong>{formState.klingCameraPan || "0"}</strong>
                          </div>
                        </label>
                        <label className="slider-label">
                          <span>Tilt</span>
                          <div className="slider-control">
                            <input onChange={(event) => setFormState((current) => ({ ...current, klingCameraTilt: event.target.value }))} type="range" min="-10" max="10" step="0.1" value={formState.klingCameraTilt || "0"} />
                            <strong>{formState.klingCameraTilt || "0"}</strong>
                          </div>
                        </label>
                        <label className="slider-label">
                          <span>Roll</span>
                          <div className="slider-control">
                            <input onChange={(event) => setFormState((current) => ({ ...current, klingCameraRoll: event.target.value }))} type="range" min="-10" max="10" step="0.1" value={formState.klingCameraRoll || "0"} />
                            <strong>{formState.klingCameraRoll || "0"}</strong>
                          </div>
                        </label>
                        <label className="slider-label">
                          <span>Zoom</span>
                          <div className="slider-control">
                            <input onChange={(event) => setFormState((current) => ({ ...current, klingCameraZoom: event.target.value }))} type="range" min="-10" max="10" step="0.1" value={formState.klingCameraZoom || "0"} />
                            <strong>{formState.klingCameraZoom || "0"}</strong>
                          </div>
                        </label>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <p className="project-card-caption">Camera control is not available when Kling mode is Pro.</p>
                )}
              </div>

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
                  const projectStatus = projectStatuses[project.id];
                  const latestJob = getLatestJob(projectStatus);
                  const latestShots = getLatestShots(projectStatus);
                  const activeProviderTaskId = getActiveProviderTask(latestShots);
                  const canRetryJob = latestJob ? latestJob.status === "failed" || latestJob.status === "processing" : false;
                  const hasActiveJob = latestJob ? isActiveStatus(latestJob.status) : isActiveStatus(project.status);
                  const canGenerate = !hasActiveJob;
                  const generateLabel = latestJob ? "Regenerate Video" : "Generate Video";
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
                  <div className="detail-row">
                    <span className="metric-label">Continuity Mode</span>
                    <span>{getContinuitySummary(usingManualShotPlan ? savedShotPlan : editableShotPlan)}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Continuity Chain</p>
                      <h3>How shots connect across the story</h3>
                    </div>
                  </div>

                  <ContinuityChain
                    emptyMessage="Save or generate a shot plan to visualize continuity."
                    shots={(usingManualShotPlan ? savedShotPlan : editableShotPlan).map((shot) => ({
                      shotNumber: shot.shotNumber,
                      beatLabel: shot.beatLabel,
                      generationMode: shot.generationMode,
                      sourceShotNumber: shot.sourceShotNumber
                    }))}
                    title={usingManualShotPlan ? "Saved continuity plan" : "Editor continuity plan"}
                  />
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
                      <span>Default Beat Duration</span>
                      {usesFixedDurationOptions ? (
                        <select
                          onChange={(event) =>
                            setPlanningSettings((current) => ({
                              ...current,
                              defaultBeatDuration: Number(event.target.value) || DEFAULT_BEAT_DURATION
                            }))
                          }
                          value={String(planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION)}
                        >
                          {supportedDurations.map((duration) => (
                            <option key={duration} value={duration}>
                              {duration}s
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          min={1}
                          max={30}
                          onChange={(event) =>
                            setPlanningSettings((current) => ({
                              ...current,
                              defaultBeatDuration: Number(event.target.value) || DEFAULT_BEAT_DURATION
                            }))
                          }
                          type="number"
                          value={planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION}
                        />
                      )}
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
                        {supportedAspectRatios.map((aspectRatio) => (
                          <option key={aspectRatio} value={aspectRatio}>
                            {aspectRatio}
                          </option>
                        ))}
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

                  <div className="project-settings-grid">
                    <label>
                      <span>Narrative Mode</span>
                      <select
                        onChange={(event) =>
                          setPlanningSettings((current) => ({
                            ...current,
                            narrativeMode: event.target.value as NonNullable<ProjectPlanningSettings["narrativeMode"]>
                          }))
                        }
                        value={planningSettings.narrativeMode ?? "3-beat-story"}
                      >
                        <option value="3-beat-story">3-Beat Story</option>
                        <option value="5-beat-story">5-Beat Story</option>
                        <option value="fight-scene">Fight Scene</option>
                        <option value="dialogue-scene">Dialogue Scene</option>
                        <option value="reveal-arc">Reveal Arc</option>
                      </select>
                    </label>

                    <label className="checkbox-label">
                      <span>Auto-Fill Beat Descriptions</span>
                      <input
                        checked={planningSettings.autoBeatDescriptions ?? true}
                        onChange={(event) =>
                          setPlanningSettings((current) => ({
                            ...current,
                            autoBeatDescriptions: event.target.checked
                          }))
                        }
                        type="checkbox"
                      />
                    </label>
                  </div>

                  <div className="advanced-tab-panel">
                    <div className="advanced-panel-header">
                      <div>
                        <p className="eyebrow">Kling Advanced</p>
                        <p className="project-card-caption">
                          Optional expert controls for Kling. In <strong>Simple</strong> mode you can tune multiple camera
                          axes together.
                        </p>
                      </div>
                      <button
                        className="ghost-button"
                        onClick={() => setPlanningSettings((current) => resetKlingPlanningSettings(current))}
                        type="button"
                      >
                        Reset Kling Controls
                      </button>
                    </div>

                    <div className="project-settings-grid">
                      <label>
                        <span>Kling Mode</span>
                        <select
                          onChange={(event) =>
                            setPlanningSettings((current) => {
                              const nextState = { ...current, klingMode: event.target.value || null };
                              return shouldHideCameraControls(nextState.klingMode ?? null)
                                ? clearProjectCameraFields(nextState)
                                : nextState;
                            })
                          }
                          value={planningSettings.klingMode ?? ""}
                        >
                          <option value="">Default</option>
                          <option value="std">Std</option>
                          <option value="pro">Pro</option>
                        </select>
                      </label>

                      <label className="slider-label">
                        <span>CFG Scale</span>
                        <div className="slider-control">
                          <input
                            onChange={(event) =>
                              setPlanningSettings((current) => ({
                                ...current,
                                klingCfgScale: parseOptionalNumber(event.target.value)
                              }))
                            }
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={planningSettings.klingCfgScale ?? 0.5}
                          />
                          <strong>{(planningSettings.klingCfgScale ?? 0.5).toFixed(1)}</strong>
                        </div>
                      </label>
                    </div>

                    {!shouldHideCameraControls(planningSettings.klingMode ?? null) ? (
                      <div className="project-settings-grid">
                        <label>
                          <span>Camera Type</span>
                          <select
                            onChange={(event) =>
                              setPlanningSettings((current) => ({
                                ...current,
                                klingCameraControlType:
                                  (event.target.value as ProjectPlanningSettings["klingCameraControlType"]) || null,
                                klingCameraHorizontal:
                                  event.target.value === "simple" ? current.klingCameraHorizontal : null,
                                klingCameraVertical:
                                  event.target.value === "simple" ? current.klingCameraVertical : null,
                                klingCameraPan: event.target.value === "simple" ? current.klingCameraPan : null,
                                klingCameraTilt: event.target.value === "simple" ? current.klingCameraTilt : null,
                                klingCameraRoll: event.target.value === "simple" ? current.klingCameraRoll : null,
                                klingCameraZoom: event.target.value === "simple" ? current.klingCameraZoom : null
                              }))
                            }
                            value={planningSettings.klingCameraControlType ?? ""}
                          >
                            <option value="">None</option>
                            {klingCameraControlTypes.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                            </select>
                          </label>

                          {planningSettings.klingCameraControlType !== "simple" ? (
                            <p className="project-card-caption">
                              Select <strong>Simple</strong> to tune one or more camera axes.
                            </p>
                          ) : null}

                          {planningSettings.klingCameraControlType === "simple" ? (
                            <>
                              <label className="slider-label">
                                <span>Horizontal</span>
                                <div className="slider-control">
                                  <input onChange={(event) => setPlanningSettings((current) => ({ ...current, klingCameraHorizontal: parseOptionalNumber(event.target.value) }))} type="range" min="-10" max="10" step="0.1" value={planningSettings.klingCameraHorizontal ?? 0} />
                                  <strong>{(planningSettings.klingCameraHorizontal ?? 0).toFixed(1)}</strong>
                                </div>
                              </label>
                              <label className="slider-label">
                                <span>Vertical</span>
                                <div className="slider-control">
                                  <input onChange={(event) => setPlanningSettings((current) => ({ ...current, klingCameraVertical: parseOptionalNumber(event.target.value) }))} type="range" min="-10" max="10" step="0.1" value={planningSettings.klingCameraVertical ?? 0} />
                                  <strong>{(planningSettings.klingCameraVertical ?? 0).toFixed(1)}</strong>
                                </div>
                              </label>
                              <label className="slider-label">
                                <span>Pan</span>
                                <div className="slider-control">
                                  <input onChange={(event) => setPlanningSettings((current) => ({ ...current, klingCameraPan: parseOptionalNumber(event.target.value) }))} type="range" min="-10" max="10" step="0.1" value={planningSettings.klingCameraPan ?? 0} />
                                  <strong>{(planningSettings.klingCameraPan ?? 0).toFixed(1)}</strong>
                                </div>
                              </label>
                              <label className="slider-label">
                                <span>Tilt</span>
                                <div className="slider-control">
                                  <input onChange={(event) => setPlanningSettings((current) => ({ ...current, klingCameraTilt: parseOptionalNumber(event.target.value) }))} type="range" min="-10" max="10" step="0.1" value={planningSettings.klingCameraTilt ?? 0} />
                                  <strong>{(planningSettings.klingCameraTilt ?? 0).toFixed(1)}</strong>
                                </div>
                              </label>
                              <label className="slider-label">
                                <span>Roll</span>
                                <div className="slider-control">
                                  <input onChange={(event) => setPlanningSettings((current) => ({ ...current, klingCameraRoll: parseOptionalNumber(event.target.value) }))} type="range" min="-10" max="10" step="0.1" value={planningSettings.klingCameraRoll ?? 0} />
                                  <strong>{(planningSettings.klingCameraRoll ?? 0).toFixed(1)}</strong>
                                </div>
                              </label>
                              <label className="slider-label">
                                <span>Zoom</span>
                                <div className="slider-control">
                                  <input onChange={(event) => setPlanningSettings((current) => ({ ...current, klingCameraZoom: parseOptionalNumber(event.target.value) }))} type="range" min="-10" max="10" step="0.1" value={planningSettings.klingCameraZoom ?? 0} />
                                  <strong>{(planningSettings.klingCameraZoom ?? 0).toFixed(1)}</strong>
                                </div>
                              </label>
                            </>
                          ) : null}
                      </div>
                    ) : (
                      <p className="project-card-caption">
                        Camera control is not available when Kling mode is Pro.
                      </p>
                    )}
                  </div>
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
                          setEditableShotPlan(
                            normalizeShotSequence(
                              normalizeShotPlanDurations(
                              usingManualShotPlan
                                ? savedShotPlan
                                : createDefaultShotPlan(
                                    planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION
                                  ),
                              supportedDurations
                              )
                            )
                          )
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
                            normalizeShotSequence(
                              normalizeShotPlanDurations(
                              normalizeShotSequence(
                                autoShotPlanPreview.map((shot) => ({
                                  ...shot,
                                  negativePrompt: shot.negativePrompt ?? "",
                                  cameraNotes: shot.cameraNotes ?? ""
                                }))
                              ),
                              supportedDurations
                              )
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

                  <div className="story-template-row">
                    <span className="metric-label">Story Templates</span>
                    <div className="toggle-row">
                      <button
                        className="ghost-button"
                        onClick={() =>
                          setEditableShotPlan((current) =>
                            normalizeShotSequence(
                              normalizeShotPlanDurations(
                              applyStoryTemplateWithOptions(
                                planningSettings.narrativeMode ?? "3-beat-story",
                                planningSettings.targetShotCount ?? 3,
                                planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION,
                                !(planningSettings.autoBeatDescriptions ?? true),
                                current
                              ),
                              supportedDurations
                              )
                            )
                          )
                        }
                        type="button"
                      >
                        Apply Current Narrative Mode
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
                                  normalizeShotSequence(current.filter((_, currentIndex) => currentIndex !== index))
                                )
                              }
                              type="button"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <label className="shot-plan-field">
                          <span className="metric-label">Generation Mode</span>
                          <select
                            className="shot-plan-input"
                            onChange={(event) =>
                              setEditableShotPlan((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index
                                    ? {
                                        ...item,
                                        generationMode: event.target.value as "generate" | "extend-previous",
                                        sourceShotNumber:
                                          event.target.value === "extend-previous"
                                            ? item.sourceShotNumber ?? Math.max(index, 1)
                                            : null
                                      }
                                    : item
                                )
                              )
                            }
                            value={shot.generationMode ?? "generate"}
                          >
                            <option value="generate">Generate New Clip</option>
                            <option value="extend-previous" disabled={index === 0}>
                              Extend Previous Clip
                            </option>
                          </select>
                        </label>
                        {shot.generationMode === "extend-previous" ? (
                          <>
                            <label className="shot-plan-field">
                              <span className="metric-label">Source Shot</span>
                              <select
                                className="shot-plan-input"
                                onChange={(event) =>
                                  setEditableShotPlan((current) =>
                                    current.map((item, currentIndex) =>
                                      currentIndex === index
                                        ? { ...item, sourceShotNumber: Number(event.target.value) || null }
                                        : item
                                    )
                                  )
                                }
                                value={String(shot.sourceShotNumber ?? Math.max(index, 1))}
                              >
                                {Array.from({ length: index }, (_, sourceIndex) => sourceIndex + 1).map((sourceShot) => (
                                  <option key={sourceShot} value={sourceShot}>
                                    Shot {sourceShot}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="shot-plan-field">
                              <span className="metric-label">Extend Prompt</span>
                              <textarea
                                className="shot-plan-input"
                                onChange={(event) =>
                                  setEditableShotPlan((current) =>
                                    current.map((item, currentIndex) =>
                                      currentIndex === index ? { ...item, extendPrompt: event.target.value } : item
                                    )
                                  )
                                }
                                placeholder="Describe how this shot should continue from the source clip..."
                                rows={2}
                                value={shot.extendPrompt ?? ""}
                              />
                            </label>
                          </>
                        ) : null}
                        <label className="shot-plan-field">
                          <span className="metric-label">Beat Label</span>
                          <input
                            className="shot-plan-input"
                            onChange={(event) =>
                              setEditableShotPlan((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index ? { ...item, beatLabel: event.target.value } : item
                                )
                              )
                            }
                            placeholder="Intro, Continuation, Climax..."
                            value={shot.beatLabel ?? ""}
                          />
                        </label>
                        <label className="shot-plan-field">
                          <span className="metric-label">Shot Description</span>
                          <textarea
                            className="shot-plan-input"
                            onChange={(event) =>
                              setEditableShotPlan((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index ? { ...item, description: event.target.value } : item
                                )
                              )
                            }
                            placeholder="Describe what should happen in this shot..."
                            rows={3}
                            value={shot.description}
                          />
                        </label>
                        <label className="shot-plan-field">
                          <span className="metric-label">Camera Notes</span>
                          <textarea
                            className="shot-plan-input"
                            onChange={(event) =>
                              setEditableShotPlan((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index ? { ...item, cameraNotes: event.target.value } : item
                                )
                              )
                            }
                            placeholder="dolly in, handheld, low angle..."
                            rows={2}
                            value={shot.cameraNotes ?? ""}
                          />
                        </label>
                        <label className="shot-plan-field">
                          <span className="metric-label">Negative Prompt</span>
                          <textarea
                            className="shot-plan-input"
                            onChange={(event) =>
                              setEditableShotPlan((current) =>
                                current.map((item, currentIndex) =>
                                  currentIndex === index ? { ...item, negativePrompt: event.target.value } : item
                                )
                              )
                            }
                            placeholder="blurry, text, watermark..."
                            rows={2}
                            value={shot.negativePrompt ?? ""}
                          />
                        </label>
                        {shot.generationMode === "generate" ? (
                          <div className="advanced-tab-panel">
                            <div className="advanced-panel-header">
                              <div>
                                <p className="eyebrow">Shot Kling Overrides</p>
                                <p className="project-card-caption">
                                  Optional per-shot overrides for generate-only shots.
                                </p>
                              </div>
                              <button
                                className="ghost-button"
                                onClick={() =>
                                  setEditableShotPlan((current) =>
                                    current.map((item, currentIndex) =>
                                      currentIndex === index ? resetShotKlingOverrides(item) : item
                                    )
                                  )
                                }
                                type="button"
                              >
                                Reset Shot Overrides
                              </button>
                            </div>
                            <div className="project-settings-grid">
                              <label>
                                <span>Kling Mode</span>
                                <select
                                  onChange={(event) =>
                                    setEditableShotPlan((current) =>
                                      current.map((item, currentIndex) =>
                                        currentIndex === index
                                          ? {
                                              ...item,
                                              ...(shouldHideCameraControls(
                                                (event.target.value as ProjectShotPlanItem["klingMode"]) || null
                                              )
                                                ? resetShotKlingOverrides({
                                                    ...item,
                                                    klingMode:
                                                      (event.target.value as ProjectShotPlanItem["klingMode"]) || null
                                                  })
                                                : {
                                                    ...item,
                                                    klingMode:
                                                      (event.target.value as ProjectShotPlanItem["klingMode"]) || null
                                                  })
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  value={shot.klingMode ?? ""}
                                >
                                  <option value="">Project Default</option>
                                  <option value="std">Std</option>
                                  <option value="pro">Pro</option>
                                </select>
                              </label>
                              <label className="slider-label">
                                <span>CFG Scale</span>
                                <div className="slider-control">
                                  <input
                                    onChange={(event) =>
                                      setEditableShotPlan((current) =>
                                        current.map((item, currentIndex) =>
                                          currentIndex === index
                                            ? { ...item, klingCfgScale: parseOptionalNumber(event.target.value) }
                                            : item
                                        )
                                      )
                                    }
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={shot.klingCfgScale ?? 0.5}
                                  />
                                  <strong>{(shot.klingCfgScale ?? 0.5).toFixed(1)}</strong>
                                </div>
                              </label>
                            </div>
                            {!shouldHideCameraControls(shot.klingMode ?? null) ? (
                              <div className="project-settings-grid">
                                <label>
                                  <span>Camera Type</span>
                                  <select
                                    onChange={(event) =>
                                      setEditableShotPlan((current) =>
                                        current.map((item, currentIndex) =>
                                          currentIndex === index
                                            ? {
                                                ...item,
                                                klingCameraControlType:
                                                  (event.target.value as ProjectShotPlanItem["klingCameraControlType"]) || null,
                                                klingCameraHorizontal:
                                                  event.target.value === "simple" ? item.klingCameraHorizontal ?? 0 : null,
                                                klingCameraVertical:
                                                  event.target.value === "simple" ? item.klingCameraVertical ?? 0 : null,
                                                klingCameraPan:
                                                  event.target.value === "simple" ? item.klingCameraPan ?? 0 : null,
                                                klingCameraTilt:
                                                  event.target.value === "simple" ? item.klingCameraTilt ?? 0 : null,
                                                klingCameraRoll:
                                                  event.target.value === "simple" ? item.klingCameraRoll ?? 0 : null,
                                                klingCameraZoom:
                                                  event.target.value === "simple" ? item.klingCameraZoom ?? 0 : null
                                              }
                                            : item
                                        )
                                      )
                                    }
                                    value={shot.klingCameraControlType ?? ""}
                                  >
                                    <option value="">None</option>
                                    {klingCameraControlTypes.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <p className="project-card-caption">{getShotCameraControlNotice(shot)}</p>
                                {shot.klingCameraControlType === "simple" ? (
                                  <>
                                    <label className="slider-label">
                                      <span>Horizontal</span>
                                      <div className="slider-control">
                                        <input onChange={(event) => setEditableShotPlan((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, klingCameraHorizontal: parseOptionalNumber(event.target.value) } : item))} type="range" min="-10" max="10" step="0.1" value={shot.klingCameraHorizontal ?? 0} />
                                        <strong>{(shot.klingCameraHorizontal ?? 0).toFixed(1)}</strong>
                                      </div>
                                    </label>
                                    <label className="slider-label">
                                      <span>Vertical</span>
                                      <div className="slider-control">
                                        <input onChange={(event) => setEditableShotPlan((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, klingCameraVertical: parseOptionalNumber(event.target.value) } : item))} type="range" min="-10" max="10" step="0.1" value={shot.klingCameraVertical ?? 0} />
                                        <strong>{(shot.klingCameraVertical ?? 0).toFixed(1)}</strong>
                                      </div>
                                    </label>
                                    <label className="slider-label">
                                      <span>Pan</span>
                                      <div className="slider-control">
                                        <input onChange={(event) => setEditableShotPlan((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, klingCameraPan: parseOptionalNumber(event.target.value) } : item))} type="range" min="-10" max="10" step="0.1" value={shot.klingCameraPan ?? 0} />
                                        <strong>{(shot.klingCameraPan ?? 0).toFixed(1)}</strong>
                                      </div>
                                    </label>
                                    <label className="slider-label">
                                      <span>Tilt</span>
                                      <div className="slider-control">
                                        <input onChange={(event) => setEditableShotPlan((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, klingCameraTilt: parseOptionalNumber(event.target.value) } : item))} type="range" min="-10" max="10" step="0.1" value={shot.klingCameraTilt ?? 0} />
                                        <strong>{(shot.klingCameraTilt ?? 0).toFixed(1)}</strong>
                                      </div>
                                    </label>
                                    <label className="slider-label">
                                      <span>Roll</span>
                                      <div className="slider-control">
                                        <input onChange={(event) => setEditableShotPlan((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, klingCameraRoll: parseOptionalNumber(event.target.value) } : item))} type="range" min="-10" max="10" step="0.1" value={shot.klingCameraRoll ?? 0} />
                                        <strong>{(shot.klingCameraRoll ?? 0).toFixed(1)}</strong>
                                      </div>
                                    </label>
                                    <label className="slider-label">
                                      <span>Zoom</span>
                                      <div className="slider-control">
                                        <input onChange={(event) => setEditableShotPlan((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, klingCameraZoom: parseOptionalNumber(event.target.value) } : item))} type="range" min="-10" max="10" step="0.1" value={shot.klingCameraZoom ?? 0} />
                                        <strong>{(shot.klingCameraZoom ?? 0).toFixed(1)}</strong>
                                      </div>
                                    </label>
                                  </>
                                ) : null}
                              </div>
                            ) : (
                              <p className="project-card-caption">{getShotCameraControlNotice(shot)}</p>
                            )}
                          </div>
                        ) : null}
                        <label className="shot-plan-duration">
                          <span className="metric-label">Duration Seconds</span>
                          {usesFixedDurationOptions ? (
                            <select
                              onChange={(event) =>
                                setEditableShotPlan((current) =>
                                  current.map((item, currentIndex) =>
                                    currentIndex === index
                                      ? { ...item, durationSeconds: Number(event.target.value) || DEFAULT_BEAT_DURATION }
                                      : item
                                  )
                                )
                              }
                              value={String(getClosestSupportedDuration(shot.durationSeconds, supportedDurations))}
                            >
                              {supportedDurations.map((duration) => (
                                <option key={duration} value={duration}>
                                  {duration}s
                                </option>
                              ))}
                            </select>
                          ) : (
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
                          )}
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
                          normalizeShotSequence([
                            ...current,
                            {
                              shotNumber: current.length + 1,
                              beatLabel: "",
                              description: `New shot ${current.length + 1}`,
                              durationSeconds: planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION,
                              generationMode: current.length === 0 ? "generate" : "extend-previous",
                              sourceShotNumber: current.length === 0 ? null : current.length,
                              extendPrompt:
                                current.length === 0
                                  ? ""
                                  : `Continue the story flow from shot ${current.length}.`,
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
                              <strong>
                                Shot {shot.shotNumber}
                                {shot.beatLabel ? `: ${shot.beatLabel}` : ""}
                              </strong>
                              <span>{shot.description}</span>
                              <span className="timestamp">
                                Mode: {shot.generationMode === "extend-previous" ? `extend shot ${shot.sourceShotNumber ?? "?"}` : "generate"}
                              </span>
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
                              <strong>
                                Shot {shot.shotNumber}
                                {shot.beatLabel ? `: ${shot.beatLabel}` : ""}
                              </strong>
                              <span>{shot.description}</span>
                              <span className="timestamp">
                                Mode: {shot.generationMode === "extend-previous" ? `extend shot ${shot.sourceShotNumber ?? "?"}` : "generate"}
                              </span>
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
                      {featuredJob.status === "processing" || featuredJob.status === "queued" ? (
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
                      {isTerminalStatus(featuredJob.status) ? (
                        <div className="detail-row">
                          <span className="metric-label">Controls</span>
                          <button
                            className="ghost-button"
                            disabled={activeProjectId === selectedProject.id}
                            onClick={() => void handleGenerate(selectedProject.id)}
                            type="button"
                          >
                            {activeProjectId === selectedProject.id ? "Queueing..." : "Regenerate Video"}
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
                    <div className="detail-list">
                      <div className="detail-row">
                        <span className="metric-label">Status</span>
                        <span>Ready to generate</span>
                      </div>
                      <div className="detail-row">
                        <span className="metric-label">Controls</span>
                        <button
                          className="ghost-button"
                          disabled={activeProjectId === selectedProject.id}
                          onClick={() => void handleGenerate(selectedProject.id)}
                          type="button"
                        >
                          {activeProjectId === selectedProject.id ? "Queueing..." : "Generate Video"}
                        </button>
                      </div>
                    </div>
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
                              Shot {shot.shot_number}: {shot.beat_label ?? getShotLabel(shot.shot_number)}
                            </span>
                            <span className={`status-pill status-${shot.status}`}>{formatStatus(shot.status)}</span>
                          </div>
                          <p className="shot-description">{shot.description}</p>
                          <div className="shot-row-foot">
                            <span className="timestamp">{shot.duration_seconds}s</span>
                            <span className="timestamp">{formatProvider(shot.provider)}</span>
                            {shot.generation_mode ? (
                              <span className="timestamp">
                                {shot.generation_mode === "extend-previous"
                                  ? `Extend ${shot.source_shot_number ?? "?"}`
                                  : "Generate"}
                              </span>
                            ) : null}
                            {shot.provider_task_id ? (
                              <span className="timestamp mono-text task-id-text">Task {shot.provider_task_id}</span>
                            ) : null}
                            {shot.asset_url ? (
                              <a className="text-link" href={shot.asset_url} target="_blank" rel="noreferrer">
                                Open Clip
                              </a>
                            ) : null}
                            {shot.stitched_segment_url && shot.stitched_segment_url !== shot.asset_url ? (
                              <a className="text-link" href={shot.stitched_segment_url} target="_blank" rel="noreferrer">
                                Open Stitched Segment
                              </a>
                            ) : null}
                          </div>
                          {shot.error_message ? (
                            <div className="detail-row detail-error shot-error-banner">
                              <span className="metric-label">Shot Error</span>
                              <span>{shot.error_message}</span>
                            </div>
                          ) : null}
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
                            shot.source_provider_output_id ||
                            shot.source_provider_duration_seconds ||
                            shot.provider_request_id ||
                            shot.provider_output_duration_seconds ||
                            shot.stitched_segment_start_seconds ||
                            shot.stitched_segment_duration_seconds ||
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
                            {shot.source_provider_output_id ? (
                              <div className="detail-row">
                                <span className="metric-label">Source Video ID</span>
                                <span className="mono-text task-id-text">{shot.source_provider_output_id}</span>
                              </div>
                            ) : null}
                            {shot.source_provider_duration_seconds ? (
                              <div className="detail-row">
                                <span className="metric-label">Source Duration</span>
                                <span>{shot.source_provider_duration_seconds.toFixed(1)}s</span>
                              </div>
                            ) : null}
                            {shot.provider_output_id ? (
                              <div className="detail-row">
                                <span className="metric-label">Output Video ID</span>
                                <span className="mono-text task-id-text">{shot.provider_output_id}</span>
                              </div>
                            ) : null}
                            {shot.provider_output_duration_seconds ? (
                              <div className="detail-row">
                                <span className="metric-label">Output Duration</span>
                                <span>{shot.provider_output_duration_seconds.toFixed(1)}s</span>
                              </div>
                            ) : null}
                            {shot.stitched_segment_start_seconds !== undefined && shot.stitched_segment_start_seconds !== null ? (
                              <div className="detail-row">
                                <span className="metric-label">Stitch Segment Start</span>
                                <span>{shot.stitched_segment_start_seconds.toFixed(1)}s</span>
                              </div>
                            ) : null}
                            {shot.stitched_segment_duration_seconds !== undefined && shot.stitched_segment_duration_seconds !== null ? (
                              <div className="detail-row">
                                <span className="metric-label">Stitch Segment Length</span>
                                <span>{shot.stitched_segment_duration_seconds.toFixed(1)}s</span>
                              </div>
                            ) : null}
                            {shot.stitched_segment_url && shot.stitched_segment_url !== shot.asset_url ? (
                              <div className="detail-row">
                                <span className="metric-label">Stitched Tail</span>
                                <a className="text-link" href={shot.stitched_segment_url} target="_blank" rel="noreferrer">
                                  Open segment MP4
                                </a>
                              </div>
                            ) : null}
                            {shot.provider_units_consumed ? (
                              <div className="detail-row">
                                <span className="metric-label">Units Consumed</span>
                                <span>{shot.provider_units_consumed}</span>
                              </div>
                            ) : null}
                            {shot.error_message ? (
                              <div className="detail-row detail-error">
                                <span className="metric-label">Provider Error</span>
                                <span>{shot.error_message}</span>
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
