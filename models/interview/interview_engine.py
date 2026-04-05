"""
interview_engine.py
-------------------
Core adaptive interview orchestrator.

Responsibilities:
1. Maintain full interview state (immutable snapshots for auditability).
2. Select the next best question using a priority function that weighs:
     - metric weakness (low score → high priority)
     - metric confidence deficit (low confidence → more questions needed)
     - depth escalation rules (probe first, then verify/challenge)
     - follow-up triggers fired by the last answer
     - question diversity (avoid clustering on one metric)
3. Decide when to stop (enough signal OR max questions reached).
4. Produce a structured final evaluation with per-metric scores,
   overall score, strengths, weaknesses, and a YES / NO / MAYBE recommendation.

Design principles:
- State is a pure dataclass → easy to serialize to JSON and store in DB.
- The engine itself is stateless (just methods); all state lives in InterviewState.
- No LLM dependency at runtime; LLM is injected into the analyzer only.
"""

from __future__ import annotations


import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from answer_analyzer import AnswerAnalyzer, AnswerScore, AnswerSignals
from question_bank import Depth, Metric, Question, QuestionBank, QuestionType


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class InterviewPhase(str, Enum):
    OPENING    = "opening"     # First 1–2 questions, broad probes
    EXPLORING  = "exploring"   # Filling metric gaps
    DEEPENING  = "deepening"   # Following up on weaknesses or strong claims
    CLOSING    = "closing"     # Final questions before evaluation
    COMPLETE   = "complete"    # Interview done


class Recommendation(str, Enum):
    YES   = "YES"
    NO    = "NO"
    MAYBE = "MAYBE"


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class EngineConfig:
    """Tuneable knobs for the interview engine."""

    # Hard bounds
    min_questions: int = 5
    max_questions: int = 15

    # Per-metric bounds
    min_questions_per_metric: int = 1
    max_questions_per_metric: int = 4

    # Stop early if all metrics hit this confidence threshold
    confidence_threshold: float = 0.70

    # A metric is considered "weak" if its current estimate is below this
    weakness_threshold: float = 2.5

    # How much weight to give the weakest metric vs. random exploration
    weakness_weight: float = 2.0

    # Minimum depth before we escalate to CHALLENGE questions
    challenge_min_prior_answers: int = 3

    # Score thresholds for final recommendation
    yes_threshold: float = 3.5
    no_threshold: float = 2.0

    # Metric weights for overall score computation
    metric_weights: dict[str, float] = field(default_factory=lambda: {
        Metric.LEADERSHIP.value:  1.2,
        Metric.INITIATIVE.value:  1.2,
        Metric.GROWTH.value:      1.0,
        Metric.MOTIVATION.value:  1.0,
        Metric.VALUES.value:      1.5,   # Values weighted heaviest for culture fit
    })


DEFAULT_CONFIG = EngineConfig()


# ---------------------------------------------------------------------------
# Per-metric state tracker
# ---------------------------------------------------------------------------

@dataclass
class MetricState:
    metric: Metric
    current_score: float = 0.0       # Best current estimate (0–5)
    confidence: float = 0.0          # How much we trust the score (0–1)
    questions_asked: int = 0
    question_ids_asked: set[str] = field(default_factory=set)
    scores: list[AnswerScore] = field(default_factory=list)
    flags_history: list[set[str]] = field(default_factory=list)

    @property
    def needs_more_signal(self) -> bool:
        return self.confidence < 0.70 and self.questions_asked < 4

    @property
    def is_weak(self) -> bool:
        return self.current_score < 2.5 and self.questions_asked >= 1

    @property
    def is_strong(self) -> bool:
        return self.current_score >= 4.0

    def latest_flags(self) -> set[str]:
        return self.flags_history[-1] if self.flags_history else set()

    def update(self, score: AnswerScore, signals: AnswerSignals, analyzer: AnswerAnalyzer) -> None:
        self.scores.append(score)
        self.question_ids_asked.add(score.question_id)
        self.questions_asked += 1
        self.flags_history.append(signals.to_flag_set())

        # Recompute aggregated score using confidence-weighted average
        new_score, new_confidence = analyzer.aggregate_scores(self.scores, self.metric)
        self.current_score = new_score
        self.confidence = new_confidence


