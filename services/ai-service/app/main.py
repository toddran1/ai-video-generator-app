from fastapi import FastAPI

from app.planner import build_shot_plan
from app.schemas import ShotPlanRequest, ShotPlanResponse

app = FastAPI(title="AI Video Planner Service", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service"}


@app.post("/plan-shots", response_model=ShotPlanResponse)
def plan_shots(payload: ShotPlanRequest) -> ShotPlanResponse:
    return build_shot_plan(payload.prompt)
