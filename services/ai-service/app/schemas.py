from pydantic import BaseModel, Field


class ShotPlanRequest(BaseModel):
    prompt: str = Field(min_length=1)
    targetShotCount: int | None = None
    defaultBeatDuration: int | None = None
    aspectRatio: str | None = None
    styleHint: str | None = None
    narrativeMode: str | None = None
    autoBeatDescriptions: bool | None = None


class Shot(BaseModel):
    shotNumber: int
    beatLabel: str | None = None
    description: str
    durationSeconds: int
    generationMode: str | None = None
    sourceShotNumber: int | None = None
    extendPrompt: str | None = None


class ShotPlanResponse(BaseModel):
    shots: list[Shot]
