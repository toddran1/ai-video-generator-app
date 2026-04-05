export function HeroSection({ total, active, completed }: { total: number; active: number; completed: number }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">React + TypeScript Control Room</p>
        <h1>Build prompt-to-video projects with a live visual workflow.</h1>
        <p className="hero-text">
          Create projects, inspect the latest job, review generated shots, and preview the stitched MP4
          from one control surface.
        </p>
      </div>

      <div className="hero-panel">
        <div className="metric-card">
          <span className="metric-label">Projects</span>
          <strong>{total}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">Active Jobs</span>
          <strong>{active}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">Completed</span>
          <strong>{completed}</strong>
        </div>
      </div>
    </section>
  );
}
