import { useEffect } from "react";
import { HeroSection } from "./components/dashboard/HeroSection";
import { FeaturedOutputPanel } from "./components/studio/FeaturedOutputPanel";
import { GenerateConfirmModal } from "./components/studio/GenerateConfirmModal";
import { NewProjectPanel } from "./components/studio/NewProjectPanel";
import { ProjectDetailPanel } from "./components/studio/ProjectDetailPanel";
import { ProjectQueuePanel } from "./components/studio/ProjectQueuePanel";
import { resetKlingFormFields } from "./lib/studio/config";
import { getEstimatedCredits } from "./lib/studio/utils";
import { useStudioDashboard } from "./hooks/useStudioDashboard";

export default function App() {
  const {
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
    videoProviderConfig,
    usesFixedDurationOptions,
    usingManualShotPlan
  } = useStudioDashboard();

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />
      <main className="layout">
        <HeroSection active={stats.active} completed={stats.completed} total={stats.total} />

        <section className="content-grid">
          <NewProjectPanel
            availableModels={videoProviderConfig?.models ?? []}
            defaultModel={videoProviderConfig?.defaultModel ?? formState.klingModel}
            error={error}
            formState={formState}
            isCreating={isCreating}
            onResetKlingControls={() => setFormState((current) => resetKlingFormFields(current))}
            onSubmit={handleCreateProject}
            setFormState={setFormState}
            supportedAspectRatios={supportedAspectRatios}
            supportedDurations={supportedDurations}
            usesFixedDurationOptions={usesFixedDurationOptions}
          />

          <FeaturedOutputPanel featuredJob={featuredJob} featuredShots={featuredShots} selectedProject={selectedProject} />
        </section>

        <section className="detail-grid">
          <ProjectQueuePanel
            activeProjectId={activeProjectId}
            activeRetryJobId={activeRetryJobId}
            isLoading={isLoading}
            onGenerate={(projectId) => void handleGenerate(projectId)}
            onRefreshStatus={(projectId) => void refreshProjectStatus(projectId)}
            onRetryJob={(jobId) => void handleRetryJob(jobId)}
            onSelectProject={setSelectedProjectId}
            projectStatuses={projectStatuses}
            projects={projects}
            selectedProjectId={selectedProject?.id ?? null}
          />

          <ProjectDetailPanel
            activeProjectId={activeProjectId}
            activeRetryJobId={activeRetryJobId}
            activeShotAction={activeShotAction}
            availableModels={videoProviderConfig?.models ?? []}
            autoShotPlanPreview={autoShotPlanPreview}
            defaultModel={videoProviderConfig?.defaultModel ?? formState.klingModel}
            detailTab={detailTab}
            diagnosticJob={diagnosticJob}
            diagnosticJobId={diagnosticJobId}
            diagnosticShots={diagnosticShots}
            draggedShotIndex={draggedShotIndex}
            editableShotPlan={editableShotPlan}
            featuredJob={featuredJob}
            isSavingSettings={isSavingSettings}
            isSavingShotPlan={isSavingShotPlan}
            onCancelShot={(jobId, shotNumber) => void handleCancelShot(jobId, shotNumber)}
            onGenerate={(projectId) => void handleGenerate(projectId)}
            onRetryJob={(jobId) => void handleRetryJob(jobId)}
            onRetryShot={(jobId, shotNumber) => void handleRetryShot(jobId, shotNumber)}
            onSaveProjectSettings={() => void handleSaveProjectSettings()}
            onSaveShotPlan={() => void handleSaveShotPlan()}
            perShotEstimate={perShotEstimate}
            planningSettings={planningSettings}
            projectJobs={projectJobs}
            savedShotPlan={savedShotPlan}
            selectedJobId={selectedJobId}
            selectedProject={selectedProject}
            setDetailTab={setDetailTab}
            setDraggedShotIndex={setDraggedShotIndex}
            setEditableShotPlan={setEditableShotPlan}
            setPlanningSettings={setPlanningSettings}
            setSelectedJobId={setSelectedJobId}
            supportedAspectRatios={supportedAspectRatios}
            supportedDurations={supportedDurations}
            usesFixedDurationOptions={usesFixedDurationOptions}
            usingManualShotPlan={usingManualShotPlan}
          />
        </section>
      </main>

      <GenerateConfirmModal
        estimatedCredits={getEstimatedCredits(savedShotPlan, perShotEstimate)}
        isOpen={Boolean(pendingGenerateProjectId)}
        onCancel={() => setPendingGenerateProjectId(null)}
        onConfirm={() => {
          const projectId = pendingGenerateProjectId;
          setPendingGenerateProjectId(null);
          if (projectId) {
            void startGeneration(projectId);
          }
        }}
      />
    </div>
  );
}
