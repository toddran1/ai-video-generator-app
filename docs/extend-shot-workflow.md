# Extend Shot Workflow

## Goal

Use Kling's `POST /v1/videos/extend` endpoint to continue an existing shot instead of generating the next shot from scratch. This should improve continuity for:

- fights
- chase sequences
- walk-and-talk scenes
- reveals that need stable subject identity and camera momentum

## Product Behavior

### New Shot Planning Controls

Each shot can optionally declare:

- `generationMode`
  - `generate`
  - `extend-previous`
- `continuityStrength`
  - `low`
  - `medium`
  - `high`
- `extendPrompt`
  - optional override prompt for how the continuation should evolve

Project-level option:

- `preferContinuity`
  - when enabled, planner/templates may suggest `extend-previous` on continuation beats

## Execution Flow

### Initial Shot

1. Generate shot 1 with `text2video` or `image2video`
2. Persist:
   - provider task ID
   - clip asset URL
   - provider request/response payloads

### Extend Shot

1. Take the previous shot's completed asset as input
2. Call Kling `extend`
3. Poll until terminal state
4. Persist the extended clip as the current shot asset
5. Continue downstream stitching as usual

## Backend Changes

### Data Model

Add to `project_shot_plans` and `generation_shots`:

- `generation_mode`
- `source_shot_number`
- `continuity_strength`
- `extend_prompt`

Add to diagnostics metadata:

- `provider_operation`
  - `text2video`
  - `extend`
  - `lip-sync`

### Worker Logic

When processing a shot:

1. If `generation_mode === generate`
   - call the normal provider submit flow
2. If `generation_mode === extend-previous`
   - verify the previous shot completed
   - pass previous asset into Kling `extend`
   - save request/response payloads exactly like normal generation

If the previous shot is missing or failed:

- mark current shot failed with a clear dependency error
- do not submit an extend request

## Provider Adapter Changes

Add an operation-aware provider API:

```ts
generateVideoClip(...)
extendVideoClip(...)
applyLipSync(...)
```

Or a single method with `operation` if we want a flatter interface.

For Kling:

- keep `text2video` as current flow
- add `extend` submit/poll flow
- capture operation-specific payloads in diagnostics

## Frontend Changes

### Shot Editor

Add controls per shot:

- `Generation Mode`
- `Source Shot`
- `Continuity Strength`
- `Extend Prompt`

Behavior:

- `Source Shot` defaults to previous shot when mode is `extend-previous`
- `Extend Prompt` can inherit the shot description unless overridden

### Diagnostics

Show:

- provider operation
- source shot dependency
- extend request payload
- extend response payload

## Suggested MVP for Extend

Phase 1:

- manual per-shot `extend-previous`
- previous shot only
- no planner automation

Phase 2:

- planner can suggest extend on continuation beats
- UI continuity hints

Phase 3:

- continuity-aware story templates
- fallback from `extend` to fresh generate if provider rejects extension

## Risks

- provider-specific input schema may differ from text2video
- extended clips may still drift in identity or framing
- retries must not accidentally re-extend from the wrong source asset
- stitching logic should treat extended clips just like normal clips once complete

## Why This Matters

This is the most direct path to longer, more coherent stories without forcing every shot to start from zero. It aligns with the current shot planner direction and should be implemented before lip-sync if continuity is the higher priority.
