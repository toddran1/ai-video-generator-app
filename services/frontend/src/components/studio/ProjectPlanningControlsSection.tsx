import type { Dispatch, SetStateAction } from "react";
import { DEFAULT_BEAT_DURATION, klingCameraControlTypes, resetKlingPlanningSettings } from "../../lib/studio/config";
import { clearProjectCameraFields, parseOptionalNumber, shouldHideCameraControls } from "../../lib/studio/utils";
import type { ProjectPlanningSettings } from "../../types";

export function ProjectPlanningControlsSection({
  availableModels,
  defaultModel,
  planningSettings,
  setPlanningSettings,
  supportedDurations,
  supportedAspectRatios,
  usesFixedDurationOptions,
  isSavingSettings,
  onSaveProjectSettings
}: {
  availableModels: Array<{ id: string; label: string; supportsCameraControl: boolean; estimatedUnitsPerShot: number }>;
  defaultModel: string;
  planningSettings: ProjectPlanningSettings;
  setPlanningSettings: Dispatch<SetStateAction<ProjectPlanningSettings>>;
  supportedDurations: number[];
  supportedAspectRatios: Array<"16:9" | "9:16" | "1:1">;
  usesFixedDurationOptions: boolean;
  isSavingSettings: boolean;
  onSaveProjectSettings: () => void;
}) {
  return (
    <div className="detail-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Project Planning Controls</p>
          <h3>Guide auto planning and generation defaults</h3>
        </div>
        <button className="primary-button" disabled={isSavingSettings} onClick={onSaveProjectSettings} type="button">
          {isSavingSettings ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="project-settings-grid">
        <label>
          <span>Kling Model</span>
          <select
            onChange={(event) =>
              setPlanningSettings((current) => {
                const nextState = { ...current, klingModel: event.target.value || defaultModel };
                return shouldHideCameraControls(nextState.klingModel ?? null, nextState.klingMode ?? null)
                  ? clearProjectCameraFields(nextState)
                  : nextState;
              })
            }
            value={planningSettings.klingModel ?? defaultModel}
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
              setPlanningSettings((current) => ({
                ...current,
                targetShotCount: Number(event.target.value) || 3
              }))
            }
            type="number"
            value={planningSettings.targetShotCount ?? 3}
          />
        </label>

        <label>
          <span>Default Beat Duration</span>
          {usesFixedDurationOptions ? (
            <select
              onChange={(event) =>
                setPlanningSettings((current) => ({
                  ...current,
                  defaultBeatDuration: Number(event.target.value) || DEFAULT_BEAT_DURATION
                }))
              }
              value={String(planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION)}
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
                setPlanningSettings((current) => ({
                  ...current,
                  defaultBeatDuration: Number(event.target.value) || DEFAULT_BEAT_DURATION
                }))
              }
              type="number"
              value={planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION}
            />
          )}
        </label>

        <label>
          <span>Aspect Ratio</span>
          <select
            onChange={(event) =>
              setPlanningSettings((current) => ({
                ...current,
                aspectRatio: event.target.value as "16:9" | "9:16" | "1:1"
              }))
            }
            value={planningSettings.aspectRatio ?? "16:9"}
          >
            {supportedAspectRatios.map((aspectRatio) => (
              <option key={aspectRatio} value={aspectRatio}>
                {aspectRatio}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="project-settings-stack">
        <span>Style Hint</span>
        <input
          onChange={(event) =>
            setPlanningSettings((current) => ({ ...current, styleHint: event.target.value }))
          }
          placeholder="moody cinematic, luxury fashion, documentary realism..."
          value={planningSettings.styleHint ?? ""}
        />
      </label>

      <div className="project-settings-grid">
        <label>
          <span>Narrative Mode</span>
          <select
            onChange={(event) =>
              setPlanningSettings((current) => ({
                ...current,
                narrativeMode: event.target.value as NonNullable<ProjectPlanningSettings["narrativeMode"]>
              }))
            }
            value={planningSettings.narrativeMode ?? "3-beat-story"}
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
            checked={planningSettings.autoBeatDescriptions ?? true}
            onChange={(event) =>
              setPlanningSettings((current) => ({
                ...current,
                autoBeatDescriptions: event.target.checked
              }))
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
          <button
            className="ghost-button"
            onClick={() => setPlanningSettings((current) => resetKlingPlanningSettings(current))}
            type="button"
          >
            Reset Kling Controls
          </button>
        </div>

        <div className="project-settings-grid">
          <label>
            <span>Kling Mode</span>
            <select
              onChange={(event) =>
                  setPlanningSettings((current) => {
                    const nextState = { ...current, klingMode: event.target.value || null };
                  return shouldHideCameraControls(nextState.klingModel ?? defaultModel, nextState.klingMode ?? null)
                    ? clearProjectCameraFields(nextState)
                    : nextState;
                })
              }
              value={planningSettings.klingMode ?? ""}
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
                onChange={(event) =>
                  setPlanningSettings((current) => ({
                    ...current,
                    klingCfgScale: parseOptionalNumber(event.target.value)
                  }))
                }
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={planningSettings.klingCfgScale ?? 0.5}
              />
              <strong>{(planningSettings.klingCfgScale ?? 0.5).toFixed(1)}</strong>
            </div>
          </label>
        </div>

        {!shouldHideCameraControls(planningSettings.klingModel ?? defaultModel, planningSettings.klingMode ?? null) ? (
          <div className="project-settings-grid">
            <label>
              <span>Camera Type</span>
              <select
                onChange={(event) =>
                  setPlanningSettings((current) => ({
                    ...current,
                    klingCameraControlType:
                      (event.target.value as ProjectPlanningSettings["klingCameraControlType"]) || null,
                    klingCameraHorizontal: event.target.value === "simple" ? current.klingCameraHorizontal : null,
                    klingCameraVertical: event.target.value === "simple" ? current.klingCameraVertical : null,
                    klingCameraPan: event.target.value === "simple" ? current.klingCameraPan : null,
                    klingCameraTilt: event.target.value === "simple" ? current.klingCameraTilt : null,
                    klingCameraRoll: event.target.value === "simple" ? current.klingCameraRoll : null,
                    klingCameraZoom: event.target.value === "simple" ? current.klingCameraZoom : null
                  }))
                }
                value={planningSettings.klingCameraControlType ?? ""}
              >
                <option value="">None</option>
                {klingCameraControlTypes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {planningSettings.klingCameraControlType !== "simple" ? (
              <p className="project-card-caption">
                Select <strong>Simple</strong> to tune one or more camera axes.
              </p>
            ) : null}

            {planningSettings.klingCameraControlType === "simple"
              ? ([
                  ["Horizontal", "klingCameraHorizontal"],
                  ["Vertical", "klingCameraVertical"],
                  ["Pan", "klingCameraPan"],
                  ["Tilt", "klingCameraTilt"],
                  ["Roll", "klingCameraRoll"],
                  ["Zoom", "klingCameraZoom"]
                ] as const).map(([label, field]) => (
                  <label className="slider-label" key={field}>
                    <span>{label}</span>
                    <div className="slider-control">
                      <input
                        onChange={(event) =>
                          setPlanningSettings((current) => ({
                            ...current,
                            [field]: parseOptionalNumber(event.target.value)
                          }))
                        }
                        type="range"
                        min="-10"
                        max="10"
                        step="0.1"
                        value={(planningSettings[field] as number | null) ?? 0}
                      />
                      <strong>{(((planningSettings[field] as number | null) ?? 0)).toFixed(1)}</strong>
                    </div>
                  </label>
                ))
              : null}
          </div>
        ) : (
          <p className="project-card-caption">Camera control is not available when Kling mode is Pro.</p>
        )}
      </div>
    </div>
  );
}
