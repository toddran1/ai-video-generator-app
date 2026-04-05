import { useState, type Dispatch, type SetStateAction } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { DEFAULT_BEAT_DURATION, klingCameraControlTypes, resetKlingPlanningSettings } from "../../lib/studio/config";
import { clearProjectCameraFields, parseOptionalNumber, shouldHideCameraControls } from "../../lib/studio/utils";
import type { ProjectPlanningSettings } from "../../types";

const cfgScaleHelp = "Adjusts how strongly Kling follows the prompt. Lower values allow more freedom; higher values push closer to the written prompt.";
const cameraTypeHelp =
  "Choose a motion preset, or select Simple to manually tune camera movement axes like pan, tilt, roll, and zoom.";
const cameraAxisHelp: Record<string, string> = {
  Horizontal: "Moves the camera left or right across the frame.",
  Vertical: "Moves the camera up or down through the scene.",
  Pan: "Rotates the camera left or right from a fixed position.",
  Tilt: "Rotates the camera up or down from a fixed position.",
  Roll: "Rotates the camera clockwise or counterclockwise.",
  Zoom: "Pushes in closer or pulls back wider."
};

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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  return (
    <div className="detail-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Project Planning Controls</p>
          <h3>Guide auto planning and generation defaults</h3>
          <p className="project-card-caption">
            Keep this lightweight for short clips. Use narrative planning when you want 3+ connected shots.
          </p>
        </div>
        <button className="primary-button" disabled={isSavingSettings} onClick={onSaveProjectSettings} type="button">
          {isSavingSettings ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className="project-settings-grid">
        <label>
          <span>Kling Model</span>
          <select
            className="model-select"
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
          <span className="label-with-help">
            Target Shot Count
            <HelpTooltip content="Use 1-2 for simple clips. Use 3 or more when you want planner story structure." />
          </span>
          <input
            min={1}
            max={12}
            onChange={(event) =>
              setPlanningSettings((current) => ({
                ...current,
                targetShotCount: Number(event.target.value) || 1
              }))
            }
            type="number"
            value={planningSettings.targetShotCount ?? 1}
          />
        </label>

          <label>
            <span>Default Shot Duration</span>
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

      {(planningSettings.targetShotCount ?? 1) > 2 ? (
        <div className="project-settings-grid">
          <label>
            <span className="label-with-help">
              Narrative Mode
              <HelpTooltip content="Narrative planning is most useful for 3+ connected shots. For short clips, focus on the prompt, model, and duration." />
            </span>
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
      ) : null}

      <div className="advanced-accordion">
        <button
          className="advanced-accordion-trigger"
          onClick={() => setIsAdvancedOpen((current) => !current)}
          type="button"
        >
          <div>
            <p className="eyebrow">Kling Advanced</p>
            <p className="project-card-caption">Optional expert controls for Kling.</p>
          </div>
          <span className={`advanced-caret ${isAdvancedOpen ? "is-open" : ""}`}>⌄</span>
        </button>

        {isAdvancedOpen ? (
          <div className="advanced-accordion-body advanced-tab-panel">
            <div className="advanced-panel-header">
              <p className="project-card-caption">Fine-tune Kling mode and CFG settings.</p>
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
                <span className="label-with-help">
                  CFG Scale
                  <HelpTooltip content={cfgScaleHelp} />
                </span>
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
                  <span className="label-with-help">
                    Camera Type
                    <HelpTooltip content={cameraTypeHelp} />
                  </span>
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
                        <span className="label-with-help">
                          {label}
                          <HelpTooltip content={cameraAxisHelp[label]} />
                        </span>
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
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
