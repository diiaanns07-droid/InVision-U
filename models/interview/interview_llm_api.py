import os
import json
from typing import List
from fastapi import FastAPI
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MODEL_ID = "llama-3.3-70b-versatile"

class QAItem(BaseModel):
    q: str
    a: str

class InterviewEvalRequest(BaseModel):
    answers: List[QAItem]

INTERVIEW_PROMPT = """
You are a STRICT, skeptical evaluator.

Your task is to REDUCE overestimation bias.

------------------------
CRITICAL DISTINCTION
------------------------

Reflection ≠ Growth  
Values statements ≠ Real values  
Internal insight ≠ External change  

A candidate can sound deep but still be average.

------------------------
SCORING (0–5)
------------------------

2.0 – 2.9 → weak / vague / internal only  
3.0 – 3.5 → solid normal (MOST candidates here)  
3.6 – 3.9 → above average  
4.0 – 4.4 → rare (clear behavioral evidence required)  
4.5 – 5.0 → almost impossible (real impact + proof)

If unsure → ROUND DOWN

------------------------
ANTI-INFLATION RULES
------------------------

DO NOT reward:
- nice wording
- emotional tone
- introspection alone

ONLY reward:
- behavior change
- decision-making under pressure
- real actions
- observable consequences

------------------------
GROWTH CALIBRATION
------------------------

Growth must be LIMITED unless:

- candidate shows clear BEFORE vs AFTER change
- describes WHAT changed in behavior (not just thoughts)
- explains HOW they applied it in real situations

If only reflection → MAX 3.8

------------------------
VALUES CALIBRATION
------------------------

Values must be LIMITED unless:

- candidate took a COSTLY action
- faced trade-offs or consequences
- acted despite risk

If values are only described → MAX 4.0

------------------------
LEADERSHIP CALIBRATION
------------------------

Leadership MUST be <= 3.0 IF:
- no leading others
- no group decisions
- no responsibility for outcomes

------------------------
INITIATIVE CALIBRATION
------------------------

Initiative MUST be <= 3.6 IF:
- actions are internal only
- no execution or outcome

------------------------
PENALTIES
------------------------

Apply DOWNWARD adjustment:

- no measurable result → -0.5
- no external impact → -0.4
- vague examples → -0.3
- no risk → -0.3

------------------------
OUTPUT
------------------------

Return ONLY JSON:

{
  "leadership": number,
  "initiative": number,
  "growth": number,
  "motivation": number,
  "values": number,
  "confidence": number,
  "summary": string,
  "strengths": string[],
  "risks": string[],
  "metric_justifications": {
    "leadership": string,
    "initiative": string,
    "growth": string,
    "motivation": string,
    "values": string
  }
}

------------------------
JUSTIFICATION RULE
------------------------

Each metric MUST:

1. Start with limitation:
   "Score limited because..."
2. Then explain strengths

------------------------
FINAL RULE
------------------------

If candidate is reflective but lacks action:

→ growth: medium-high (3.5–3.9)
→ values: high but not max (3.8–4.3)
→ leadership: low (≤3.0)
→ initiative: medium (≤3.6)

NEVER give 4.5+ without HARD evidence.
"""

@app.post("/evaluate-interview")
def evaluate_interview(req: InterviewEvalRequest):
    # Build transcript
    transcript_parts = []
    for i, item in enumerate(req.answers, start=1):
        transcript_parts.append(f"Q{i}: {item.q}\nA{i}: {item.a}")

    transcript = "\n\n".join(transcript_parts)

    completion = client.chat.completions.create(
        model=MODEL_ID,
        messages=[
            {"role": "system", "content": INTERVIEW_PROMPT},
            {"role": "user", "content": transcript},
        ],
        response_format={"type": "json_object"},
        temperature=0.1, # Снизили температуру для более сухих и строгих ответов
    )

    content = completion.choices[0].message.content
    data = json.loads(content)

    # Безопасное извлечение с дефолтными значениями, логика не тронута
    return {
        "leadership": float(data.get("leadership", 0)),
        "initiative": float(data.get("initiative", 0)),
        "growth": float(data.get("growth", 0)),
        "motivation": float(data.get("motivation", 0)),
        "values": float(data.get("values", 0)),
        "confidence": float(data.get("confidence", 0)),
        "summary": str(data.get("summary", "")),
        "strengths": data.get("strengths", []),
        "risks": data.get("risks", []),
        "metric_justifications": {
            "leadership": str(data.get("metric_justifications", {}).get("leadership", "")),
            "initiative": str(data.get("metric_justifications", {}).get("initiative", "")),
            "growth": str(data.get("metric_justifications", {}).get("growth", "")),
            "motivation": str(data.get("metric_justifications", {}).get("motivation", "")),
            "values": str(data.get("metric_justifications", {}).get("values", "")),
        }
    }