import type { Dispatch, SetStateAction } from "react";
import { DEFAULT_BEAT_DURATION, klingCameraControlTypes, resetShotKlingOverrides } from "../../lib/studio/config";
import {
  applyStoryTemplateWithOptions,
  getClosestSupportedDuration,
  getShotCameraControlNotice,
  normalizeShotPlanDurations,
  normalizeShotSequence,
  parseOptionalNumber,
  reorderShots,
  shouldHideCameraControls
} from "../../lib/studio/utils";
import type { ProjectPlanningSettings, ProjectShotPlanItem } from "../../types";

export function ShotPlanEditorSection({
  editableShotPlan,
  setEditableShotPlan,
  planningSettings,
  supportedDurations,
  usesFixedDurationOptions,
  autoShotPlanPreview,
  isSavingShotPlan,
  onSaveShotPlan,
  perShotEstimate,
  draggedShotIndex,
  setDraggedShotIndex,
  usingManualShotPlan,
  savedShotPlan
}: {
  editableShotPlan: ProjectShotPlanItem[];
  setEditableShotPlan: Dispatch<SetStateAction<ProjectShotPlanItem[]>>;
  planningSettings: ProjectPlanningSettings;
  supportedDurations: number[];
  usesFixedDurationOptions: boolean;
  autoShotPlanPreview: ProjectShotPlanItem[];
  isSavingShotPlan: boolean;
  onSaveShotPlan: () => void;
  perShotEstimate: number;
  draggedShotIndex: number | null;
  setDraggedShotIndex: Dispatch<SetStateAction<number | null>>;
  usingManualShotPlan: boolean;
  savedShotPlan: ProjectShotPlanItem[];
}) {
  return (
    <div className="detail-section">
      <div className="section-head">
        <div>
          <p className="eyebrow">Shot Plan Editor</p>
          <h3>Override automatic planning for this project</h3>
          <p className="project-card-caption">
            Reorder shots, tune camera notes, and save a manual plan before you spend credits.
          </p>
        </div>
        <div className="section-actions">
          <button
            className="ghost-button"
            onClick={() =>
              setEditableShotPlan(
                normalizeShotSequence(
                  normalizeShotPlanDurations(
                    usingManualShotPlan
                      ? savedShotPlan
                      : createFallbackPlan(planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION),
                    supportedDurations
                  )
                )
              )
            }
            type="button"
          >
            Reset Editor
          </button>
          <button
            className="ghost-button"
            disabled={autoShotPlanPreview.length === 0}
            onClick={() =>
              setEditableShotPlan(
                normalizeShotSequence(
                  normalizeShotPlanDurations(
                    normalizeShotSequence(
                      autoShotPlanPreview.map((shot) => ({
                        ...shot,
                        negativePrompt: shot.negativePrompt ?? "",
                        cameraNotes: shot.cameraNotes ?? ""
                      }))
                    ),
                    supportedDurations
                  )
                )
              )
            }
            type="button"
          >
            Copy Auto Plan Into Editor
          </button>
          <button className="primary-button" disabled={isSavingShotPlan} onClick={onSaveShotPlan} type="button">
            {isSavingShotPlan ? "Saving..." : "Save Shot Plan"}
          </button>
        </div>
      </div>

      <div className="story-template-row">
        <span className="metric-label">Story Templates</span>
        <div className="toggle-row">
          <button
            className="ghost-button"
            onClick={() =>
              setEditableShotPlan((current) =>
                normalizeShotSequence(
                  normalizeShotPlanDurations(
                    applyStoryTemplateWithOptions(
                      planningSettings.narrativeMode ?? "3-beat-story",
                      planningSettings.targetShotCount ?? 3,
                      planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION,
                      !(planningSettings.autoBeatDescriptions ?? true),
                      current
                    ),
                    supportedDurations
                  )
                )
              )
            }
            type="button"
          >
            Apply Current Narrative Mode
          </button>
        </div>
      </div>

      <div className="shot-plan-editor">
        {editableShotPlan.map((shot, index) => (
          <div
            className={`shot-plan-editor-row ${draggedShotIndex === index ? "shot-plan-editor-row-dragging" : ""}`}
            draggable
            key={`shot-plan-${index}`}
            onDragEnd={() => setDraggedShotIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDragStart={() => setDraggedShotIndex(index)}
            onDrop={(event) => {
              event.preventDefault();

              if (draggedShotIndex === null || draggedShotIndex === index) {
                setDraggedShotIndex(null);
                return;
              }

              setEditableShotPlan((current) => reorderShots(current, draggedShotIndex, index));
              setDraggedShotIndex(null);
            }}
          >
            <div className="shot-plan-editor-head">
              <div className="shot-index-group">
                <span className="drag-handle" title="Drag to reorder">
                  Drag
                </span>
                <span className="shot-index">Shot {index + 1}</span>
              </div>
              <div className="editor-row-actions">
                <button
                  className="ghost-button"
                  disabled={editableShotPlan.length <= 1}
                  onClick={() =>
                    setEditableShotPlan((current) =>
                      normalizeShotSequence(current.filter((_, currentIndex) => currentIndex !== index))
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>

            <label className="shot-plan-field">
              <span className="metric-label">Generation Mode</span>
              <select
                className="shot-plan-input"
                onChange={(event) =>
                  setEditableShotPlan((current) =>
                    current.map((item, currentIndex) =>
                      currentIndex === index
                        ? {
                            ...item,
                            generationMode: event.target.value as "generate" | "extend-previous",
                            sourceShotNumber:
                              event.target.value === "extend-previous" ? item.sourceShotNumber ?? Math.max(index, 1) : null
                          }
                        : item
                    )
                  )
                }
                value={shot.generationMode ?? "generate"}
              >
                <option value="generate">Generate New Clip</option>
                <option value="extend-previous" disabled={index === 0}>
                  Extend Previous Clip
                </option>
              </select>
            </label>

            {shot.generationMode === "extend-previous" ? (
              <>
                <label className="shot-plan-field">
                  <span className="metric-label">Source Shot</span>
                  <select
                    className="shot-plan-input"
                    onChange={(event) =>
                      setEditableShotPlan((current) =>
                        current.map((item, currentIndex) =>
                          currentIndex === index ? { ...item, sourceShotNumber: Number(event.target.value) || null } : item
                        )
                      )
                    }
                    value={String(shot.sourceShotNumber ?? Math.max(index, 1))}
                  >
                    {Array.from({ length: index }, (_, sourceIndex) => sourceIndex + 1).map((sourceShot) => (
                      <option key={sourceShot} value={sourceShot}>
                        Shot {sourceShot}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="shot-plan-field">
                  <span className="metric-label">Extend Prompt</span>
                  <textarea
                    className="shot-plan-input"
                    onChange={(event) =>
                      setEditableShotPlan((current) =>
                        current.map((item, currentIndex) =>
                          currentIndex === index ? { ...item, extendPrompt: event.target.value } : item
                        )
                      )
                    }
                    placeholder="Describe how this shot should continue from the source clip..."
                    rows={2}
                    value={shot.extendPrompt ?? ""}
                  />
                </label>
              </>
            ) : null}

            <label className="shot-plan-field">
              <span className="metric-label">Beat Label</span>
              <input
                className="shot-plan-input"
                onChange={(event) =>
                  setEditableShotPlan((current) =>
                    current.map((item, currentIndex) =>
                      currentIndex === index ? { ...item, beatLabel: event.target.value } : item
                    )
                  )
                }
                placeholder="Intro, Continuation, Climax..."
                value={shot.beatLabel ?? ""}
              />
            </label>

            <label className="shot-plan-field">
              <span className="metric-label">Shot Description</span>
              <textarea
                className="shot-plan-input"
                onChange={(event) =>
                  setEditableShotPlan((current) =>
                    current.map((item, currentIndex) =>
                      currentIndex === index ? { ...item, description: event.target.value } : item
                    )
                  )
                }
                placeholder="Describe what should happen in this shot..."
                rows={3}
                value={shot.description}
              />
            </label>

            <label className="shot-plan-field">
              <span className="metric-label">Camera Notes</span>
              <textarea
                className="shot-plan-input"
                onChange={(event) =>
                  setEditableShotPlan((current) =>
                    current.map((item, currentIndex) =>
                      currentIndex === index ? { ...item, cameraNotes: event.target.value } : item
                    )
                  )
                }
                placeholder="dolly in, handheld, low angle..."
                rows={2}
                value={shot.cameraNotes ?? ""}
              />
            </label>

            <label className="shot-plan-field">
              <span className="metric-label">Negative Prompt</span>
              <textarea
                className="shot-plan-input"
                onChange={(event) =>
                  setEditableShotPlan((current) =>
                    current.map((item, currentIndex) =>
                      currentIndex === index ? { ...item, negativePrompt: event.target.value } : item
                    )
                  )
                }
                placeholder="blurry, text, watermark..."
                rows={2}
                value={shot.negativePrompt ?? ""}
              />
            </label>

            {shot.generationMode === "generate" ? (
              <div className="advanced-tab-panel">
                <div className="advanced-panel-header">
                  <div>
                    <p className="eyebrow">Shot Kling Overrides</p>
                    <p className="project-card-caption">Optional per-shot overrides for generate-only shots.</p>
                  </div>
                  <button
                    className="ghost-button"
                    onClick={() =>
                      setEditableShotPlan((current) =>
                        current.map((item, currentIndex) =>
                          currentIndex === index ? resetShotKlingOverrides(item) : item
                        )
                      )
                    }
                    type="button"
                  >
                    Reset Shot Overrides
                  </button>
                </div>

                <div className="project-settings-grid">
                  <label>
                    <span>Kling Mode</span>
                    <select
                      onChange={(event) =>
                        setEditableShotPlan((current) =>
                          current.map((item, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...item,
                                  ...(shouldHideCameraControls(
                                    planningSettings.klingModel ?? null,
                                    (event.target.value as ProjectShotPlanItem["klingMode"]) || null
                                  )
                                    ? resetShotKlingOverrides({
                                        ...item,
                                        klingMode: (event.target.value as ProjectShotPlanItem["klingMode"]) || null
                                      })
                                    : {
                                        ...item,
                                        klingMode: (event.target.value as ProjectShotPlanItem["klingMode"]) || null
                                      })
                                }
                              : item
                          )
                        )
                      }
                      value={shot.klingMode ?? ""}
                    >
                      <option value="">Project Default</option>
                      <option value="std">Std</option>
                      <option value="pro">Pro</option>
                    </select>
                  </label>

                  <label className="slider-label">
                    <span>CFG Scale</span>
                    <div className="slider-control">
                      <input
                        onChange={(event) =>
                          setEditableShotPlan((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index ? { ...item, klingCfgScale: parseOptionalNumber(event.target.value) } : item
                            )
                          )
                        }
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={shot.klingCfgScale ?? 0.5}
                      />
                      <strong>{(shot.klingCfgScale ?? 0.5).toFixed(1)}</strong>
                    </div>
                  </label>
                </div>

                {!shouldHideCameraControls(planningSettings.klingModel ?? null, shot.klingMode ?? null) ? (
                  <div className="project-settings-grid">
                    <label>
                      <span>Camera Type</span>
                      <select
                        onChange={(event) =>
                          setEditableShotPlan((current) =>
                            current.map((item, currentIndex) =>
                              currentIndex === index
                                ? {
                                    ...item,
                                    klingCameraControlType:
                                      (event.target.value as ProjectShotPlanItem["klingCameraControlType"]) || null,
                                    klingCameraHorizontal: event.target.value === "simple" ? item.klingCameraHorizontal ?? 0 : null,
                                    klingCameraVertical: event.target.value === "simple" ? item.klingCameraVertical ?? 0 : null,
                                    klingCameraPan: event.target.value === "simple" ? item.klingCameraPan ?? 0 : null,
                                    klingCameraTilt: event.target.value === "simple" ? item.klingCameraTilt ?? 0 : null,
                                    klingCameraRoll: event.target.value === "simple" ? item.klingCameraRoll ?? 0 : null,
                                    klingCameraZoom: event.target.value === "simple" ? item.klingCameraZoom ?? 0 : null
                                  }
                                : item
                            )
                          )
                        }
                        value={shot.klingCameraControlType ?? ""}
                      >
                        <option value="">None</option>
                        {klingCameraControlTypes.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="project-card-caption">
                      {getShotCameraControlNotice(shot, planningSettings.klingModel ?? null)}
                    </p>

                    {shot.klingCameraControlType === "simple"
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
                                  setEditableShotPlan((current) =>
                                    current.map((item, currentIndex) =>
                                      currentIndex === index
                                        ? { ...item, [field]: parseOptionalNumber(event.target.value) }
                                        : item
                                    )
                                  )
                                }
                                type="range"
                                min="-10"
                                max="10"
                                step="0.1"
                                value={(shot[field] as number | null) ?? 0}
                              />
                              <strong>{(((shot[field] as number | null) ?? 0)).toFixed(1)}</strong>
                            </div>
                          </label>
                        ))
                      : null}
                  </div>
                ) : (
                  <p className="project-card-caption">{getShotCameraControlNotice(shot)}</p>
                )}
              </div>
            ) : null}

            <label className="shot-plan-duration">
              <span className="metric-label">Duration Seconds</span>
              {usesFixedDurationOptions ? (
                <select
                  onChange={(event) =>
                    setEditableShotPlan((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === index
                          ? { ...item, durationSeconds: Number(event.target.value) || DEFAULT_BEAT_DURATION }
                          : item
                      )
                    )
                  }
                  value={String(getClosestSupportedDuration(shot.durationSeconds, supportedDurations))}
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
                    setEditableShotPlan((current) =>
                      current.map((item, currentIndex) =>
                        currentIndex === index ? { ...item, durationSeconds: Number(event.target.value) || 1 } : item
                      )
                    )
                  }
                  type="number"
                  value={shot.durationSeconds}
                />
              )}
            </label>

            <div className="shot-plan-estimate-row">
              <span className="metric-label">Shot Estimate</span>
              <span>
                ~{perShotEstimate} unit{perShotEstimate === 1 ? "" : "s"} · {shot.durationSeconds}s
              </span>
            </div>
          </div>
        ))}

        <button
          className="secondary-button"
          onClick={() =>
            setEditableShotPlan((current) =>
              normalizeShotSequence([
                ...current,
                {
                  shotNumber: current.length + 1,
                  beatLabel: "",
                  description: `New shot ${current.length + 1}`,
                  durationSeconds: planningSettings.defaultBeatDuration ?? DEFAULT_BEAT_DURATION,
                  generationMode: current.length === 0 ? "generate" : "extend-previous",
                  sourceShotNumber: current.length === 0 ? null : current.length,
                  extendPrompt: current.length === 0 ? "" : `Continue the story flow from shot ${current.length}.`,
                  negativePrompt: "",
                  cameraNotes: ""
                }
              ])
            )
          }
          type="button"
        >
          Add Shot
        </button>
      </div>
    </div>
  );
}

function createFallbackPlan(defaultBeatDuration: number): ProjectShotPlanItem[] {
  return [
    {
      shotNumber: 1,
      beatLabel: "Intro",
      description: "Establishing shot",
      durationSeconds: defaultBeatDuration,
      generationMode: "generate",
      sourceShotNumber: null,
      extendPrompt: "",
      negativePrompt: "",
      cameraNotes: ""
    },
    {
      shotNumber: 2,
      beatLabel: "Continuation",
      description: "Main action beat",
      durationSeconds: defaultBeatDuration,
      generationMode: "extend-previous",
      sourceShotNumber: 1,
      extendPrompt: "Continue the established action and motion from shot 1.",
      negativePrompt: "",
      cameraNotes: ""
    },
    {
      shotNumber: 3,
      beatLabel: "Climax",
      description: "Closing shot",
      durationSeconds: defaultBeatDuration,
      generationMode: "extend-previous",
      sourceShotNumber: 2,
      extendPrompt: "Carry the sequence forward into the climactic payoff from shot 2.",
      negativePrompt: "",
      cameraNotes: ""
    }
  ];
}
