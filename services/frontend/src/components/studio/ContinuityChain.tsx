export function ContinuityChain({
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
