import { FormEvent, useEffect, useRef, useState } from "react";
import {
  cancelGenerationShot,
  createProject,
  generateProject,
  getGenerationJob,
  getProjectAutoShotPlan,
  getProjectGenerationStatus,
  getProjectShotPlan,
  getVideoProviderConfig,
  listProjects,
  retryGenerationJob,
  retryGenerationShot,
  updateProjectSettings,
  updateProjectShotPlan
} from "../api";
import type {
  GenerationJob,
  GenerationJobStatus,
  GenerationShot,
  Project,
  ProjectGenerationStatus,
  ProjectPlanningSettings,
  ProjectShotPlanItem,
  VideoProviderConfig
} from "../types";
import {
  DEFAULT_BEAT_DURATION,
  createDefaultShotPlan,
  initialFormState,
  type DetailTab,
  type ProjectFormState,
  terminalStatuses
} from "../lib/studio/config";
import {
  getClosestSupportedDuration,
  getEstimatedCredits,
  getLatestJob,
  getLatestShots,
  getPerShotEstimatedCredits,
  getProjectStats,
  isKlingCameraControlType,
  isKlingMode,
  modelSupportsCameraControls,
  normalizeShotPlanDurations,
  normalizeShotSequence,
  parseOptionalNumber
} from "../lib/studio/utils";

function mapProjectToPlanningSettings(project: Project): ProjectPlanningSettings {
  return {
    prompt: project.prompt,
    targetShotCount: project.target_shot_count ?? 1,
    defaultBeatDuration: project.default_beat_duration ?? DEFAULT_BEAT_DURATION,
    aspectRatio: (project.aspect_ratio as "16:9" | "9:16" | "1:1" | null) ?? "16:9",
    styleHint: project.style_hint ?? "",
    negativePrompt: project.negative_prompt ?? "",
    cameraNotes: project.camera_notes ?? "",
    narrativeMode:
      (project.narrative_mode as
        | "3-beat-story"
        | "5-beat-story"
        | "fight-scene"
        | "dialogue-scene"
        | "reveal-arc"
        | null) ?? "3-beat-story",
    autoBeatDescriptions: project.auto_beat_descriptions ?? true,
    klingModel: project.kling_model ?? initialFormState.klingModel,
    klingMode: isKlingMode(project.kling_mode) ? project.kling_mode : null,
    klingCfgScale: project.kling_cfg_scale ?? null,
    klingCameraControlType: isKlingCameraControlType(project.kling_camera_control_type)
      ? project.kling_camera_control_type
      : null,
    klingCameraHorizontal: project.kling_camera_horizontal ?? null,
    klingCameraVertical: project.kling_camera_vertical ?? null,
    klingCameraPan: project.kling_camera_pan ?? null,
    klingCameraTilt: project.kling_camera_tilt ?? null,
    klingCameraRoll: project.kling_camera_roll ?? null,
    klingCameraZoom: project.kling_camera_zoom ?? null
  };
}

function buildKlingCameraControlPayload(args: {
  model: string | null | undefined;
  mode: "std" | "pro" | null | undefined;
  durationSeconds: number;
  type: string | null | undefined;
  horizontal?: number | null;
  vertical?: number | null;
  pan?: number | null;
  tilt?: number | null;
  roll?: number | null;
  zoom?: number | null;
}) {
  const { model, mode, durationSeconds, type } = args;
  const supportedTypes = new Set(["simple", "down_back", "forward_up", "right_turn_forward", "left_turn_forward"]);

  if (!type || !supportedTypes.has(type)) {
    return undefined;
  }

  if (!modelSupportsCameraControls(model) || mode === "pro" || durationSeconds !== 5) {
    return undefined;
  }

  if (type !== "simple") {
    return { type };
  }

  const strongestEntry = (
    [
      ["horizontal", args.horizontal],
      ["vertical", args.vertical],
      ["pan", args.pan],
      ["tilt", args.tilt],
      ["roll", args.roll],
      ["zoom", args.zoom]
    ] as const
  )
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value !== 0)
    .sort(([, left], [, right]) => Math.abs((right as number) ?? 0) - Math.abs((left as number) ?? 0))[0];

  if (!strongestEntry) {
    return undefined;
  }

  const [axis, value] = strongestEntry;
  return {
    type: "simple",
    config: {
      [axis]: value
    }
  };
}

