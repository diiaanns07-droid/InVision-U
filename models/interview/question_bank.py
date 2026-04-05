"""
question_bank.py
----------------
Structured question repository for the adaptive AI interview system.

Design principles:
- Every question carries full metadata so the engine can make smart decisions
  without hardcoded if/else chains.
- Questions are tagged with expected signals so the analyzer knows what to look for.
- follow_up_triggers define *when* a question should be asked (e.g., only after
  the candidate gave a vague answer about ownership).
- depth levels enforce a probe → verify → challenge escalation path.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class Metric(str, Enum):
    LEADERSHIP  = "leadership"
    INITIATIVE  = "initiative"
    GROWTH      = "growth"
    MOTIVATION  = "motivation"
    VALUES      = "values"


class QuestionType(str, Enum):
    PROBE      = "probe"       # Open-ended, surface-level discovery
    VERIFY     = "verify"      # Requests concrete specifics
    CHALLENGE  = "challenge"   # Pressure-tests or stress-tests the answer
    REFLECT    = "reflect"     # Asks for meta-cognition / learning
    DILEMMA    = "dilemma"     # Values / ethics trade-off


class Depth(int, Enum):
    SURFACE = 1   # Always safe to ask first
    MEDIUM  = 2   # Ask after at least one probe
    DEEP    = 3   # Ask only when there is strong prior signal or a detected gap


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Question:
    id: str
    text: str
    metric: Metric
    q_type: QuestionType
    depth: Depth

    # Signals this question is designed to surface; used by the analyzer
    expected_signals: tuple[str, ...] = field(default_factory=tuple)

    # When non-empty, this question should only be asked if the candidate's
    # previous answer triggered at least one of these flags.
    follow_up_triggers: tuple[str, ...] = field(default_factory=tuple)

    # Free-form tags for deduplication / grouping
    tags: tuple[str, ...] = field(default_factory=tuple)

    def __hash__(self):
        return hash(self.id)


# ---------------------------------------------------------------------------
# Question definitions
# ---------------------------------------------------------------------------
# Notation for follow_up_triggers (matched against AnswerSignals flags):
#   "vague"           – answer lacked specifics
#   "no_ownership"    – candidate used "we" but never "I"
#   "no_result"       – no outcome was described
#   "no_reflection"   – no learning or retrospective
#   "contradiction"   – answer contradicts an earlier statement
#   "strong_claim"    – candidate made an impressive but unverified claim
#   "deflection"      – candidate redirected blame or credit
# ---------------------------------------------------------------------------

QUESTIONS: list[Question] = [

    # -----------------------------------------------------------------------
    # LEADERSHIP
    # -----------------------------------------------------------------------
    Question(
        id="lead_p1",
        text=(
            "Tell me about a time you led a team or initiative — "
            "formal or informal. What was your role and what did the group accomplish?"
        ),
        metric=Metric.LEADERSHIP,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("ownership", "result", "team_context"),
        tags=("opening", "leadership"),
    ),
    Question(
        id="lead_p2",
        text=(
            "Describe a moment when you had to make a decision that affected others "
            "without having all the information you wanted. How did you handle it?"
        ),
        metric=Metric.LEADERSHIP,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("decision_making", "uncertainty", "ownership"),
        tags=("leadership", "ambiguity"),
    ),
    Question(
        id="lead_v1",
        text=(
            "You mentioned leading that effort — "
            "how many people were involved, what was the timeline, "
            "and what was the measurable outcome?"
        ),
        metric=Metric.LEADERSHIP,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("specificity", "result", "scope"),
        follow_up_triggers=("vague", "strong_claim"),
        tags=("leadership", "specifics"),
    ),
    Question(
        id="lead_v2",
        text=(
            "Walk me through exactly how you resolved the disagreement — "
            "what was said, who was in the room, and what changed as a result?"
        ),
        metric=Metric.LEADERSHIP,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("specificity", "conflict_resolution", "result"),
        follow_up_triggers=("vague", "no_result"),
        tags=("leadership", "conflict"),
    ),
    Question(
        id="lead_c1",
        text=(
            "Imagine someone in your team consistently underperforms despite your feedback. "
            "The deadline is in two days. Walk me through what you do — step by step."
        ),
        metric=Metric.LEADERSHIP,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("decision_making", "ownership", "empathy", "prioritization"),
        tags=("leadership", "pressure", "hypothetical"),
    ),
    Question(
        id="lead_c2",
        text=(
            "Tell me about a time your leadership approach *failed* — "
            "not a near miss, but a genuine failure. What went wrong?"
        ),
        metric=Metric.LEADERSHIP,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("ownership", "reflection", "honesty"),
        tags=("leadership", "failure"),
    ),
    Question(
        id="lead_r1",
        text=(
            "Looking back at your experience leading others, "
            "what is the single biggest thing you'd do differently and why?"
        ),
        metric=Metric.LEADERSHIP,
        q_type=QuestionType.REFLECT,
        depth=Depth.MEDIUM,
        expected_signals=("reflection", "growth_mindset", "self_awareness"),
        tags=("leadership", "retrospective"),
    ),

    # -----------------------------------------------------------------------
    # INITIATIVE
    # -----------------------------------------------------------------------
    Question(
        id="init_p1",
        text=(
            "Tell me about something significant you started on your own — "
            "a project, a process, or a change — that nobody asked you to do."
        ),
        metric=Metric.INITIATIVE,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("ownership", "self_direction", "impact"),
        tags=("initiative", "opening"),
    ),
    Question(
        id="init_p2",
        text=(
            "Describe a situation where you identified a problem before anyone else "
            "noticed it. What did you do?"
        ),
        metric=Metric.INITIATIVE,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("observation", "action", "proactivity"),
        tags=("initiative", "problem_spotting"),
    ),
    Question(
        id="init_v1",
        text=(
            "How did you come to notice that problem, specifically? "
            "What data, conversation, or signal tipped you off?"
        ),
        metric=Metric.INITIATIVE,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("specificity", "observation", "analytical"),
        follow_up_triggers=("vague", "strong_claim"),
        tags=("initiative", "specifics"),
    ),
    Question(
        id="init_v2",
        text=(
            "What concrete steps did you take to move it forward, "
            "and what obstacles did you actually hit?"
        ),
        metric=Metric.INITIATIVE,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("action", "persistence", "result"),
        follow_up_triggers=("vague", "no_result"),
        tags=("initiative", "execution"),
    ),
    Question(
        id="init_c1",
        text=(
            "You're three months into a role. You spot a process that wastes significant "
            "time, but your manager disagrees it's a priority. What do you do?"
        ),
        metric=Metric.INITIATIVE,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("decision_making", "persuasion", "ownership", "judgment"),
        tags=("initiative", "pressure", "hypothetical"),
    ),
    Question(
        id="init_c2",
        text=(
            "Tell me about a time you pushed an idea that ultimately didn't work. "
            "Why did you push it, and what did you learn?"
        ),
        metric=Metric.INITIATIVE,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("ownership", "reflection", "honesty", "resilience"),
        tags=("initiative", "failure"),
    ),
    Question(
        id="init_r1",
        text=(
            "On a scale of 1–10, how proactive would your closest collaborators rate you? "
            "Give me a specific example that would back that rating up."
        ),
        metric=Metric.INITIATIVE,
        q_type=QuestionType.REFLECT,
        depth=Depth.MEDIUM,
        expected_signals=("self_awareness", "specificity", "ownership"),
        tags=("initiative", "self-rating"),
    ),

    # -----------------------------------------------------------------------
    # GROWTH
    # -----------------------------------------------------------------------
    Question(
        id="grow_p1",
        text=(
            "What's the hardest skill you've had to develop in the last two years? "
            "How did you actually go about building it?"
        ),
        metric=Metric.GROWTH,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("action", "self_direction", "specificity", "result"),
        tags=("growth", "opening"),
    ),
    Question(
        id="grow_p2",
        text=(
            "Tell me about a piece of feedback that genuinely changed how you work. "
            "What did you do differently as a result?"
        ),
        metric=Metric.GROWTH,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("reflection", "action", "growth_mindset"),
        tags=("growth", "feedback"),
    ),
    Question(
        id="grow_v1",
        text=(
            "How did you know you were improving — "
            "what did you track, measure, or observe?"
        ),
        metric=Metric.GROWTH,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("specificity", "analytical", "self_awareness"),
        follow_up_triggers=("vague", "no_result"),
        tags=("growth", "measurement"),
    ),
    Question(
        id="grow_v2",
        text=(
            "Who gave you that feedback, in what context, "
            "and how did you initially react to it?"
        ),
        metric=Metric.GROWTH,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("specificity", "emotional_regulation", "openness"),
        follow_up_triggers=("vague", "deflection"),
        tags=("growth", "feedback_reaction"),
    ),
    Question(
        id="grow_c1",
        text=(
            "Describe a situation where you realized mid-project that your approach was wrong "
            "and you needed to pivot. How did you handle the discomfort of being wrong?"
        ),
        metric=Metric.GROWTH,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("ownership", "adaptability", "emotional_regulation", "reflection"),
        tags=("growth", "adaptability", "pressure"),
    ),
    Question(
        id="grow_c2",
        text=(
            "What is a belief or working assumption you held for a long time "
            "that you were forced to abandon? What changed your mind?"
        ),
        metric=Metric.GROWTH,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("intellectual_honesty", "reflection", "growth_mindset"),
        tags=("growth", "belief_change"),
    ),
    Question(
        id="grow_r1",
        text=(
            "What area of your professional development are you most unsatisfied with right now, "
            "and what are you actively doing about it?"
        ),
        metric=Metric.GROWTH,
        q_type=QuestionType.REFLECT,
        depth=Depth.MEDIUM,
        expected_signals=("self_awareness", "action", "honesty"),
        tags=("growth", "current_gaps"),
    ),
    Question(
        id="grow_d1",
        text=(
            "You can either take a role that maximizes comfort and certainty, "
            "or one that will stretch you but carries real risk of failure. "
            "Which do you choose, and what's the reasoning behind it?"
        ),
        metric=Metric.GROWTH,
        q_type=QuestionType.DILEMMA,
        depth=Depth.DEEP,
        expected_signals=("risk_tolerance", "values", "growth_mindset"),
        tags=("growth", "values_test"),
    ),

    # -----------------------------------------------------------------------
    # MOTIVATION
    # -----------------------------------------------------------------------
    Question(
        id="motiv_p1",
        text=(
            "What kind of work makes you lose track of time? "
            "Give me a concrete recent example."
        ),
        metric=Metric.MOTIVATION,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("intrinsic_drive", "specificity", "passion"),
        tags=("motivation", "opening"),
    ),
    Question(
        id="motiv_p2",
        text=(
            "Why this field, why now? Walk me through how you arrived here — "
            "the honest version, not the polished one."
        ),
        metric=Metric.MOTIVATION,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("authenticity", "narrative", "purpose"),
        tags=("motivation", "origin_story"),
    ),
    Question(
        id="motiv_v1",
        text=(
            "You said you're passionate about X — "
            "what have you done in the last six months, on your own time, "
            "that shows that passion is real?"
        ),
        metric=Metric.MOTIVATION,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("specificity", "action", "intrinsic_drive"),
        follow_up_triggers=("strong_claim", "vague"),
        tags=("motivation", "actions_outside_work"),
    ),
    Question(
        id="motiv_v2",
        text=(
            "What's the least motivating thing you've had to do in a role, "
            "and how did you push through it?"
        ),
        metric=Metric.MOTIVATION,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("resilience", "self_management", "honesty"),
        follow_up_triggers=("strong_claim",),
        tags=("motivation", "low_points"),
    ),
    Question(
        id="motiv_c1",
        text=(
            "Six months in, the role turns out to be 60% tasks you don't enjoy. "
            "The team needs you. What do you do, and for how long?"
        ),
        metric=Metric.MOTIVATION,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("commitment", "resilience", "values", "honesty"),
        tags=("motivation", "pressure", "hypothetical"),
    ),
    Question(
        id="motiv_c2",
        text=(
            "Describe the lowest-motivation period of your career. "
            "What caused it and how did you get out of it?"
        ),
        metric=Metric.MOTIVATION,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("honesty", "resilience", "self_awareness", "reflection"),
        tags=("motivation", "trough"),
    ),
    Question(
        id="motiv_r1",
        text=(
            "In five years, what does success look like for you personally — "
            "not your resume, but how you feel about your work?"
        ),
        metric=Metric.MOTIVATION,
        q_type=QuestionType.REFLECT,
        depth=Depth.MEDIUM,
        expected_signals=("purpose", "clarity", "authenticity"),
        tags=("motivation", "future_vision"),
    ),

    # -----------------------------------------------------------------------
    # VALUES
    # -----------------------------------------------------------------------
    Question(
        id="val_p1",
        text=(
            "Tell me about a time you had to make a decision that was professionally "
            "costly but you believed was the right thing to do."
        ),
        metric=Metric.VALUES,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("integrity", "ownership", "cost_acceptance", "values"),
        tags=("values", "opening", "integrity"),
    ),
    Question(
        id="val_p2",
        text=(
            "What's a principle you hold that most people in your field would disagree with? "
            "Where does it come from?"
        ),
        metric=Metric.VALUES,
        q_type=QuestionType.PROBE,
        depth=Depth.SURFACE,
        expected_signals=("authenticity", "conviction", "self_awareness"),
        tags=("values", "conviction"),
    ),
    Question(
        id="val_v1",
        text=(
            "You mentioned that decision cost you something — "
            "what exactly was the cost, and do you still believe it was worth it?"
        ),
        metric=Metric.VALUES,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("specificity", "reflection", "integrity"),
        follow_up_triggers=("vague", "strong_claim"),
        tags=("values", "cost"),
    ),
    Question(
        id="val_v2",
        text=(
            "Has your understanding of that principle ever been tested "
            "and come up short? Tell me about it."
        ),
        metric=Metric.VALUES,
        q_type=QuestionType.VERIFY,
        depth=Depth.MEDIUM,
        expected_signals=("honesty", "intellectual_honesty", "reflection"),
        follow_up_triggers=("strong_claim",),
        tags=("values", "tested_belief"),
    ),
    Question(
        id="val_c1",
        text=(
            "You discover a close colleague is taking credit for a junior team member's work. "
            "The colleague is well-liked and influential. What do you do — specifically?"
        ),
        metric=Metric.VALUES,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("integrity", "courage", "decision_making", "empathy"),
        tags=("values", "pressure", "ethical_scenario"),
    ),
    Question(
        id="val_c2",
        text=(
            "Your manager asks you to stretch the truth in a report to make the team "
            "look better to leadership. It's a grey area legally. Walk me through "
            "what you do and say."
        ),
        metric=Metric.VALUES,
        q_type=QuestionType.CHALLENGE,
        depth=Depth.DEEP,
        expected_signals=("integrity", "courage", "communication", "ethics"),
        tags=("values", "ethics", "workplace_scenario"),
    ),
    Question(
        id="val_d1",
        text=(
            "You can take a high-paying role at a company whose product you find ethically "
            "questionable, or a lower-paying role whose mission you believe in. "
            "Your personal finances are tight. What do you do and why?"
        ),
        metric=Metric.VALUES,
        q_type=QuestionType.DILEMMA,
        depth=Depth.DEEP,
        expected_signals=("values", "authenticity", "self_awareness", "trade_off_reasoning"),
        tags=("values", "dilemma", "financial_pressure"),
    ),
    Question(
        id="val_d2",
        text=(
            "A team decision is made that you disagree with, but you've been outvoted. "
            "The team is counting on you to execute it fully. What do you do?"
        ),
        metric=Metric.VALUES,
        q_type=QuestionType.DILEMMA,
        depth=Depth.DEEP,
        expected_signals=("commitment", "integrity", "communication", "trade_off_reasoning"),
        tags=("values", "team_alignment", "autonomy"),
    ),
    Question(
        id="val_r1",
        text=(
            "What value do you think you compromise on most under pressure, "
            "and how are you working to address that?"
        ),
        metric=Metric.VALUES,
        q_type=QuestionType.REFLECT,
        depth=Depth.MEDIUM,
        expected_signals=("honesty", "self_awareness", "growth_mindset"),
        tags=("values", "vulnerability"),
    ),
]


# ---------------------------------------------------------------------------
# Question Bank
# ---------------------------------------------------------------------------

class QuestionBank:
    """
    Queryable repository of all interview questions.

    Lookup complexity is O(n) per filter call but n ≤ ~40 so this is fine
    for an MVP; replace with an indexed store for scale.
    """

    def __init__(self, questions: list[Question] | None = None) -> None:
        self._questions: list[Question] = questions or QUESTIONS
        self._by_id: dict[str, Question] = {q.id: q for q in self._questions}

    # ------------------------------------------------------------------
    # Primary API
    # ------------------------------------------------------------------

    def get(self, question_id: str) -> Question | None:
        return self._by_id.get(question_id)

    def all(self) -> list[Question]:
        return list(self._questions)

    def for_metric(self, metric: Metric) -> list[Question]:
        return [q for q in self._questions if q.metric == metric]

    def for_metric_and_type(self, metric: Metric, q_type: QuestionType) -> list[Question]:
        return [q for q in self._questions if q.metric == metric and q.q_type == q_type]

    def surface_probes(self) -> list[Question]:
        """Opening questions safe to ask without prior context."""
        return [
            q for q in self._questions
            if q.depth == Depth.SURFACE and q.q_type == QuestionType.PROBE
        ]

    def follow_ups_for(
        self,
        metric: Metric,
        triggered_flags: set[str],
        max_depth: Depth = Depth.DEEP,
        exclude_ids: set[str] | None = None,
    ) -> list[Question]:
        """
        Return candidate follow-up questions for a metric given the flags
        raised by the analyzer on the most recent answer.
        """
        exclude_ids = exclude_ids or set()
        candidates: list[Question] = []
        for q in self._questions:
            if q.id in exclude_ids:
                continue
            if q.metric != metric:
                continue
            if q.depth > max_depth:
                continue
            # If a question has no follow_up_triggers it is always eligible.
            # If it has triggers, at least one must match.
            if q.follow_up_triggers and not (set(q.follow_up_triggers) & triggered_flags):
                continue
            candidates.append(q)
        return candidates

    def sample_opener(
        self,
        metric: Metric,
        exclude_ids: set[str] | None = None,
    ) -> Question | None:
        """
        Pick a surface-level probe for a metric that hasn't been asked yet.
        Returns None if all openers for this metric have been exhausted.
        """
        exclude_ids = exclude_ids or set()
        pool = [
            q for q in self.surface_probes()
            if q.metric == metric and q.id not in exclude_ids
        ]
        return random.choice(pool) if pool else None

    def next_by_depth(
        self,
        metric: Metric,
        current_depth: Depth,
        exclude_ids: set[str] | None = None,
    ) -> Question | None:
        """
        Get the next question at the given depth (or shallower) for a metric,
        skipping already-asked IDs.
        """
        exclude_ids = exclude_ids or set()
        pool = [
            q for q in self._questions
            if q.metric == metric
            and q.depth <= current_depth
            and q.id not in exclude_ids
        ]
        if not pool:
            return None
        # Prefer shallower questions first; within same depth prefer verify over probe
        pool.sort(key=lambda q: (q.depth, q.q_type != QuestionType.VERIFY))
        return pool[0]
