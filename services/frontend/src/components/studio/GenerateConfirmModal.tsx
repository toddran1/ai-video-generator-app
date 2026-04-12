import type { GenerationRequestPreview } from "../../types";

export function GenerateConfirmModal({
  isOpen,
  estimatedCredits,
  preview,
  onCancel,
  onConfirm
}: {
  isOpen: boolean;
  estimatedCredits: number;
  preview: GenerationRequestPreview[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card modal-card-wide">
        <p className="eyebrow">Confirm Generation</p>
        <h3>Review the exact job plan before generating</h3>
        <p className="detail-copy">
          This is the current per-shot request plan that will be used when the job is queued. Confirm only if this matches
          what you want to send.
        </p>
        <div className="estimate-banner">
          <span className="metric-label">Estimated Usage</span>
          <strong>
            ~{estimatedCredits} unit{estimatedCredits === 1 ? "" : "s"}
          </strong>
        </div>
        <div className="modal-preview-list">
          {preview.map((entry) => (
            <div className="modal-preview-card" key={`${entry.endpoint}-${entry.shotNumber}`}>
              <div className="modal-preview-head">
                <strong>Shot {entry.shotNumber}</strong>
                <span className="metric-label">{entry.endpoint}</span>
              </div>
              <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
              {entry.omitted ? (
                <div className="modal-preview-note">
                  <span className="metric-label">Omitted</span>
                  <pre>{JSON.stringify(entry.omitted, null, 2)}</pre>
                </div>
              ) : null}
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="primary-button" onClick={onConfirm} type="button">
            Confirm And Generate
          </button>
        </div>
      </div>
    </div>
  );
}