function buildGenerationConsolePreview(args: {
  action: "generate" | "retry-job" | "retry-shot";
  project: Project | null;
  selectedProjectId: string | null;
  savedShotPlan: ProjectShotPlanItem[];
  projectStatus?: ProjectGenerationStatus;
  jobDiagnostics?: GenerationJobStatus;
  shotNumber?: number;
  defaultModel: string;
}) {
  const {
    action,
    project,
    selectedProjectId,
    savedShotPlan,
    projectStatus,
    jobDiagnostics,
    shotNumber,
    defaultModel
  } = args;

  const manualPlan =
    project && selectedProjectId === project.id && savedShotPlan.length > 0
      ? savedShotPlan.map((shot) => ({
          shotNumber: shot.shotNumber,
          beatLabel: shot.beatLabel ?? "",
          description: shot.description,
          durationSeconds: shot.durationSeconds,
          generationMode: shot.generationMode ?? "generate",
          sourceShotNumber: shot.sourceShotNumber ?? null,
          extendPrompt: shot.extendPrompt ?? "",
          negativePrompt: shot.negativePrompt ?? "",
          cameraNotes: shot.cameraNotes ?? "",
          klingMode: shot.klingMode ?? null,
          klingCfgScale: shot.klingCfgScale ?? null,
          klingCameraControlType: shot.klingCameraControlType ?? null,
          klingCameraHorizontal: shot.klingCameraHorizontal ?? null,
          klingCameraVertical: shot.klingCameraVertical ?? null,
          klingCameraPan: shot.klingCameraPan ?? null,
          klingCameraTilt: shot.klingCameraTilt ?? null,
          klingCameraRoll: shot.klingCameraRoll ?? null,
          klingCameraZoom: shot.klingCameraZoom ?? null
        }))
      : null;

  const projectRecord = project ?? projectStatus?.project ?? null;
  const normalizedManualPlan = manualPlan ? normalizeShotSequence(manualPlan) : null;
  const fallbackPlan =
    !normalizedManualPlan && projectRecord
      ? createDefaultShotPlan(projectRecord.default_beat_duration ?? DEFAULT_BEAT_DURATION, projectRecord.target_shot_count ?? 1, {
          negativePrompt: projectRecord.negative_prompt ?? "",
          cameraNotes: projectRecord.camera_notes ?? ""
        })
      : null;

  const latestShots =
    jobDiagnostics?.shots.map((shot) => ({
      shotNumber: shot.shot_number,
      description: shot.description,
      durationSeconds: shot.duration_seconds,
      generationMode: (shot.generation_mode as "generate" | "extend-previous" | null) ?? "generate",
      sourceShotNumber: shot.source_shot_number ?? null,
      extendPrompt: shot.extend_prompt ?? "",
      negativePrompt: shot.negative_prompt ?? "",
      cameraNotes: shot.camera_notes ?? "",
      klingMode: isKlingMode(shot.kling_mode) ? shot.kling_mode : null,
      klingCfgScale: shot.kling_cfg_scale ?? null,
      klingCameraControlType: isKlingCameraControlType(shot.kling_camera_control_type) ? shot.kling_camera_control_type : null,
      klingCameraHorizontal: shot.kling_camera_horizontal ?? null,
      klingCameraVertical: shot.kling_camera_vertical ?? null,
      klingCameraPan: shot.kling_camera_pan ?? null,
      klingCameraTilt: shot.kling_camera_tilt ?? null,
      klingCameraRoll: shot.kling_camera_roll ?? null,
      klingCameraZoom: shot.kling_camera_zoom ?? null
    })) ?? [];

  const planShots =
    action === "generate"
      ? normalizedManualPlan ?? fallbackPlan ?? []
      : latestShots.filter((shot) => (action === "retry-shot" ? shot.shotNumber >= (shotNumber ?? 1) : true));

  const effectiveModel = projectRecord?.kling_model ?? defaultModel;
  const effectiveAspectRatio = projectRecord?.aspect_ratio ?? "16:9";
  const effectiveProjectMode = isKlingMode(projectRecord?.kling_mode) ? projectRecord?.kling_mode : null;

  return planShots.map((shot) => {
    if (shot.generationMode === "extend-previous") {
      return {
        endpoint: "POST /v1/videos/video-extend",
        shotNumber: shot.shotNumber,
        payload: {
          video_id: `source-video-from-shot-${shot.sourceShotNumber ?? shot.shotNumber - 1}`,
          prompt: shot.extendPrompt ?? ""
        }
      };
    }

    const effectiveMode = shot.klingMode ?? effectiveProjectMode;
    const cameraControl = buildKlingCameraControlPayload({
      model: effectiveModel,
      mode: effectiveMode,
      durationSeconds: shot.durationSeconds,
      type: shot.klingCameraControlType ?? (isKlingCameraControlType(projectRecord?.kling_camera_control_type) ? projectRecord?.kling_camera_control_type : null),
      horizontal: shot.klingCameraHorizontal ?? projectRecord?.kling_camera_horizontal ?? null,
      vertical: shot.klingCameraVertical ?? projectRecord?.kling_camera_vertical ?? null,
      pan: shot.klingCameraPan ?? projectRecord?.kling_camera_pan ?? null,
      tilt: shot.klingCameraTilt ?? projectRecord?.kling_camera_tilt ?? null,
      roll: shot.klingCameraRoll ?? projectRecord?.kling_camera_roll ?? null,
      zoom: shot.klingCameraZoom ?? projectRecord?.kling_camera_zoom ?? null
    });

    return {
      endpoint: "POST /v1/videos/text2video",
      shotNumber: shot.shotNumber,
      payload: {
        model: effectiveModel,
        prompt: shot.description,
        duration: shot.durationSeconds,
        aspect_ratio: effectiveAspectRatio,
        ...(shot.negativePrompt || projectRecord?.negative_prompt
          ? { negative_prompt: shot.negativePrompt || projectRecord?.negative_prompt || "" }
          : {}),
        ...(effectiveMode ? { mode: effectiveMode } : {}),
        ...(typeof (shot.klingCfgScale ?? projectRecord?.kling_cfg_scale) === "number"
          ? { cfg_scale: shot.klingCfgScale ?? projectRecord?.kling_cfg_scale }
          : {}),
        ...(cameraControl ? { camera_control: cameraControl } : {})
      }
    };
  });
}

