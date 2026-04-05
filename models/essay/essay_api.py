from fastapi import FastAPI
from pydantic import BaseModel
from typing import Any, Dict

from hybrid_evaluator import (
    HybridEvaluator,
    compute_weighted_score,
    LEADERSHIP_WEIGHTS,
    PERSONAL_WEIGHTS,
)

app = FastAPI(title="Essay Evaluation API")

# Загружается один раз при старте
evaluator = HybridEvaluator()


class EssayRequest(BaseModel):
    essay_text: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/evaluate-essay")
def evaluate_essay(req: EssayRequest):
    result, lang, translated_text = evaluator.evaluate(req.essay_text)

    scores = result.get("scores", {})

    leadership = float(scores.get("leadership", 0.0))
    initiative = float(scores.get("initiative", 0.0))
    growth = float(scores.get("growth", 0.0))
    motivation = float(scores.get("motivation", 0.0))
    values = float(scores.get("values", 0.0))

    leader_potential = compute_weighted_score(scores, LEADERSHIP_WEIGHTS)
    deep_human_potential = compute_weighted_score(scores, PERSONAL_WEIGHTS)

    ai_detection = result.get("ai_detection", {})
    ai_probability = float(ai_detection.get("ai_probability", 0.0))
    confidence = round(max(0.0, min(1.0, 1.0 - ai_probability)), 2)

    response: Dict[str, Any] = {
        "leadership": leadership,
        "initiative": initiative,
        "growth": growth,
        "motivation": motivation,
        "values": values,
        "leaderPotential": leader_potential,
        "deepHumanPotential": deep_human_potential,
        "confidence": confidence,
        "explanation": {
            "problem_scale": result.get("problem_scale", ""),
            "justification": result.get("justification", ""),
            "ai_detection": ai_detection,
            "lang": lang,
            "translated_text": translated_text,
            "raw_scores": scores,
        },
    }

    return response