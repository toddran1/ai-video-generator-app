import { getShotPlanSummary } from "../../lib/studio/utils";
import type { ProjectShotPlanItem } from "../../types";

export function PlanCompareSection({
  usingManualShotPlan,
  savedShotPlan,
  autoShotPlanPreview
}: {
  usingManualShotPlan: boolean;
  savedShotPlan: ProjectShotPlanItem[];
  autoShotPlanPreview: ProjectShotPlanItem[];
}) {
  return (
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
                  {shot.negativePrompt ? <span className="timestamp">Negative: {shot.negativePrompt}</span> : null}
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
  );
}
