from app.schemas import Shot, ShotPlanResponse


def build_shot_plan(prompt: str) -> ShotPlanResponse:
    cleaned = " ".join(prompt.strip().split())
    base = cleaned if cleaned else "A cinematic video scene"

    shots = [
        Shot(shotNumber=1, description=f"Establishing shot for {base}", durationSeconds=3),
        Shot(shotNumber=2, description=f"Medium shot highlighting the main action in {base}", durationSeconds=3),
        Shot(shotNumber=3, description=f"Closing detail shot that resolves {base}", durationSeconds=3),
    ]

    return ShotPlanResponse(shots=shots)
