# AI Video Generator MVP

This repository contains an MVP pipeline for prompt-to-video generation with:

- `services/frontend`: React + TypeScript + Vite UI for project creation and video monitoring.
- `services/backend`: Node.js + TypeScript + Express API, BullMQ queue, worker, PostgreSQL metadata.
- `services/ai-service`: Python FastAPI service for shot planning.
- `docker-compose.yml`: Local orchestration for frontend, backend, worker, AI service, Redis, and PostgreSQL.

## Current MVP Flow

1. `POST /projects` creates a project.
2. `GET /projects` lists projects for the frontend dashboard.
3. The frontend lets you choose a generation profile:
   - `testing`: lower-cost Kling profile for iteration
   - `production`: higher-quality Kling profile
4. `POST /generate` enqueues a generation job for the project.
5. The backend worker calls the Python `POST /plan-shots` endpoint.
6. The worker generates real clips through the selected video provider.
7. The worker persists job, shot, provider task, provider request, and credit metadata in PostgreSQL.
8. The worker stitches completed clips into one MP4 and writes a provider metadata archive JSON.
9. The frontend shows job history, shot timelines, provider diagnostics, retry/resume controls, and output links.

## Current MVP Capabilities

- Project creation and project listing
- Queue-backed generation jobs with BullMQ
- Python-backed shot planning
- Real Kling clip generation
- Testing vs production generation profiles
- ffmpeg clip stitching into a final MP4
- Persisted job history and shot history
- Provider diagnostics:
  - task IDs
  - request IDs
  - units consumed
  - terminal provider payloads
- Whole-job retry/resume
- Retry generation from a specific shot
- Local cancel for an in-flight shot
- Metadata archive download for completed jobs

## Phase 2 Roadmap

### Milestone 1: Creative Control

- Add editable shot plans before generation starts
- Let users adjust shot count, duration, aspect ratio, and negative prompt settings
- Support per-shot prompt overrides in the frontend
- Add manual shot approval before expensive provider generation begins

### Milestone 2: Provider Expansion

- Add at least one additional video provider behind the existing adapter layer
- Add provider fallback when a primary provider fails
- Normalize model metadata, cost hints, and capabilities across providers
- Add better provider-side cancel support when official APIs allow it

### Milestone 2A: Kling Endpoint Expansion

- Finish the `video-extend` path so multi-shot story projects can preserve continuity between clips
- Add `lip-sync` support for dialogue scenes, narration, and spoken-character workflows
- Add `image2video` for reference-first generation flows
- Add `multi-image2video` for stronger subject and scene consistency across clips
- Add `effects` support for provider-native stylized transitions or effect shots
- Add `text-to-audio` and `video-to-audio` as optional post-production building blocks
- Add provider capability metadata for each Kling endpoint so the UI can enforce valid inputs
- Persist endpoint-specific provider request and response payloads for debugging and auditability

### Milestone 3: Storage and Reliability

- Move assets and metadata archives from local storage to S3-compatible storage
- Add signed URLs, retention policies, and asset cleanup rules
- Improve stalled-job recovery and long-running worker resilience
- Add more explicit job state transitions such as `canceled`, `canceling`, and `recovering`

### Milestone 4: Output Quality

- Add clip enhancement and optional upscale passes
- Add transitions, soundtrack, subtitles, and title cards
- Support render presets for landscape, square, and vertical outputs
- Add user-selectable quality presets that balance cost, speed, and fidelity

### Milestone 5: Productization

- Add authentication and per-user project ownership
- Add usage tracking and credit accounting
- Add project sharing, export bundles, and admin diagnostics
- Prepare production deployment with monitoring, secrets management, and queue observability

## Project Structure

```text
.
├── docker-compose.yml
├── services
│   ├── ai-service
│   │   └── app
│   ├── frontend
│   │   └── src
│   └── backend
│       └── src
└── storage
    ├── outputs
    ├── projects
    └── temp
```

## Run

```bash
docker compose up --build
```

Frontend:

```text
http://localhost:5173
```

Backend API:

```text
http://localhost:3000
```

## Current Backend Endpoints

- `POST /projects`: create a project
- `GET /projects`: list all projects
- `GET /projects/:projectId`: fetch one project
- `POST /generate`: queue a generation job for a project
- `GET /generate/provider-config`: fetch active provider capability limits for the UI
- `GET /generate/jobs/:jobId`: fetch one generation job with persisted shots
- `POST /generate/jobs/:jobId/retry`: retry or resume a failed/incomplete job
- `POST /generate/jobs/:jobId/shots/:shotNumber/retry`: retry generation starting from a specific shot
- `POST /generate/jobs/:jobId/shots/:shotNumber/cancel`: locally cancel an in-flight shot
- `GET /generate/projects/:projectId/status`: fetch a project with its jobs and latest shot metadata

## Provider Architecture

The generation pipeline now has two separate provider layers:

- Shot planning provider: controls how prompts become shot plans
- Video generation provider: controls how each shot becomes a clip

Current options:

- Shot planning: `mock`, `python-service`
- Video generation: `mock`, `kling`
- Generation profile: `testing`, `production`