# ---------------------------------------------------------------------------
# Full interview state
# ---------------------------------------------------------------------------

@dataclass
class TurnRecord:
    turn: int
    question_id: str
    question_text: str
    metric: Metric
    q_type: QuestionType
    phase: InterviewPhase
    strategy: str
    answer_text: str
    signals: AnswerSignals
    score: AnswerScore
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


@dataclass
class InterviewState:
    session_id: str
    candidate_id: str
    essay_summary: str = ""           # Passed in from essay evaluation model
    essay_weakness_metrics: list[str] = field(default_factory=list)  # Metrics flagged weak by essay

    phase: InterviewPhase = InterviewPhase.OPENING
    turn: int = 0
    complete: bool = False

    metric_states: dict[str, MetricState] = field(default_factory=dict)
    turns: list[TurnRecord] = field(default_factory=list)
    all_asked_ids: set[str] = field(default_factory=set)
    prior_answer_texts: list[str] = field(default_factory=list)

    # The current pending question (set by get_next_question, consumed by submit_answer)
    pending_question: Optional[Question] = None
    pending_strategy: str = ""
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def get_metric_state(self, metric: Metric) -> MetricState:
        key = metric.value
        if key not in self.metric_states:
            self.metric_states[key] = MetricState(metric=metric)
        return self.metric_states[key]

    def all_metric_states(self) -> list[MetricState]:
        return [self.get_metric_state(m) for m in Metric]

    def questions_asked_total(self) -> int:
        return len(self.all_asked_ids)

    def overall_confidence(self) -> float:
        states = self.all_metric_states()
        if not states:
            return 0.0
        return sum(s.confidence for s in states) / len(states)


# ---------------------------------------------------------------------------
# Final evaluation output
# ---------------------------------------------------------------------------

@dataclass
class MetricEvaluation:
    metric: str
    score: float        # 0–5
    confidence: float
    strengths: list[str]
    weaknesses: list[str]
    explanation: str
    evidence_count: int


@dataclass
class FinalEvaluation:
    session_id: str
    candidate_id: str

    metric_evaluations: list[MetricEvaluation]
    overall_score: float        # 0–5 weighted average
    strengths: list[str]
    weaknesses: list[str]
    recommendation: Recommendation
    recommendation_rationale: str
    total_questions: int
    total_turns: int
    interview_quality: str      # "HIGH" / "MEDIUM" / "LOW" based on coverage
    generated_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


# ---------------------------------------------------------------------------
# Question selection logic
# ---------------------------------------------------------------------------

def _compute_metric_priority(
    ms: MetricState,
    essay_weakness_metrics: list[str],
    config: EngineConfig,
) -> float:
    """
    Higher return value → higher priority for this metric.

    Factors:
    1. Weakness: score below threshold → boost priority
    2. Confidence deficit: low confidence → need more questions
    3. Essay signal: if essay flagged this metric as weak → boost
    4. Minimum coverage: if we've asked 0 questions → always boost
    """
    priority = 1.0

    # Never asked yet — always prioritize
    if ms.questions_asked == 0:
        priority += 3.0
        if ms.metric.value in essay_weakness_metrics:
            priority += 1.0
        return priority

    # Weakness penalty
    if ms.is_weak:
        deficit = max(0.0, config.weakness_threshold - ms.current_score)
        priority += deficit * config.weakness_weight

    # Confidence deficit
    confidence_gap = max(0.0, config.confidence_threshold - ms.confidence)
    priority += confidence_gap * 2.0

    # Essay-flagged weakness
    if ms.metric.value in essay_weakness_metrics:
        priority += 0.8

    # Diminishing returns: penalize metrics we've already asked a lot about
    priority -= ms.questions_asked * 0.3

    # Don't waste questions on metrics we're already confident and strong on
    if ms.is_strong and ms.confidence >= 0.75:
        priority = max(0.0, priority - 2.0)

    return max(0.0, priority)


