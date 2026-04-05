"""
api.py
------
FastAPI application exposing the adaptive interview system over HTTP.

Endpoints:
  POST /interview/start               → create session, receive first question
  POST /interview/{session_id}/answer → submit answer, receive next question
  GET  /interview/{session_id}/status → session metadata & per-metric progress
  GET  /interview/{session_id}/evaluation → final structured evaluation
  DELETE /interview/{session_id}      → clean up session

Session storage:
  In-process dict for MVP. Replace with Redis or PostgreSQL for production.
  See SessionStore below — it's behind an interface so you can swap the backend.

Authentication:
  Add an API key / JWT dependency to the router when ready.
  The `_verify_api_key` stub is the injection point.

Error handling:
  All domain errors are mapped to HTTP status codes. FastAPI's default 422
  handling is preserved for request validation.
"""


from __future__ import annotations

import os
import requests
import logging
from dataclasses import asdict
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from answer_analyzer import AnswerAnalyzer
from interview_engine import (
    EngineConfig,
    FinalEvaluation,
    InterviewEngine,
    InterviewState,
)
from question_bank import QuestionBank

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("interview_api")


# ---------------------------------------------------------------------------
# Session store (swap this out for Redis / DB in production)
# ---------------------------------------------------------------------------

class InMemorySessionStore:
    """Thread-unsafe in-memory store. Replace with Redis for multi-worker deployments."""

    def __init__(self) -> None:
        self._sessions: dict[str, InterviewState] = {}

    def get(self, session_id: str) -> Optional[InterviewState]:
        return self._sessions.get(session_id)

    def save(self, state: InterviewState) -> None:
        self._sessions[state.session_id] = state

    def delete(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def count(self) -> int:
        return len(self._sessions)


# ---------------------------------------------------------------------------
# Application setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Adaptive Interview API",
    description=(
        "AI-powered adaptive candidate interview system. "
        "Evaluates leadership, initiative, growth, motivation, and values."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Restrict to your frontend origin in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INTERVIEW_LLM_API_URL = os.getenv("INTERVIEW_LLM_API_URL", "http://127.0.0.1:8002")

def llm_score_single_answer(question_text: str, answer_text: str, metric: str) -> float:
    try:
        res = requests.post(
            f"{INTERVIEW_LLM_API_URL}/score-answer",
            json={
                "question": question_text,
                "answer": answer_text,
                "metric": metric,
            },
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        score = float(data.get("score", 0.0))
        return max(0.0, min(5.0, score))
    except Exception as e:
        logger.warning("LLM scorer failed, fallback to rules only: %s", e)
        raise


# ---------------------------------------------------------------------------
# Dependency singletons (swap configs via environment variables or DI)
# ---------------------------------------------------------------------------

_session_store = InMemorySessionStore()
_question_bank  = QuestionBank()
_analyzer = AnswerAnalyzer(
    llm_scorer=llm_score_single_answer,
    llm_weight=0.25,
)
_config = EngineConfig(
    min_questions=5,
    max_questions=15,
    confidence_threshold=0.70,
    weakness_threshold=2.5,
)
_engine = InterviewEngine(bank=_question_bank, analyzer=_analyzer, config=_config)


def _get_session(session_id: str) -> InterviewState:
    state = _session_store.get(session_id)
    if state is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session '{session_id}' not found or has expired.",
        )
    return state


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class StartInterviewRequest(BaseModel):
    candidate_id: str = Field(..., description="Internal candidate identifier from your DB.")
    essay_summary: str = Field(
        default="",
        description=(
            "Short summary of the candidate's essay content. "
            "Used to seed context for the first questions."
        ),
        max_length=2000,
    )
    essay_weakness_metrics: list[str] = Field(
        default_factory=list,
        description=(
            "Metric names flagged as weak by the essay evaluation model. "
            "Valid values: leadership, initiative, growth, motivation, values."
        ),
    )


class SubmitAnswerRequest(BaseModel):
    answer: str = Field(
        ...,
        description="The candidate's raw answer text.",
        min_length=1,
        max_length=5000,
    )


class QuestionResponse(BaseModel):
    id: str
    text: str
    metric: str
    type: str
    depth: int


class NextStepResponse(BaseModel):
    status: str                         # "ongoing" | "complete"
    session_id: str
    turn: Optional[int]
    phase: Optional[str]
    question: Optional[QuestionResponse]
    strategy: Optional[str]
    progress: Optional[dict]
    message: Optional[str]             # Set when status == "complete"


class AnswerFeedback(BaseModel):
    turn: int
    metric: str
    score: float
    confidence: float
    flags: list[str]
    explanation: str
    metric_running_score: float
    next_step: NextStepResponse


class MetricProgress(BaseModel):
    metric: str
    current_score: float
    confidence: float
    questions_asked: int


class SessionStatusResponse(BaseModel):
    session_id: str
    candidate_id: str
    phase: str
    turn: int
    complete: bool
    overall_confidence: float
    metric_progress: list[MetricProgress]
    questions_asked: int
    max_questions: int


class MetricEvaluationResponse(BaseModel):
    metric: str
    score: float
    confidence: float
    strengths: list[str]
    weaknesses: list[str]
    explanation: str
    evidence_count: int


class FinalEvaluationResponse(BaseModel):
    session_id: str
    candidate_id: str
    metric_evaluations: list[MetricEvaluationResponse]
    overall_score: float
    strengths: list[str]
    weaknesses: list[str]
    recommendation: str
    recommendation_rationale: str
    total_questions: int
    total_turns: int
    interview_quality: str
    generated_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _engine_result_to_next_step(result: dict) -> NextStepResponse:
    """Convert raw engine dict output to the typed response model."""
    q_data = result.get("question")
    return NextStepResponse(
        status=result["status"],
        session_id=result.get("session_id", ""),
        turn=result.get("turn"),
        phase=result.get("phase"),
        question=QuestionResponse(**q_data) if q_data else None,
        strategy=result.get("strategy"),
        progress=result.get("progress"),
        message=result.get("message"),
    )


def _evaluation_to_response(ev: FinalEvaluation) -> FinalEvaluationResponse:
    from question_bank import Metric  # local import to avoid circular issues
    return FinalEvaluationResponse(
        session_id=ev.session_id,
        candidate_id=ev.candidate_id,
        metric_evaluations=[
            MetricEvaluationResponse(
                metric=me.metric,
                score=me.score,
                confidence=me.confidence,
                strengths=me.strengths,
                weaknesses=me.weaknesses,
                explanation=me.explanation,
                evidence_count=me.evidence_count,
            )
            for me in ev.metric_evaluations
        ],
        overall_score=ev.overall_score,
        strengths=ev.strengths,
        weaknesses=ev.weaknesses,
        recommendation=ev.recommendation.value,
        recommendation_rationale=ev.recommendation_rationale,
        total_questions=ev.total_questions,
        total_turns=ev.total_turns,
        interview_quality=ev.interview_quality,
        generated_at=ev.generated_at,
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post(
    "/interview/start",
    response_model=NextStepResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new interview session",
    tags=["Interview"],
)
def start_interview(body: StartInterviewRequest) -> NextStepResponse:
    """
    Initialize a new interview session for a candidate.

    - Creates a fresh InterviewState.
    - Returns the first question immediately.
    - The session_id in the response must be passed to all subsequent requests.
    """
    # Validate metric names
    valid_metrics = {m.value for m in __import__("question_bank").Metric}
    invalid = set(body.essay_weakness_metrics) - valid_metrics
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid metric names: {invalid}. Valid: {valid_metrics}",
        )

    state = _engine.create_session(
        candidate_id=body.candidate_id,
        essay_summary=body.essay_summary,
        essay_weakness_metrics=body.essay_weakness_metrics,
    )
    _session_store.save(state)
    logger.info("Session created: %s for candidate: %s", state.session_id, body.candidate_id)

    result = _engine.get_next_question(state)
    _session_store.save(state)

    return _engine_result_to_next_step(result)


@app.post(
    "/interview/{session_id}/answer",
    response_model=AnswerFeedback,
    summary="Submit an answer and receive the next question",
    tags=["Interview"],
)
def submit_answer(session_id: str, body: SubmitAnswerRequest) -> AnswerFeedback:
    """
    Submit the candidate's answer to the current question.

    - Analyzes the answer and updates metric scores.
    - Returns per-answer feedback + the next question (or completion signal).

    The `next_step.status` field will be `"complete"` when the interview
    is finished. In that case, call `GET /interview/{session_id}/evaluation`.
    """
    state = _get_session(session_id)

    if state.complete:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Interview already complete. Retrieve evaluation instead.",
        )

    if state.pending_question is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No pending question for this session. "
                "Call GET /interview/{session_id}/next first."
            ),
        )

    # Process answer
    feedback = _engine.submit_answer(state, body.answer)
    _session_store.save(state)
    logger.info(
        "Session %s | turn %s | metric=%s | score=%.2f",
        session_id, feedback["turn"], feedback["metric"], feedback["score"],
    )

    # Get the next question
    next_result = _engine.get_next_question(state)
    _session_store.save(state)

    return AnswerFeedback(
        **feedback,
        next_step=_engine_result_to_next_step(next_result),
    )


