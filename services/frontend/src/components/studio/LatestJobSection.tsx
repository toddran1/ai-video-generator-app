import type { GenerationJob } from "../../types";
import { formatProvider, formatStatus, formatTime, isTerminalStatus } from "../../lib/studio/utils";

export function LatestJobSection({
  featuredJob,
  activeRetryJobId,
  activeProjectId,
  onRetryJob,
  onGenerate,
  projectId
}: {
  featuredJob: GenerationJob | null;
  activeRetryJobId: string | null;
  activeProjectId: string | null;
  onRetryJob: (jobId: string) => void;
  onGenerate: (projectId: string) => void;
  projectId: string;
}) {
  return (
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
                onClick={() => onRetryJob(featuredJob.id)}
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
                disabled={activeProjectId === projectId}
                onClick={() => onGenerate(projectId)}
                type="button"
              >
                {activeProjectId === projectId ? "Queueing..." : "Regenerate Video"}
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
              disabled={activeProjectId === projectId}
              onClick={() => onGenerate(projectId)}
              type="button"
            >
              {activeProjectId === projectId ? "Queueing..." : "Generate Video"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
