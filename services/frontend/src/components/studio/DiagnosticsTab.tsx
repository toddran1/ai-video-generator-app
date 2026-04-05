import type { GenerationJobStatus, GenerationShot } from "../../types";
import { formatJsonPayload, formatProvider, formatStatus, getShotLabel, getShotProgress } from "../../lib/studio/utils";

export function DiagnosticsTab({
  diagnosticJob,
  diagnosticShots,
  diagnosticJobId,
  activeShotAction,
  onRetryShot,
  onCancelShot,
  selectedJobId
}: {
  diagnosticJob: GenerationJobStatus | null;
  diagnosticShots: GenerationShot[];
  diagnosticJobId: string | null;
  activeShotAction: string | null;
  onRetryShot: (jobId: string, shotNumber: number) => void;
  onCancelShot: (jobId: string, shotNumber: number) => void;
  selectedJobId: string | null;
}) {
  return (
    <>
      <div className="detail-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Provider Diagnostics</p>
            <h3>{selectedJobId ? "Selected job details" : "No job selected"}</h3>
          </div>
        </div>

        {diagnosticJob ? (
          <div className="detail-list">
            <div className="detail-row">
              <span className="metric-label">Job ID</span>
              <span className="mono-text task-id-text">{diagnosticJob.job.id}</span>
            </div>
            <div className="detail-row">
              <span className="metric-label">Status</span>
              <span>{formatStatus(diagnosticJob.job.status)}</span>
            </div>
            <div className="detail-row">
              <span className="metric-label">Planner</span>
              <span>{formatProvider(diagnosticJob.job.planner_provider)}</span>
            </div>
            <div className="detail-row">
              <span className="metric-label">Video Provider</span>
              <span>{diagnosticJob.job.video_provider ? formatProvider(diagnosticJob.job.video_provider) : "Pending"}</span>
            </div>
            <div className="detail-row">
              <span className="metric-label">Model</span>
              <span className="mono-text task-id-text">{diagnosticJob.job.provider_model ?? "Pending"}</span>
            </div>
            {diagnosticJob.job.output_url ? (
              <div className="detail-row">
                <span className="metric-label">Final Output</span>
                <a className="text-link" href={diagnosticJob.job.output_url} target="_blank" rel="noreferrer">
                  Open final MP4
                </a>
              </div>
            ) : null}
            {diagnosticJob.job.metadata_url ? (
              <div className="detail-row">
                <span className="metric-label">Metadata Archive</span>
                <a className="text-link" href={diagnosticJob.job.metadata_url} target="_blank" rel="noreferrer">
                  Download JSON
                </a>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-state">Select a job to inspect its provider diagnostics.</div>
        )}
      </div>

      <div className="detail-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Shot Timeline</p>
            <h3>{getShotProgress(diagnosticShots)}</h3>
          </div>
        </div>

        {diagnosticShots.length > 0 && diagnosticJobId ? (
          <div className="shot-timeline">
            {diagnosticShots.map((shot) => (
              <div className="shot-row" key={shot.id}>
                <div className="shot-row-head">
                  <span className="shot-index">
                    Shot {shot.shot_number}: {shot.beat_label ?? getShotLabel(shot.shot_number)}
                  </span>
                  <span className={`status-pill status-${shot.status}`}>{formatStatus(shot.status)}</span>
                </div>
                <p className="shot-description">{shot.description}</p>
                <div className="shot-row-foot">
                  <span className="timestamp">{shot.duration_seconds}s</span>
                  <span className="timestamp">{formatProvider(shot.provider)}</span>
                  {shot.generation_mode ? (
                    <span className="timestamp">
                      {shot.generation_mode === "extend-previous" ? `Extend ${shot.source_shot_number ?? "?"}` : "Generate"}
                    </span>
                  ) : null}
                  {shot.provider_task_id ? (
                    <span className="timestamp mono-text task-id-text">Task {shot.provider_task_id}</span>
                  ) : null}
                  {shot.asset_url ? (
                    <a className="text-link" href={shot.asset_url} target="_blank" rel="noreferrer">
                      {shot.generation_mode === "extend-previous" ? "Open Full Extended Clip" : "Open Clip"}
                    </a>
                  ) : null}
                  {shot.stitched_segment_url && shot.stitched_segment_url !== shot.asset_url ? (
                    <a className="text-link" href={shot.stitched_segment_url} target="_blank" rel="noreferrer">
                      Open Continuation Segment
                    </a>
                  ) : null}
                </div>
                {shot.error_message ? (
                  <div className="detail-row detail-error shot-error-banner">
                    <span className="metric-label">Shot Error</span>
                    <span>{shot.error_message}</span>
                  </div>
                ) : null}
                <div className="shot-action-row">
                  {shot.status === "failed" || shot.status === "canceled" ? (
                    <button
                      className="ghost-button"
                      disabled={activeShotAction === `${diagnosticJobId}:${shot.shot_number}:retry`}
                      onClick={() => onRetryShot(diagnosticJobId, shot.shot_number)}
                      type="button"
                    >
                      {activeShotAction === `${diagnosticJobId}:${shot.shot_number}:retry` ? "Retrying..." : "Retry From This Shot"}
                    </button>
                  ) : null}
                  {shot.status === "generating" ? (
                    <button
                      className="ghost-button"
                      disabled={activeShotAction === `${diagnosticJobId}:${shot.shot_number}:cancel`}
                      onClick={() => onCancelShot(diagnosticJobId, shot.shot_number)}
                      type="button"
                    >
                      {activeShotAction === `${diagnosticJobId}:${shot.shot_number}:cancel` ? "Canceling..." : "Cancel Shot"}
                    </button>
                  ) : null}
                </div>
                {shot.provider_task_id ||
                shot.source_provider_output_id ||
                shot.source_provider_duration_seconds ||
                shot.provider_request_id ||
                shot.provider_output_duration_seconds ||
                shot.stitched_segment_start_seconds ||
                shot.stitched_segment_duration_seconds ||
                shot.provider_units_consumed ||
                shot.provider_request_payload ||
                shot.provider_terminal_payload ? (
                  <div className="provider-meta-card">
                    {shot.provider_task_id ? (
                      <div className="detail-row">
                        <span className="metric-label">Provider Task ID</span>
                        <span className="mono-text task-id-text">{shot.provider_task_id}</span>
                      </div>
                    ) : null}
                    {shot.provider_request_id ? (
                      <div className="detail-row">
                        <span className="metric-label">Request ID</span>
                        <span className="mono-text task-id-text">{shot.provider_request_id}</span>
                      </div>
                    ) : null}
                    {shot.source_provider_output_id ? (
                      <div className="detail-row">
                        <span className="metric-label">Source Video ID</span>
                        <span className="mono-text task-id-text">{shot.source_provider_output_id}</span>
                      </div>
                    ) : null}
                    {shot.source_provider_duration_seconds ? (
                      <div className="detail-row">
                        <span className="metric-label">Source Duration</span>
                        <span>{shot.source_provider_duration_seconds.toFixed(1)}s</span>
                      </div>
                    ) : null}
                    {shot.provider_output_id ? (
                      <div className="detail-row">
                        <span className="metric-label">Output Video ID</span>
                        <span className="mono-text task-id-text">{shot.provider_output_id}</span>
                      </div>
                    ) : null}
                    {shot.provider_output_duration_seconds ? (
                      <div className="detail-row">
                        <span className="metric-label">Output Duration</span>
                        <span>{shot.provider_output_duration_seconds.toFixed(1)}s</span>
                      </div>
                    ) : null}
                    {shot.stitched_segment_start_seconds !== undefined && shot.stitched_segment_start_seconds !== null ? (
                      <div className="detail-row">
                        <span className="metric-label">Stitch Segment Start</span>
                        <span>{shot.stitched_segment_start_seconds.toFixed(1)}s</span>
                      </div>
                    ) : null}
                    {shot.stitched_segment_duration_seconds !== undefined && shot.stitched_segment_duration_seconds !== null ? (
                      <div className="detail-row">
                        <span className="metric-label">Stitch Segment Length</span>
                        <span>{shot.stitched_segment_duration_seconds.toFixed(1)}s</span>
                      </div>
                    ) : null}
                    {shot.stitched_segment_url && shot.stitched_segment_url !== shot.asset_url ? (
                      <div className="detail-row">
                        <span className="metric-label">Stitched Tail</span>
                        <a className="text-link" href={shot.stitched_segment_url} target="_blank" rel="noreferrer">
                          Open continuation MP4
                        </a>
                      </div>
                    ) : null}
                    {shot.provider_units_consumed ? (
                      <div className="detail-row">
                        <span className="metric-label">Units Consumed</span>
                        <span>{shot.provider_units_consumed}</span>
                      </div>
                    ) : null}
                    {shot.error_message ? (
                      <div className="detail-row detail-error">
                        <span className="metric-label">Provider Error</span>
                        <span>{shot.error_message}</span>
                      </div>
                    ) : null}
                    {shot.provider_request_payload ? (
                      <details className="payload-block">
                        <summary>
                          <span className="metric-label">Request Payload</span>
                        </summary>
                        <pre>{formatJsonPayload(shot.provider_request_payload)}</pre>
                      </details>
                    ) : null}
                    {shot.provider_terminal_payload ? (
                      <details className="payload-block">
                        <summary>
                          <span className="metric-label">Response Payload</span>
                        </summary>
                        <pre>{formatJsonPayload(shot.provider_terminal_payload)}</pre>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">Shot metadata will appear here after planning begins.</div>
        )}
      </div>
    </>
  );
}