function logGenerationConsolePreview(preview: ReturnType<typeof buildGenerationConsolePreview>) {
  console.groupCollapsed("[kling][browser] payload preview");
  console.log(preview);
  console.groupEnd();
}

export function useStudioDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<Record<string, ProjectGenerationStatus>>({});
  const [jobDiagnostics, setJobDiagnostics] = useState<Record<string, GenerationJobStatus>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [editableShotPlan, setEditableShotPlan] = useState<ProjectShotPlanItem[]>(
    createDefaultShotPlan(DEFAULT_BEAT_DURATION, 1, {
      negativePrompt: "",
      cameraNotes: ""
    })
  );
  const [savedShotPlan, setSavedShotPlan] = useState<ProjectShotPlanItem[]>([]);
  const [autoShotPlanPreview, setAutoShotPlanPreview] = useState<ProjectShotPlanItem[]>([]);
  const [videoProviderConfig, setVideoProviderConfig] = useState<VideoProviderConfig | null>(null);
  const [formState, setFormState] = useState<ProjectFormState>(initialFormState);
  const [planningSettings, setPlanningSettings] = useState<ProjectPlanningSettings>({
    prompt: "",
    targetShotCount: 1,
    defaultBeatDuration: DEFAULT_BEAT_DURATION,
    aspectRatio: "16:9",
    styleHint: "",
    negativePrompt: "",
    cameraNotes: "",
    narrativeMode: "3-beat-story",
    autoBeatDescriptions: true,
    klingModel: initialFormState.klingModel,
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
  const [detailTab, setDetailTab] = useState<DetailTab>("workflow");
  const [isSavingShotPlan, setIsSavingShotPlan] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [pendingGenerateProjectId, setPendingGenerateProjectId] = useState<string | null>(null);
  const [draggedShotIndex, setDraggedShotIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSyncedPlanningProjectRef = useRef<string | null>(null);

  const supportedDurations = videoProviderConfig?.durations ?? [];
  const defaultModel = videoProviderConfig?.defaultModel ?? initialFormState.klingModel;
  const availableModels = videoProviderConfig?.models ?? [];
  const getModelEstimate = (modelId: string | null | undefined) =>
    availableModels.find((model) => model.id === modelId)?.estimatedUnitsPerShot ?? 1;
  const supportedAspectRatios =
    videoProviderConfig?.aspectRatios.filter(
      (value): value is "16:9" | "9:16" | "1:1" => value === "16:9" || value === "9:16" || value === "1:1"
    ) ?? ["16:9", "9:16", "1:1"];
  const usesFixedDurationOptions = supportedDurations.length > 0;

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
            generation_profile: "selected-model",
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

  function optimisticUpdateJobDiagnostics(
    jobId: string,
    updates: Partial<GenerationJob>,
    shotUpdater?: (shots: GenerationShot[]) => GenerationShot[]
  ) {
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
          normalizeShotPlanDurations(
            shots.length > 0
              ? shots
              : createDefaultShotPlan(
                  projects.find((project) => project.id === projectId)?.default_beat_duration ?? DEFAULT_BEAT_DURATION,
                  projects.find((project) => project.id === projectId)?.target_shot_count ?? 1,
                  {
                    negativePrompt: projects.find((project) => project.id === projectId)?.negative_prompt ?? "",
                    cameraNotes: projects.find((project) => project.id === projectId)?.camera_notes ?? ""
                  }
                ),
            supportedDurations
          )
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
      setEditableShotPlan(
        createDefaultShotPlan(DEFAULT_BEAT_DURATION, 1, {
          negativePrompt: "",
          cameraNotes: ""
        })
      );
      setAutoShotPlanPreview([]);
      setSelectedJobId(null);
      lastSyncedPlanningProjectRef.current = null;
      return;
    }

    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    if (selectedProject) {
      const syncKey = `${selectedProject.id}:${selectedProject.updated_at}`;

      if (lastSyncedPlanningProjectRef.current === syncKey) {
        return;
      }

      setPlanningSettings(mapProjectToPlanningSettings(selectedProject));
      lastSyncedPlanningProjectRef.current = syncKey;
    }
  }, [projects, selectedProjectId]);

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
  }, [projects, selectedJobId]);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      const response = await createProject({
        ...formState,
        klingModel: formState.klingModel || defaultModel,
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
      setPlanningSettings(mapProjectToPlanningSettings(response.data));
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
        prompt: planningSettings.prompt ?? "",
        targetShotCount: planningSettings.targetShotCount ?? 1,
        defaultBeatDuration: planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION,
        aspectRatio: planningSettings.aspectRatio ?? "16:9",
        styleHint: planningSettings.styleHint ?? "",
        negativePrompt: planningSettings.negativePrompt ?? "",
        cameraNotes: planningSettings.cameraNotes ?? "",
        narrativeMode: planningSettings.narrativeMode ?? "3-beat-story",
        autoBeatDescriptions: planningSettings.autoBeatDescriptions ?? true,
        klingModel: planningSettings.klingModel ?? defaultModel,
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
      const project = projects.find((currentProject) => currentProject.id === projectId) ?? null;
      logGenerationConsolePreview(
        buildGenerationConsolePreview({
          action: "generate",
          project,
          selectedProjectId,
          savedShotPlan,
          projectStatus: projectStatuses[projectId],
          defaultModel
        })
      );
      const providerModel = project?.kling_model ?? defaultModel;
      const response = await generateProject(projectId);
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
          generation_profile: "selected-model",
          planner_provider: "pending",
          video_provider: undefined,
          provider_model: providerModel,
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
            generation_profile: "selected-model",
            planner_provider: "pending",
            video_provider: undefined,
            metadata_url: null,
            provider_model: providerModel,
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
      const diagnostics = jobDiagnostics[jobId];
      const project = diagnostics ? projects.find((currentProject) => currentProject.id === diagnostics.job.project_id) ?? null : null;
      logGenerationConsolePreview(
        buildGenerationConsolePreview({
          action: "retry-job",
          project,
          selectedProjectId,
          savedShotPlan,
          projectStatus: diagnostics ? projectStatuses[diagnostics.job.project_id] : undefined,
          jobDiagnostics: diagnostics,
          defaultModel
        })
      );
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
      const diagnostics = jobDiagnostics[jobId];
      const project = diagnostics ? projects.find((currentProject) => currentProject.id === diagnostics.job.project_id) ?? null : null;
      logGenerationConsolePreview(
        buildGenerationConsolePreview({
          action: "retry-shot",
          project,
          selectedProjectId,
          savedShotPlan,
          projectStatus: diagnostics ? projectStatuses[diagnostics.job.project_id] : undefined,
          jobDiagnostics: diagnostics,
          shotNumber,
          defaultModel
        })
      );
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
  const activeModel = selectedProject?.kling_model ?? planningSettings.klingModel ?? formState.klingModel ?? defaultModel;
  const perShotEstimate = getPerShotEstimatedCredits(getModelEstimate(activeModel));

  return {
    activeProjectId,
    activeRetryJobId,
    activeShotAction,
    autoShotPlanPreview,
    detailTab,
    diagnosticJob,
    diagnosticJobId,
    diagnosticShots,
    draggedShotIndex,
    editableShotPlan,
    error,
    featuredJob,
    featuredShots,
    formState,
    handleCancelShot,
    handleCreateProject,
    handleGenerate,
    handleRetryJob,
    handleRetryShot,
    handleSaveProjectSettings,
    handleSaveShotPlan,
    isCreating,
    isLoading,
    isSavingSettings,
    isSavingShotPlan,
    pendingGenerateProjectId,
    perShotEstimate,
    planningSettings,
    projectJobs,
    projectStatuses,
    projects,
    refreshProjectStatus,
    savedShotPlan,
    selectedJobId,
    selectedProject,
    setDetailTab,
    setDraggedShotIndex,
    setEditableShotPlan,
    setFormState,
    setPendingGenerateProjectId,
    setPlanningSettings,
    setSelectedJobId,
    setSelectedProjectId,
    startGeneration,
    stats,
    supportedAspectRatios,
    supportedDurations,
    usesFixedDurationOptions,
    usingManualShotPlan,
    videoProviderConfig
  };
}
