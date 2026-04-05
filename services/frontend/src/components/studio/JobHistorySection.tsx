import { formatProvider, formatStatus, formatTime } from "../../lib/studio/utils";
import type { GenerationJob } from "../../types";

export function JobHistorySection({
  projectJobs,
  selectedJobId,
  setSelectedJobId
}: {
  projectJobs: GenerationJob[];
  selectedJobId: string | null;
  setSelectedJobId: (jobId: string) => void;
}) {
  return (
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
  );
}
