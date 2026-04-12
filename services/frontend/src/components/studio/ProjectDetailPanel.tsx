import type { Dispatch, SetStateAction } from "react";
import type {
  GenerationJob,
  GenerationJobStatus,
  GenerationShot,
  Project,
  ProjectPlanningSettings,
  ProjectShotPlanItem
} from "../../types";
import { getEstimatedCredits } from "../../lib/studio/utils";
import { DiagnosticsTab } from "./DiagnosticsTab";
import { JobHistorySection } from "./JobHistorySection";
import { LatestJobSection } from "./LatestJobSection";
import { PlanCompareSection } from "./PlanCompareSection";
import { ProjectPlanningControlsSection } from "./ProjectPlanningControlsSection";
import { ShotPlanEditorSection } from "./ShotPlanEditorSection";
import { WorkflowSummarySection } from "./WorkflowSummarySection";
import type { DetailTab } from "../../lib/studio/config";

export function ProjectDetailPanel({
  activeProjectId,
  activeCancelJobId,
  activeRetryJobId,
  activeShotAction,
  availableModels,
  autoShotPlanPreview,
  defaultModel,
  detailTab,
  diagnosticJob,
  diagnosticJobId,
  diagnosticShots,
  draggedShotIndex,
  editableShotPlan,
  featuredJob,
  isSavingSettings,
  isSavingShotPlan,
  onCancelShot,
  onCancelJob,
  onGenerate,
  onRetryJob,
  onRetryShot,
  onSaveProjectSettings,
  onSaveShotPlan,
  perShotEstimate,
  planningSettings,
  projectJobs,
  savedShotPlan,
  selectedJobId,
  selectedProject,
  setDetailTab,
  setDraggedShotIndex,
  setEditableShotPlan,
  setPlanningSettings,
  setSelectedJobId,
  supportedAspectRatios,
  supportedDurations,
  usesFixedDurationOptions,
  usingManualShotPlan
}: {
  activeProjectId: string | null;
  activeCancelJobId: string | null;
  activeRetryJobId: string | null;
  activeShotAction: string | null;
  availableModels: Array<{ id: string; label: string; supportsCameraControl: boolean; estimatedUnitsPerShot: number }>;
  autoShotPlanPreview: ProjectShotPlanItem[];
  defaultModel: string;
  detailTab: DetailTab;
  diagnosticJob: GenerationJobStatus | null;
  diagnosticJobId: string | null;
  diagnosticShots: GenerationShot[];
  draggedShotIndex: number | null;
  editableShotPlan: ProjectShotPlanItem[];
  featuredJob: GenerationJob | null;
  isSavingSettings: boolean;
  isSavingShotPlan: boolean;
  onCancelShot: (jobId: string, shotNumber: number) => void;
  onCancelJob: (jobId: string) => void;
  onGenerate: (projectId: string) => void;
  onRetryJob: (jobId: string) => void;
  onRetryShot: (jobId: string, shotNumber: number) => void;
  onSaveProjectSettings: () => void;
  onSaveShotPlan: () => void;
  perShotEstimate: number;
  planningSettings: ProjectPlanningSettings;
  projectJobs: GenerationJob[];
  savedShotPlan: ProjectShotPlanItem[];
  selectedJobId: string | null;
  selectedProject: Project | null;
  setDetailTab: Dispatch<SetStateAction<DetailTab>>;
  setDraggedShotIndex: Dispatch<SetStateAction<number | null>>;
  setEditableShotPlan: Dispatch<SetStateAction<ProjectShotPlanItem[]>>;
  setPlanningSettings: Dispatch<SetStateAction<ProjectPlanningSettings>>;
  setSelectedJobId: Dispatch<SetStateAction<string | null>>;
  supportedAspectRatios: Array<"16:9" | "9:16" | "1:1">;
  supportedDurations: number[];
  usesFixedDurationOptions: boolean;
  usingManualShotPlan: boolean;
}) {
  const effectiveShotCount =
    editableShotPlan.length > 0
      ? editableShotPlan.length
      : savedShotPlan.length > 0
        ? savedShotPlan.length
        : selectedProject?.target_shot_count ?? 1;
  const isSingleClipProject = effectiveShotCount <= 1;

  return (
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
              <WorkflowSummarySection
                editableShotPlan={editableShotPlan}
                estimatedCredits={getEstimatedCredits(usingManualShotPlan ? savedShotPlan : editableShotPlan, perShotEstimate)}
                featuredJob={featuredJob}
                savedShotPlan={savedShotPlan}
                selectedProject={selectedProject}
                usingManualShotPlan={usingManualShotPlan}
              />

              <ProjectPlanningControlsSection
                availableModels={availableModels}
                defaultModel={defaultModel}
                isSavingSettings={isSavingSettings}
                onSaveProjectSettings={onSaveProjectSettings}
                planningSettings={planningSettings}
                setPlanningSettings={setPlanningSettings}
                supportedAspectRatios={supportedAspectRatios}
                supportedDurations={supportedDurations}
                usesFixedDurationOptions={usesFixedDurationOptions}
              />

              <ShotPlanEditorSection
                autoShotPlanPreview={autoShotPlanPreview}
                draggedShotIndex={draggedShotIndex}
                editableShotPlan={editableShotPlan}
                isSavingShotPlan={isSavingShotPlan}
                onSaveShotPlan={onSaveShotPlan}
                perShotEstimate={perShotEstimate}
                planningSettings={planningSettings}
                savedShotPlan={savedShotPlan}
                setDraggedShotIndex={setDraggedShotIndex}
                setEditableShotPlan={setEditableShotPlan}
                setPlanningSettings={setPlanningSettings}
                supportedDurations={supportedDurations}
                usesFixedDurationOptions={usesFixedDurationOptions}
                usingManualShotPlan={usingManualShotPlan}
              />

              {!isSingleClipProject ? (
                <PlanCompareSection
                  autoShotPlanPreview={autoShotPlanPreview}
                  savedShotPlan={savedShotPlan}
                  usingManualShotPlan={usingManualShotPlan}
                />
              ) : null}

              <LatestJobSection
                activeCancelJobId={activeCancelJobId}
                activeProjectId={activeProjectId}
                activeRetryJobId={activeRetryJobId}
                featuredJob={featuredJob}
                onCancelJob={onCancelJob}
                onGenerate={onGenerate}
                onRetryJob={onRetryJob}
                projectId={selectedProject.id}
              />

              <JobHistorySection
                projectJobs={projectJobs}
                selectedJobId={selectedJobId}
                setSelectedJobId={setSelectedJobId}
              />
            </>
          ) : null}

          {detailTab === "diagnostics" ? (
            <DiagnosticsTab
              activeShotAction={activeShotAction}
              diagnosticJob={diagnosticJob}
              diagnosticJobId={diagnosticJobId}
              diagnosticShots={diagnosticShots}
              onCancelShot={onCancelShot}
              onRetryShot={onRetryShot}
              selectedJobId={selectedJobId}
            />
          ) : null}
        </div>
      ) : (
        <div className="empty-state">Select a project card to inspect its latest job and shots.</div>
      )}
    </section>
  );
}