def _select_question(
    state: InterviewState,
    bank: QuestionBank,
    config: EngineConfig,
) -> tuple[Question, str]:
    """
    Core selection algorithm. Returns (question, strategy_label).

    Strategy label is a human-readable string describing why this question
    was chosen — included in API responses for transparency / debugging.
    """
    # ------------------------------------------------------------------
    # Phase: OPENING — pick surface probes for unasked metrics
    # ------------------------------------------------------------------
    if state.phase == InterviewPhase.OPENING:
        for metric in Metric:
            ms = state.get_metric_state(metric)
            if ms.questions_asked == 0:
                q = bank.sample_opener(metric, exclude_ids=state.all_asked_ids)
                if q:
                    return q, f"opening_probe:{metric.value}"
        # All metrics have at least one question — transition phase
        state.phase = InterviewPhase.EXPLORING

    # ------------------------------------------------------------------
    # Phase: EXPLORING / DEEPENING — metric-priority selection
    # ------------------------------------------------------------------
    # Rank metrics by priority
    metric_priorities = sorted(
        [
            (metric, _compute_metric_priority(
                state.get_metric_state(metric),
                state.essay_weakness_metrics,
                config,
            ))
            for metric in Metric
        ],
        key=lambda x: x[1],
        reverse=True,
    )

    for target_metric, priority in metric_priorities:
        ms = state.get_metric_state(target_metric)

        # Skip if we've exhausted this metric's budget
        if ms.questions_asked >= config.max_questions_per_metric:
            continue

        latest_flags = ms.latest_flags()

        # ------------------------------------------------------------------
        # Strategy 1: Follow-up on flagged issues from last answer
        # ------------------------------------------------------------------
        if latest_flags & {"vague", "no_result", "no_ownership", "contradiction", "strong_claim"}:
            candidates = bank.follow_ups_for(
                metric=target_metric,
                triggered_flags=latest_flags,
                max_depth=_current_max_depth(state, config),
                exclude_ids=state.all_asked_ids,
            )
            if candidates:
                q = _pick_best_candidate(candidates, latest_flags)
                strategy = _describe_strategy(q, latest_flags, "follow_up")
                return q, strategy

        # ------------------------------------------------------------------
        # Strategy 2: Escalate depth if we have some signal
        # ------------------------------------------------------------------
        if ms.questions_asked >= 1:
            target_depth = _decide_depth(ms, state, config)
            q = bank.next_by_depth(
                metric=target_metric,
                current_depth=target_depth,
                exclude_ids=state.all_asked_ids,
            )
            if q:
                strategy = _describe_strategy(q, latest_flags, "escalate")
                return q, strategy

        # ------------------------------------------------------------------
        # Strategy 3: Surface probe (metric coverage)
        # ------------------------------------------------------------------
        q = bank.sample_opener(target_metric, exclude_ids=state.all_asked_ids)
        if q:
            return q, f"coverage_probe:{target_metric.value}"

    # ------------------------------------------------------------------
    # Fallback: pick any unasked question
    # ------------------------------------------------------------------
    for q in bank.all():
        if q.id not in state.all_asked_ids:
            return q, "fallback"

    # This should never be reached if max_questions < len(bank)
    raise RuntimeError("Question bank exhausted — increase bank size or reduce max_questions.")


def _current_max_depth(state: InterviewState, config: EngineConfig) -> Depth:
    total = state.questions_asked_total()
    if total < 2:
        return Depth.SURFACE
    if total < config.challenge_min_prior_answers:
        return Depth.MEDIUM
    return Depth.DEEP


def _decide_depth(ms: MetricState, state: InterviewState, config: EngineConfig) -> Depth:
    """Determine what depth of question to ask next for a metric."""
    max_depth = _current_max_depth(state, config)
    if ms.is_weak and max_depth >= Depth.MEDIUM:
        # Weak metric → verify with specifics first, then challenge
        return Depth.MEDIUM if ms.questions_asked < 2 else min(Depth.DEEP, max_depth)
    if ms.is_strong and max_depth >= Depth.DEEP:
        # Strong claim → challenge / dilemma to verify
        return Depth.DEEP
    return Depth.MEDIUM


