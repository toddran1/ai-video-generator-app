export function GenerateConfirmModal({
  isOpen,
  estimatedCredits,
  onCancel,
  onConfirm
}: {
  isOpen: boolean;
  estimatedCredits: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <p className="eyebrow">Confirm Generation</p>
        <h3>Generate from saved manual shot plan?</h3>
        <p className="detail-copy">
          This project has a saved shot plan. Starting generation will use those manual shots instead of the automatic planner and will spend provider credits.
        </p>
        <div className="estimate-banner">
          <span className="metric-label">Estimated Usage</span>
          <strong>
            ~{estimatedCredits} unit{estimatedCredits === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" onClick={onConfirm} type="button">
            Generate With Manual Plan
          </button>
        </div>
      </div>
    </div>
  );
}
