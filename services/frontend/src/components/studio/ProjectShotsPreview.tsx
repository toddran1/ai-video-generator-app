import type { GenerationShot } from "../../types";
import { getShotStatusSummary } from "../../lib/studio/utils";

export function ProjectShotsPreview({ shots }: { shots: GenerationShot[] }) {
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