def _pick_best_candidate(candidates: list[Question], flags: set[str]) -> Question:
    """
    From a list of follow-up candidates, pick the most targeted one.
    Prefer VERIFY for vagueness, CHALLENGE for strong claims, REFLECT for no_reflection.
    """
    type_priority: dict[str, int] = {}
    if "vague" in flags or "no_result" in flags:
        type_priority[QuestionType.VERIFY] = 10
    if "strong_claim" in flags:
        type_priority[QuestionType.CHALLENGE] = 10
    if "no_reflection" in flags:
        type_priority[QuestionType.REFLECT] = 8
    if "contradiction" in flags:
        type_priority[QuestionType.VERIFY] = 12

    def score(q: Question) -> int:
        return type_priority.get(q.q_type, 0) - q.depth  # prefer shallower of same type

    return max(candidates, key=score)


def _describe_strategy(q: Question, flags: set[str], mode: str) -> str:
    parts = [f"{mode}:{q.metric.value}:{q.q_type.value}:depth{q.depth}"]
    if flags:
        triggered = sorted(flags & {"vague", "no_result", "no_ownership",
                                    "strong_claim", "contradiction", "deflection"})
        if triggered:
            parts.append(f"triggered_by={','.join(triggered)}")
    return "|".join(parts)


# ---------------------------------------------------------------------------
# Stopping criteria
# ---------------------------------------------------------------------------

def _should_stop(state: InterviewState, config: EngineConfig) -> tuple[bool, str]:
    """
    Returns (should_stop, reason).
    Checks multiple criteria in priority order.
    """
    total = state.questions_asked_total()

    if total >= config.max_questions:
        return True, "max_questions_reached"

    if total < config.min_questions:
        return False, "below_min"

    # All metrics have minimum coverage
    all_covered = all(
        state.get_metric_state(m).questions_asked >= config.min_questions_per_metric
        for m in Metric
    )
    if not all_covered:
        return False, "insufficient_coverage"

    # High overall confidence across all metrics
    all_confident = all(
        state.get_metric_state(m).confidence >= config.confidence_threshold
        for m in Metric
    )
    if all_confident:
        return True, "confidence_threshold_met"

    # No remaining questions available
    bank_ids = {q.id for q in QuestionBank().all()}
    if state.all_asked_ids >= bank_ids:
        return True, "bank_exhausted"

    return False, "continuing"


# ---------------------------------------------------------------------------
# Final evaluation builder
# ---------------------------------------------------------------------------

STRENGTH_LABELS = {
    "ownership": "Takes clear personal ownership",
    "result": "Describes concrete outcomes",
    "action": "Details specific actions taken",
    "reflection": "Demonstrates reflective thinking",
    "quantification": "Backs claims with data/metrics",
    "emotional_honesty": "Shows emotional self-awareness",
    "empathy": "Demonstrates empathy for others",
}

WEAKNESS_LABELS = {
    "vague": "Answers lack concrete specifics",
    "deflection": "Tends to deflect credit/blame to team",
    "no_result": "Rarely describes measurable outcomes",
    "no_reflection": "Limited self-reflection evident",
    "very_short": "Answers were underdeveloped",
    "contradiction": "Inconsistencies detected across answers",
    "no_ownership": "Lacks personal ownership language",
}


def _build_metric_evaluation(
    ms: MetricState,
    analyzer: AnswerAnalyzer,
) -> MetricEvaluation:
    all_pos: dict[str, int] = {}
    all_neg: dict[str, int] = {}

    for sc in ms.scores:
        for p in sc.positive_signals:
            all_pos[p] = all_pos.get(p, 0) + 1
        for n in sc.negative_signals:
            all_neg[n] = all_neg.get(n, 0) + 1

    # Top 3 most-consistent signals
    top_strengths = [
        STRENGTH_LABELS[k] for k, _ in sorted(all_pos.items(), key=lambda x: -x[1])
        if k in STRENGTH_LABELS
    ][:3]
    top_weaknesses = [
        WEAKNESS_LABELS[k] for k, _ in sorted(all_neg.items(), key=lambda x: -x[1])
        if k in WEAKNESS_LABELS
    ][:3]

    # Build explanation from score trajectory
    score = ms.current_score
    if score >= 4.0:
        quality = "consistently strong"
    elif score >= 3.0:
        quality = "solid with room to grow"
    elif score >= 2.0:
        quality = "mixed — some signals present but significant gaps remain"
    else:
        quality = "weak — insufficient evidence of this quality"

    explanation = (
        f"{ms.metric.value.capitalize()}: {quality}. "
        f"Based on {ms.questions_asked} question(s). "
    )
    if ms.scores:
        last = ms.scores[-1]
        if last.explanation:
            explanation += f" Latest evidence: {last.explanation}"

    return MetricEvaluation(
        metric=ms.metric.value,
        score=round(ms.current_score, 2),
        confidence=round(ms.confidence, 3),
        strengths=top_strengths,
        weaknesses=top_weaknesses,
        explanation=explanation,
        evidence_count=ms.questions_asked,
    )


