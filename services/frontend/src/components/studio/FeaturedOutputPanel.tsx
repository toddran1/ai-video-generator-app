import type { GenerationJob, GenerationShot, Project } from "../../types";
import { formatProvider, formatStatus, formatTime, getShotProgress } from "../../lib/studio/utils";

export function FeaturedOutputPanel({
  selectedProject,
  featuredJob,
  featuredShots
}: {
  selectedProject: Project | null;
  featuredJob: GenerationJob | null;
  featuredShots: GenerationShot[];
}) {
  return (
    <section className="panel panel-preview">
      <div className="panel-header">
        <p className="eyebrow">Featured Output</p>
        <h2>{selectedProject ? selectedProject.title : "No project yet"}</h2>
      </div>

      {selectedProject ? (
        <div className="featured-content">
          <div className="status-row">
            <span className={`status-pill status-${selectedProject.status}`}>{formatStatus(selectedProject.status)}</span>
            <span className="timestamp">Updated {formatTime(selectedProject.updated_at)}</span>
          </div>
          <p className="featured-prompt">{selectedProject.prompt}</p>
          <div className="featured-meta-grid">
            <div className="featured-meta-card">
              <span className="metric-label">Planner</span>
              <strong>{featuredJob ? formatProvider(featuredJob.planner_provider) : "Waiting"}</strong>
            </div>
            <div className="featured-meta-card">
              <span className="metric-label">Latest Job</span>
              <strong>{featuredJob ? formatStatus(featuredJob.status) : "Not started"}</strong>
            </div>
            <div className="featured-meta-card">
              <span className="metric-label">Shot Progress</span>
              <strong>{getShotProgress(featuredShots)}</strong>
            </div>
          </div>
          {selectedProject.output_url ? (
            <video className="video-player" controls src={selectedProject.output_url} />
          ) : (
            <div className="video-placeholder">Final video will appear here after stitching completes.</div>
          )}
        </div>
      ) : (
        <div className="empty-state">Create a project to start your first prompt-to-video run.</div>
      )}
    </section>
  );
}
