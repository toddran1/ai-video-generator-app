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
          <span className="metric-label">Continuity Mode</span>
          <span>{getContinuitySummary(activeShots)}</span>
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
          shots={activeShots.map((shot) => ({
            shotNumber: shot.shotNumber,
            beatLabel: shot.beatLabel,
            generationMode: shot.generationMode,
            sourceShotNumber: shot.sourceShotNumber
          }))}
          title={usingManualShotPlan ? "Saved continuity plan" : "Editor continuity plan"}
        />
      </div>
    </>
  );
}