def _compute_overall_score(
    evaluations: list[MetricEvaluation],
    config: EngineConfig,
) -> float:
    total_weight = 0.0
    weighted_sum = 0.0
    for ev in evaluations:
        w = config.metric_weights.get(ev.metric, 1.0)
        weighted_sum += ev.score * w
        total_weight += w
    if total_weight == 0:
        return 0.0
    return round(weighted_sum / total_weight, 2)


def _make_recommendation(
    overall_score: float,
    evaluations: list[MetricEvaluation],
    config: EngineConfig,
) -> tuple[Recommendation, str]:
    # Hard NO: values score below 1.5 regardless of overall
    values_eval = next((e for e in evaluations if e.metric == Metric.VALUES.value), None)
    if values_eval and values_eval.score < 1.5:
        return (
            Recommendation.NO,
            f"Values score is critically low ({values_eval.score}/5). "
            "Regardless of other metrics, cultural alignment is a prerequisite.",
        )

    # Overall scoring
    if overall_score >= config.yes_threshold:
        weak = [e for e in evaluations if e.score < 2.5]
        if weak:
            weak_names = ", ".join(e.metric for e in weak)
            return (
                Recommendation.MAYBE,
                f"Overall strong candidate (score: {overall_score}/5), but notable gaps in: "
                f"{weak_names}. Consider targeted follow-up or probationary period.",
            )
        return (
            Recommendation.YES,
            f"Strong candidate across all dimensions (overall: {overall_score}/5). "
            "Recommend advancing to next stage.",
        )

    if overall_score >= config.no_threshold:
        return (
            Recommendation.MAYBE,
            f"Mixed profile (overall: {overall_score}/5). "
            "Sufficient signal for some metrics but significant gaps remain. "
            "Recommend panel review before decision.",
        )

    return (
        Recommendation.NO,
        f"Insufficient evidence of required competencies (overall: {overall_score}/5). "
        "Score below minimum threshold across multiple dimensions.",
    )


def _interview_quality_label(state: InterviewState, config: EngineConfig) -> str:
    total = state.questions_asked_total()
    all_confident = all(
        state.get_metric_state(m).confidence >= config.confidence_threshold
        for m in Metric
    )
    if all_confident and total >= config.min_questions:
        return "HIGH"
    if total >= config.min_questions:
        return "MEDIUM"
    return "LOW"


# ---------------------------------------------------------------------------
# Interview Engine
# ---------------------------------------------------------------------------

