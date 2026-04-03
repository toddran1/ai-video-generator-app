from pydantic import BaseModel, Field


class ShotPlanRequest(BaseModel):
    prompt: str = Field(min_length=1)
    targetShotCount: int | None = None
    aspectRatio: str | None = None
    styleHint: str | None = None


class Shot(BaseModel):
    shotNumber: int
    description: str
    durationSeconds: int


class ShotPlanResponse(BaseModel):
    shots: list[Shot]
