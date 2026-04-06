import { ContinuityChain } from "./ContinuityChain";
import { formatProvider, formatStatus, getContinuitySummary, getShotPlanSummary } from "../../lib/studio/utils";
import type { GenerationJob, Project, ProjectShotPlanItem } from "../../types";

export function WorkflowSummarySection({
  selectedProject,
  featuredJob,
  usingManualShotPlan,
  savedShotPlan,
  editableShotPlan,
  estimatedCredits
}: {
  selectedProject: Project;
  featuredJob: GenerationJob | null;
  usingManualShotPlan: boolean;
  savedShotPlan: ProjectShotPlanItem[];
  editableShotPlan: ProjectShotPlanItem[];
  estimatedCredits: number;
}) {
  const activeShots = usingManualShotPlan ? savedShotPlan : editableShotPlan;
  const effectiveShotCount = activeShots.length > 0 ? activeShots.length : selectedProject.target_shot_count ?? 1;
  const isSingleClip = effectiveShotCount <= 1;
  const isNarrativeProject = effectiveShotCount > 2;
  const sectionTitle = isSingleClip ? "Clip Structure" : "Continuity Chain";
  const sectionHeading = isSingleClip ? "How this project is configured" : "How shots connect across the sequence";
  const continuityTitle = isSingleClip
    ? usingManualShotPlan
      ? "Saved single clip plan"
      : "Editor single clip plan"
    : usingManualShotPlan
      ? "Saved continuity plan"
      : "Editor continuity plan";
  const continuityEmptyMessage = isSingleClip
    ? "This project starts as a single clip. Save or generate a shot plan to visualize structure."
    : "Save or generate a shot plan to visualize continuity.";

  return (
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
            ~{estimatedCredits} unit{estimatedCredits === 1 ? "" : "s"} for the selected model
          </span>
        </div>
        <div className="detail-row">
          <span className="metric-label">Kling Model</span>
          <span>{selectedProject.kling_model ?? featuredJob?.provider_model ?? "Default"}</span>
        </div>
        <div className="detail-row">
          <span className="metric-label">{isNarrativeProject ? "Story Mode" : isSingleClip ? "Clip Mode" : "Sequence Mode"}</span>
          <span>{getContinuitySummary(activeShots)}</span>
        </div>
      </div>

      <div className="detail-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">{sectionTitle}</p>
            <h3>{sectionHeading}</h3>
          </div>
        </div>

        {isSingleClip ? (
          <div className="detail-row">
            <span className="metric-label">{continuityTitle}</span>
            <span>{activeShots[0]?.generationMode === "extend-previous" ? "Clip extends an earlier shot" : "Single generated clip"}</span>
          </div>
        ) : (
          <ContinuityChain
            emptyMessage={continuityEmptyMessage}
            shots={activeShots.map((shot) => ({
              shotNumber: shot.shotNumber,
              beatLabel: shot.beatLabel,
              generationMode: shot.generationMode,
              sourceShotNumber: shot.sourceShotNumber
            }))}
            title={continuityTitle}
          />
        )}
      </div>
    </>
  );
}