class InterviewEngine:
    """
    Stateless orchestrator for adaptive interviews.

    All mutable state lives in InterviewState. The engine mutates the state
    object in-place so the caller owns the state lifecycle (e.g., can persist
    it to a database between HTTP requests).
    """

    def __init__(
        self,
        bank: QuestionBank | None = None,
        analyzer: AnswerAnalyzer | None = None,
        config: EngineConfig | None = None,
    ) -> None:
        self.bank     = bank     or QuestionBank()
        self.analyzer = analyzer or AnswerAnalyzer()
        self.config   = config   or DEFAULT_CONFIG

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create_session(
        self,
        candidate_id: str,
        essay_summary: str = "",
        essay_weakness_metrics: list[str] | None = None,
    ) -> InterviewState:
        """Initialize a new interview session."""
        return InterviewState(
            session_id=str(uuid.uuid4()),
            candidate_id=candidate_id,
            essay_summary=essay_summary,
            essay_weakness_metrics=essay_weakness_metrics or [],
        )

    def get_next_question(
        self, state: InterviewState
    ) -> dict:
        """
        Select and return the next question to ask.
        Sets state.pending_question so submit_answer can cross-reference it.

        Returns a dict suitable for JSON serialization.
        """
        if state.complete:
            raise ValueError("Interview is already complete. Call get_final_evaluation().")

        should_stop, reason = _should_stop(state, self.config)
        if should_stop:
            state.complete = True
            state.phase = InterviewPhase.COMPLETE
            return {
                "status": "complete",
                "reason": reason,
                "message": "Interview complete. Call /evaluation to retrieve results.",
            }

        question, strategy = _select_question(state, self.bank, self.config)
        state.pending_question = question
        state.pending_strategy = strategy

        # Update phase based on total questions asked
        total = state.questions_asked_total()
        if total == 0:
            state.phase = InterviewPhase.OPENING
        elif total < 4:
            state.phase = InterviewPhase.EXPLORING
        elif total < self.config.max_questions - 2:
            state.phase = InterviewPhase.DEEPENING
        else:
            state.phase = InterviewPhase.CLOSING

        return {
            "status": "ongoing",
            "session_id": state.session_id,
            "turn": state.turn + 1,
            "phase": state.phase.value,
            "question": {
                "id": question.id,
                "text": question.text,
                "metric": question.metric.value,
                "type": question.q_type.value,
                "depth": question.depth.value,
            },
            "strategy": strategy,
            "progress": {
                "questions_asked": state.questions_asked_total(),
                "max_questions": self.config.max_questions,
                "overall_confidence": round(state.overall_confidence(), 3),
            },
        }

    def submit_answer(
        self, state: InterviewState, answer_text: str
    ) -> dict:
        """
        Process the candidate's answer to the pending question.
        Updates metric state and returns immediate feedback for the API layer.

        Returns a dict with signals and scores (useful for real-time dashboards).
        """
        if state.pending_question is None:
            raise ValueError("No pending question. Call get_next_question() first.")

        question = state.pending_question
        signals, score = self.analyzer.analyze(
            question=question,
            answer_text=answer_text,
            prior_answers=state.prior_answer_texts,
        )

        # Update state
        ms = state.get_metric_state(question.metric)
        ms.update(score, signals, self.analyzer)

        state.all_asked_ids.add(question.id)
        state.prior_answer_texts.append(answer_text)
        state.turn += 1

        state.turns.append(TurnRecord(
            turn=state.turn,
            question_id=question.id,
            question_text=question.text,
            metric=question.metric,
            q_type=question.q_type,
            phase=state.phase,
            strategy=state.pending_strategy,
            answer_text=answer_text,
            signals=signals,
            score=score,
        ))

        state.pending_question = None
        state.pending_strategy = ""

        return {
            "turn": state.turn,
            "metric": question.metric.value,
            "score": score.final_score,
            "confidence": score.confidence,
            "flags": sorted(signals.to_flag_set()),
            "explanation": score.explanation,
            "metric_running_score": round(ms.current_score, 2),
        }

    def get_final_evaluation(self, state: InterviewState) -> FinalEvaluation:
        """
        Build and return the structured final evaluation.
        Can be called at any point but is most meaningful after interview completes.
        """
        evaluations = [
            _build_metric_evaluation(state.get_metric_state(m), self.analyzer)
            for m in Metric
        ]

        overall_score = _compute_overall_score(evaluations, self.config)
        recommendation, rationale = _make_recommendation(
            overall_score, evaluations, self.config
        )

        # Aggregate strengths and weaknesses across all metrics
        all_strengths: list[str] = []
        all_weaknesses: list[str] = []
        for ev in evaluations:
            if ev.score >= 3.5:
                all_strengths.extend(
                    [f"[{ev.metric}] {s}" for s in ev.strengths[:2]]
                )
            if ev.score < 2.5:
                all_weaknesses.extend(
                    [f"[{ev.metric}] {w}" for w in ev.weaknesses[:2]]
                )

        return FinalEvaluation(
            session_id=state.session_id,
            candidate_id=state.candidate_id,
            metric_evaluations=evaluations,
            overall_score=overall_score,
            strengths=all_strengths[:6],
            weaknesses=all_weaknesses[:6],
            recommendation=recommendation,
            recommendation_rationale=rationale,
            total_questions=state.questions_asked_total(),
            total_turns=state.turn,
            interview_quality=_interview_quality_label(state, self.config),
        )