The worker still stitches all generated shot clips with `ffmpeg`, regardless of which video provider created them.

## Kling Configuration

To turn on Kling for clip generation:

```bash
VIDEO_GENERATION_PROVIDER=kling
KLING_ACCESS_KEY=your_access_key
KLING_SECRET_KEY=your_secret_key
KLING_TEST_MODEL=kling-v2.6-std
KLING_PRODUCTION_MODEL=kling-v2.6-pro
KLING_DURATION_SECONDS=5
KLING_TEST_DURATION_SECONDS=5
KLING_PRODUCTION_DURATION_SECONDS=5
KLING_ASPECT_RATIO=16:9
KLING_SUPPORTED_DURATIONS=5,10
KLING_SUPPORTED_ASPECT_RATIOS=16:9,9:16,1:1
KLING_MODE=
```

Notes:

- The current implementation supports Kling access-key / secret-key JWT auth.
- `testing` is intended for cheaper iteration and currently defaults to `kling-v2.6-std`.
- `production` is intended for higher-quality runs and currently defaults to `kling-v2.6-pro`.
- Current Kling text-to-video limits are enforced in the UI and worker using provider config:
  - durations: `5`, `10`
  - aspect ratios: `16:9`, `9:16`, `1:1`
- The adapter submits `POST /v1/videos/text2video` and polls `GET /v1/videos/text2video/{task_id}`.
- The terminal success state returned by Kling is `succeed`.
- Local shot cancel stops our worker-side polling and processing. It does not guarantee provider-side cancellation because an official public cancel endpoint was not confirmed in the accessible docs.

## Extend Shot Workflow

A draft design for continuous multi-shot storytelling using Kling's `extend` endpoint lives in:

- [docs/extend-shot-workflow.md](/Users/reginaldrandolph/Documents/coding%20projects/python/ai-video-generator/docs/extend-shot-workflow.md)

## Kling Endpoint Surface

Based on the current Kling-owned ComfyUI integration repo, the following endpoint families are available in the latest wrapper code:

### Video

- `POST /v1/videos/text2video`
- `GET /v1/videos/text2video/{task_id}`
- `POST /v1/videos/image2video`
- `GET /v1/videos/image2video/{task_id}`
- `POST /v1/videos/video-extend`
- `GET /v1/videos/video-extend/{task_id}`
- `POST /v1/videos/lip-sync`
- `GET /v1/videos/lip-sync/{task_id}`
- `POST /v1/videos/effects`
- `GET /v1/videos/effects/{task_id}`
- `POST /v1/videos/multi-elements`
- `GET /v1/videos/multi-elements/{task_id}`
- `POST /v1/videos/multi-image2video`
- `GET /v1/videos/multi-image2video/{task_id}`

### Image

- `POST /v1/images/generations`
- `GET /v1/images/generations/{task_id}`
- `POST /v1/images/editing/expand`
- `GET /v1/images/editing/expand/{task_id}`
- `POST /v1/images/kolors-virtual-try-on`
- `GET /v1/images/kolors-virtual-try-on/{task_id}`

### Audio

- `POST /v1/audio/text-to-audio`
- `GET /v1/audio/text-to-audio/{task_id}`
- `POST /v1/audio/video-to-audio`
- `GET /v1/audio/video-to-audio/{task_id}`

Notes:

- The shared polling helper in the Kling-owned repo appends `/{task_id}` to each query path.
- We have already confirmed live that `video-extend` is the real path, while the simpler `/v1/videos/extend` doc reference was stale for our account.
- The public Qingque docs may contain newer or more detailed API information, but the accessible page content is partially hidden behind the app shell in this environment, so the Kling-owned repo remains the most actionable implementation reference for now.

References:

- [KlingAIResearch/ComfyUI-KLingAI-API](https://github.com/KlingAIResearch/ComfyUI-KLingAI-API)
- [Kling-owned prediction helper](https://github.com/KlingAIResearch/ComfyUI-KLingAI-API/blob/main/py/api/prediction.py)
- [Qingque Kling API docs](https://docs.qingque.cn/d/home/eZQArO-0RpjbQMpf5DPa-w8Rp?identityId=1oEER8VjdS8)

## Example Requests

Create a project:

```bash
curl -X POST http://localhost:3000/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"Demo Project","prompt":"A cinematic drone shot over a futuristic city at sunrise"}'
```

Queue generation:

```bash
curl -X POST http://localhost:3000/generate \
  -H "Content-Type: application/json" \
  -d '{"projectId":"<project-id>","profile":"testing"}'
```

Inspect a project:

```bash
curl http://localhost:3000/projects/<project-id>
```

Inspect a generation job:

```bash
curl http://localhost:3000/generate/jobs/<job-id>
```

Retry a generation job:

```bash
curl -X POST http://localhost:3000/generate/jobs/<job-id>/retry
```

Retry from a specific shot:

```bash
curl -X POST http://localhost:3000/generate/jobs/<job-id>/shots/2/retry
```

Cancel an in-flight shot:

```bash
curl -X POST http://localhost:3000/generate/jobs/<job-id>/shots/2/cancel
```

Inspect project generation status:

```bash
curl http://localhost:3000/generate/projects/<project-id>/status
```
