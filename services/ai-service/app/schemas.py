from pydantic import BaseModel, Field


class ShotPlanRequest(BaseModel):
    prompt: str = Field(min_length=1)


class Shot(BaseModel):
    shotNumber: int
    description: str
    durationSeconds: int


class ShotPlanResponse(BaseModel):
    shots: list[Shot]
