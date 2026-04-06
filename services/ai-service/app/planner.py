from app.schemas import Shot, ShotPlanRequest, ShotPlanResponse


def _clamp(value: int, minimum: int, maximum: int) -> int:
    return max(minimum, min(value, maximum))


def _clean_prompt(prompt: str) -> str:
    cleaned = " ".join(prompt.strip().split())
    return cleaned if cleaned else "A cinematic video scene"


def _build_template(narrative_mode: str, shot_count: int, default_duration: int) -> list[dict[str, object]]:
    if shot_count <= 1:
        return [
            {
                "beatLabel": "Clip",
                "description": "Create one strong standalone clip with a clear subject and visual payoff.",
                "durationSeconds": _clamp(default_duration, 1, 30),
            }
        ]

    if shot_count == 2:
        return [
            {
                "beatLabel": "Opening",
                "description": "Set up the subject, setting, and immediate visual context.",
                "durationSeconds": _clamp(default_duration, 1, 30),
            },
            {
                "beatLabel": "Continuation",
                "description": "Carry the action or emotion forward into a strong follow-up moment.",
                "durationSeconds": _clamp(default_duration, 1, 30),
            },
        ]

    templates: dict[str, list[dict[str, object]]] = {
        "3-beat-story": [
            {"beatLabel": "Intro", "description": "Open by establishing the subject, world, and immediate context.", "durationOffset": 0},
            {"beatLabel": "Continuation", "description": "Push the story forward with the key action or conflict beat.", "durationOffset": 0},
            {"beatLabel": "Climax", "description": "Deliver the peak moment with the strongest visual payoff.", "durationOffset": 1},
        ],
        "5-beat-story": [
            {"beatLabel": "Hook", "description": "Start with a visually striking first image.", "durationOffset": -1},
            {"beatLabel": "Setup", "description": "Clarify the subject, setting, and situation.", "durationOffset": 0},
            {"beatLabel": "Rising Action", "description": "Increase tension and momentum.", "durationOffset": 0},
            {"beatLabel": "Climax", "description": "Deliver the turning point or impact moment.", "durationOffset": 1},
            {"beatLabel": "Resolution", "description": "End with a clean resolving image.", "durationOffset": -1},
        ],
        "fight-scene": [
            {"beatLabel": "Standoff", "description": "Frame the opponent, stance, and tension before the clash.", "durationOffset": 0},
            {"beatLabel": "First Clash", "description": "Show the first explosive contact and movement.", "durationOffset": 0},
            {"beatLabel": "Momentum Shift", "description": "Escalate with a reversal, dodge, or power-up beat.", "durationOffset": 0},
            {"beatLabel": "Finisher", "description": "Deliver the decisive attack or strongest strike.", "durationOffset": 1},
            {"beatLabel": "Aftershock", "description": "Show the aftermath, smoke, debris, or emotional release.", "durationOffset": -1},
        ],
        "dialogue-scene": [
            {"beatLabel": "Approach", "description": "Introduce the speakers and the emotional tone of the exchange.", "durationOffset": 0},
            {"beatLabel": "Exchange", "description": "Capture the core spoken moment and reaction shots.", "durationOffset": 0},
            {"beatLabel": "Turn", "description": "Reveal the line or expression that changes the scene.", "durationOffset": 0},
            {"beatLabel": "Response", "description": "Show the emotional consequence and lingering tension.", "durationOffset": 0},
        ],
        "reveal-arc": [
            {"beatLabel": "Mystery", "description": "Frame the unknown, concealed, or unstable situation.", "durationOffset": 0},
            {"beatLabel": "Clue", "description": "Introduce a detail that hints at the truth.", "durationOffset": 0},
            {"beatLabel": "Reveal", "description": "Unveil the core surprise, transformation, or hidden fact.", "durationOffset": 1},
            {"beatLabel": "Reaction", "description": "Capture the emotional or visual fallout of the reveal.", "durationOffset": 0},
        ],
    }

    base = templates.get(narrative_mode, templates["3-beat-story"])
    return [
        {
            "beatLabel": base[min(index, len(base) - 1)]["beatLabel"],
            "description": base[min(index, len(base) - 1)]["description"],
            "durationSeconds": _clamp(default_duration + int(base[min(index, len(base) - 1)]["durationOffset"]), 1, 30),
        }
        for index in range(shot_count)
    ]


def build_shot_plan(payload: ShotPlanRequest) -> ShotPlanResponse:
    base_prompt = _clean_prompt(payload.prompt)
    shot_count = _clamp(payload.targetShotCount or 1, 1, 12)
    default_duration = _clamp(payload.defaultBeatDuration or 5, 1, 30)
    narrative_mode = payload.narrativeMode or "3-beat-story"
    auto_descriptions = payload.autoBeatDescriptions is not False

    template = _build_template(narrative_mode, shot_count, default_duration)

    shots = []
    for index, beat in enumerate(template, start=1):
        beat_label = str(beat["beatLabel"])
        if auto_descriptions:
            description = f"{beat['description']} Subject and continuity: {base_prompt}"
        else:
            description = f"{beat_label} shot for {base_prompt}"

        shots.append(
            Shot(
                shotNumber=index,
                beatLabel=beat_label,
                description=description,
                durationSeconds=int(beat["durationSeconds"]),
                generationMode="generate" if index == 1 else "extend-previous",
                sourceShotNumber=None if index == 1 else index - 1,
                extendPrompt="" if index == 1 else description,
            )
        )

    return ShotPlanResponse(shots=shots)