@app.get(
    "/interview/{session_id}/status",
    response_model=SessionStatusResponse,
    summary="Get current session status and per-metric progress",
    tags=["Interview"],
)
def get_status(session_id: str) -> SessionStatusResponse:
    """
    Returns a live snapshot of the interview session including:
    - Current phase and turn count
    - Per-metric scores and confidence
    - Overall progress percentage
    """
    from question_bank import Metric
    state = _get_session(session_id)
    return SessionStatusResponse(
        session_id=state.session_id,
        candidate_id=state.candidate_id,
        phase=state.phase.value,
        turn=state.turn,
        complete=state.complete,
        overall_confidence=round(state.overall_confidence(), 3),
        metric_progress=[
            MetricProgress(
                metric=m.value,
                current_score=round(state.get_metric_state(m).current_score, 2),
                confidence=round(state.get_metric_state(m).confidence, 3),
                questions_asked=state.get_metric_state(m).questions_asked,
            )
            for m in Metric
        ],
        questions_asked=state.questions_asked_total(),
        max_questions=_config.max_questions,
    )


@app.get(
    "/interview/{session_id}/evaluation",
    response_model=FinalEvaluationResponse,
    summary="Get the final structured evaluation",
    tags=["Interview"],
)
def get_evaluation(session_id: str) -> FinalEvaluationResponse:
    """
    Returns the complete evaluation for a finished interview.

    Can be called mid-interview for a partial evaluation (useful for
    operator dashboards), but the quality label will reflect incomplete coverage.
    """
    state = _get_session(session_id)
    evaluation = _engine.get_final_evaluation(state)
    logger.info(
        "Evaluation generated for session %s | overall=%.2f | recommendation=%s",
        session_id,
        evaluation.overall_score,
        evaluation.recommendation.value,
    )
    return _evaluation_to_response(evaluation)


@app.delete(
    "/interview/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a session",
    tags=["Interview"],
)
def delete_session(session_id: str):
    """Clean up a session. Idempotent — silently succeeds if already gone."""
    deleted = _session_store.delete(session_id)
    logger.info("Session deleted: %s", session_id)
    return {"ok": True, "deleted": deleted}


# ---------------------------------------------------------------------------
# Health and diagnostics
# ---------------------------------------------------------------------------

@app.get("/health", tags=["System"])
def health() -> dict:
    return {
        "status": "ok",
        "active_sessions": _session_store.count(),
        "question_bank_size": len(_question_bank.all()),
    }


@app.get("/metrics/bank", tags=["System"])
def question_bank_summary() -> dict:
    """Return a breakdown of available questions per metric and type."""
    from question_bank import Metric, QuestionType
    summary: dict[str, Any] = {}
    for m in Metric:
        questions = _question_bank.for_metric(m)
        by_type: dict[str, int] = {}
        for qt in QuestionType:
            by_type[qt.value] = sum(1 for q in questions if q.q_type == qt)
        summary[m.value] = {"total": len(questions), "by_type": by_type}
    return summary


# ---------------------------------------------------------------------------
# Entry point (for local development)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)
