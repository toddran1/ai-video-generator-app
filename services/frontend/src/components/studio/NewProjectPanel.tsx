import type { FormEvent } from "react";
import type { ProjectFormState } from "../../lib/studio/config";
import { DEFAULT_BEAT_DURATION, klingCameraControlTypes } from "../../lib/studio/config";
import {
  clearProjectFormCameraFields,
  shouldHideCameraControls
} from "../../lib/studio/utils";

export function NewProjectPanel({
  availableModels,
  defaultModel,
  formState,
  setFormState,
  supportedDurations,
  supportedAspectRatios,
  usesFixedDurationOptions,
  isCreating,
  error,
  onSubmit,
  onResetKlingControls
}: {
  availableModels: Array<{ id: string; label: string; supportsCameraControl: boolean; estimatedUnitsPerShot: number }>;
  defaultModel: string;
  formState: ProjectFormState;
  setFormState: React.Dispatch<React.SetStateAction<ProjectFormState>>;
  supportedDurations: number[];
  supportedAspectRatios: Array<"16:9" | "9:16" | "1:1">;
  usesFixedDurationOptions: boolean;
  isCreating: boolean;
  error: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResetKlingControls: () => void;
}) {
  return (
    <section className="panel panel-form">
      <div className="panel-header">
        <p className="eyebrow">New Project</p>
        <h2>Describe the video you want to produce.</h2>
      </div>

      <form className="project-form" onSubmit={onSubmit}>
        <label>
          <span>Project Title</span>
          <input
            value={formState.title}
            onChange={(event) => setFormState((current) => ({ ...current, title: event.target.value }))}
            placeholder="Launch film"
            required
          />
        </label>

        <label>
          <span>Prompt</span>
          <textarea
            value={formState.prompt}
            onChange={(event) => setFormState((current) => ({ ...current, prompt: event.target.value }))}
            placeholder="A cinematic drone shot over a futuristic city at sunrise..."
            rows={6}
            required
          />
        </label>

        <div className="project-settings-grid">
          <label>
            <span>Kling Model</span>
            <select
              onChange={(event) =>
                setFormState((current) => {
                  const nextState = { ...current, klingModel: event.target.value || defaultModel };
                  return shouldHideCameraControls(nextState.klingModel, nextState.klingMode)
                    ? clearProjectFormCameraFields(nextState)
                    : nextState;
                })
              }
              value={formState.klingModel || defaultModel}
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Target Shot Count</span>
            <input
              min={1}
              max={12}
              onChange={(event) =>
                setFormState((current) => ({ ...current, targetShotCount: Number(event.target.value) || 3 }))
              }
              type="number"
              value={formState.targetShotCount}
            />
          </label>

          <label>
            <span>Default Beat Duration</span>
            {usesFixedDurationOptions ? (
              <select
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    defaultBeatDuration: Number(event.target.value) || DEFAULT_BEAT_DURATION
                  }))
                }
                value={String(formState.defaultBeatDuration)}
              >
                {supportedDurations.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}s
                  </option>
                ))}
              </select>
            ) : (
              <input
                min={1}
                max={30}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    defaultBeatDuration: Number(event.target.value) || DEFAULT_BEAT_DURATION
                  }))
                }
                type="number"
                value={formState.defaultBeatDuration}
              />
            )}
          </label>

          <label>
            <span>Aspect Ratio</span>
            <select
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  aspectRatio: event.target.value as "16:9" | "9:16" | "1:1"
                }))
              }
              value={formState.aspectRatio}
            >
              {supportedAspectRatios.map((aspectRatio) => (
                <option key={aspectRatio} value={aspectRatio}>
                  {aspectRatio}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>Style Hint</span>
          <input
            value={formState.styleHint}
            onChange={(event) => setFormState((current) => ({ ...current, styleHint: event.target.value }))}
            placeholder="moody cinematic, bright product ad, anime-inspired..."
          />
        </label>

        <div className="project-settings-grid">
          <label>
            <span>Narrative Mode</span>
            <select
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  narrativeMode: event.target.value as ProjectFormState["narrativeMode"]
                }))
              }
              value={formState.narrativeMode}
            >
              <option value="3-beat-story">3-Beat Story</option>
              <option value="5-beat-story">5-Beat Story</option>
              <option value="fight-scene">Fight Scene</option>
              <option value="dialogue-scene">Dialogue Scene</option>
              <option value="reveal-arc">Reveal Arc</option>
            </select>
          </label>

          <label className="checkbox-label">
            <span>Auto-Fill Beat Descriptions</span>
            <input
              checked={formState.autoBeatDescriptions}
              onChange={(event) =>
                setFormState((current) => ({ ...current, autoBeatDescriptions: event.target.checked }))
              }
              type="checkbox"
            />
          </label>
        </div>

        <div className="advanced-tab-panel">
          <div className="advanced-panel-header">
            <div>
              <p className="eyebrow">Kling Advanced</p>
              <p className="project-card-caption">
                Optional expert controls for Kling. In <strong>Simple</strong> mode you can tune multiple camera
                axes together.
              </p>
            </div>
            <button className="ghost-button" onClick={onResetKlingControls} type="button">
              Reset Kling Controls
            </button>
          </div>

          <div className="project-settings-grid">
            <label>
              <span>Kling Mode</span>
              <select
                onChange={(event) =>
                  setFormState((current) => {
                    const nextState = { ...current, klingMode: event.target.value as ProjectFormState["klingMode"] };

                    return shouldHideCameraControls(nextState.klingModel, nextState.klingMode)
                      ? clearProjectFormCameraFields(nextState)
                      : nextState;
                  })
                }
                value={formState.klingMode}
              >
                <option value="">Default</option>
                <option value="std">Std</option>
                <option value="pro">Pro</option>
              </select>
            </label>

            <label className="slider-label">
              <span>CFG Scale</span>
              <div className="slider-control">
                <input
                  onChange={(event) => setFormState((current) => ({ ...current, klingCfgScale: event.target.value }))}
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={formState.klingCfgScale || "0.5"}
                />
                <strong>{formState.klingCfgScale || "0.5"}</strong>
              </div>
            </label>
          </div>

          {!shouldHideCameraControls(formState.klingModel || defaultModel, formState.klingMode || null) ? (
            <div className="project-settings-grid">
              <label>
                <span>Camera Type</span>
                <select
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      klingCameraControlType: event.target.value as ProjectFormState["klingCameraControlType"],
                      klingCameraHorizontal: event.target.value === "simple" ? current.klingCameraHorizontal : "",
                      klingCameraVertical: event.target.value === "simple" ? current.klingCameraVertical : "",
                      klingCameraPan: event.target.value === "simple" ? current.klingCameraPan : "",
                      klingCameraTilt: event.target.value === "simple" ? current.klingCameraTilt : "",
                      klingCameraRoll: event.target.value === "simple" ? current.klingCameraRoll : "",
                      klingCameraZoom: event.target.value === "simple" ? current.klingCameraZoom : ""
                    }))
                  }
                  value={formState.klingCameraControlType}
                >
                  <option value="">None</option>
                  {klingCameraControlTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              {formState.klingCameraControlType !== "simple" ? (
                <p className="project-card-caption">
                  Select <strong>Simple</strong> to tune one or more camera axes.
                </p>
              ) : null}

              {formState.klingCameraControlType === "simple" ? (
                <>
                  {(
                    [
                      ["Horizontal", "klingCameraHorizontal"],
                      ["Vertical", "klingCameraVertical"],
                      ["Pan", "klingCameraPan"],
                      ["Tilt", "klingCameraTilt"],
                      ["Roll", "klingCameraRoll"],
                      ["Zoom", "klingCameraZoom"]
                    ] as const
                  ).map(([label, field]) => (
                    <label className="slider-label" key={field}>
                      <span>{label}</span>
                      <div className="slider-control">
                        <input
                          onChange={(event) =>
                            setFormState((current) => ({ ...current, [field]: event.target.value }))
                          }
                          type="range"
                          min="-10"
                          max="10"
                          step="0.1"
                          value={formState[field] || "0"}
                        />
                        <strong>{formState[field] || "0"}</strong>
                      </div>
                    </label>
                  ))}
                </>
              ) : null}
            </div>
          ) : (
            <p className="project-card-caption">Camera control is not available when Kling mode is Pro.</p>
          )}
        </div>

        <button className="primary-button" type="submit" disabled={isCreating}>
          {isCreating ? "Creating..." : "Create Project"}
        </button>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}
    </section>
  );
}
