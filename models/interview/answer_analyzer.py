"""
answer_analyzer.py
------------------
Rule-based answer analysis engine.

Responsibilities:
1. Extract structured signals from raw text (STAR components, ownership,
   specificity, reflection, contradictions, vagueness).
2. Score the answer against a target metric on a 0–5 scale.
3. Return a confidence value so the interview engine knows when it has
   collected enough evidence.
4. Flag issues that should trigger follow-up questions.

Design choices:
- Pure Python, no ML dependencies required for the rule layer.
- Each signal detector is an isolated function → easy to unit-test and
  replace with an LLM call later.
- Scoring is additive with per-signal weights; weights are dataclass fields
  so they can be tuned without touching logic.
- The LLM integration hook is explicit: if an `llm_scorer` is injected into
  AnswerAnalyzer, it is called and its output is blended with the rule score.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable, Optional

from question_bank import Metric, Question, QuestionType


# ---------------------------------------------------------------------------
# Signal vocabulary — every flag the engine can produce
# ---------------------------------------------------------------------------

# Flags that represent detected problems / gaps
NEGATIVE_FLAGS = frozenset({
    "vague",
    "no_ownership",
    "no_result",
    "no_reflection",
    "no_action",
    "contradiction",
    "deflection",
    "very_short",
})

# Flags that represent positive/strong signals
POSITIVE_FLAGS = frozenset({
    "specificity",
    "ownership",
    "result",
    "reflection",
    "action",
    "strong_claim",
    "quantified",
    "emotional_honesty",
    "empathy_signal",
})


# ---------------------------------------------------------------------------
# Word / phrase lists (extend these as you gather more data)
# ---------------------------------------------------------------------------

# Strong first-person ownership markers
_OWNERSHIP_PHRASES = [
    r"\bI\s+(?:decided|initiated|led|built|created|proposed|drove|started|launched|"
    r"implemented|designed|managed|organized|took|owned|was responsible)\b",
]

# Deflection / "we" over-use
_DEFLECTION_PHRASES = [
    r"\b(?:we|the team|our team|everyone)\b",
]

# Result / outcome indicators
_RESULT_PHRASES = [
    r"\b(?:result(?:ed)?|outcome|achieved|accomplished|delivered|improved|"
    r"increased|decreased|reduced|grew|saved|generated|impact)\b",
]

# Quantified claims (numbers, percentages, currencies)
_QUANTIFIED_PATTERNS = [
    r"\b\d+\s*(?:%|percent|x|times|k|K|M|B|hours?|days?|weeks?|months?|users?|"
    r"customers?|people|members?|dollars?|\$)\b",
    r"\$\s*\d+",
]

# Reflection / learning language
_REFLECTION_PHRASES = [
    r"\b(?:learned|realized|understood|in retrospect|looking back|now I|"
    r"changed my|would do differently|mistake|lesson|insight|growth)\b",
]

# Action verbs (STAR → Action component)
_ACTION_PHRASES = [
    r"\b(?:I\s+)?(?:built|created|wrote|coded|designed|shipped|deployed|ran|"
    r"contacted|organized|presented|negotiated|convinced|proposed|researched|"
    r"analyzed|fixed|resolved|escalated|hired|trained|coached|mentored|"
    r"restructured|simplified|automated|reviewed)\b",
]

# Vagueness indicators
_VAGUENESS_PHRASES = [
    r"\b(?:kind of|sort of|basically|generally|usually|sometimes|"
    r"things|stuff|various|some|certain|pretty|quite|a bit|tried to|"
    r"helped with|involved in|part of)\b",
]

# Emotional honesty / vulnerability (positive for growth/values)
_EMOTIONAL_HONESTY_PHRASES = [
    r"\b(?:honestly|to be honest|truth is|I struggled|I was scared|"
    r"I felt|I doubted|I didn't know|I was wrong|I failed|I made a mistake)\b",
]

# Empathy signals (useful for leadership/values)
_EMPATHY_PHRASES = [
    r"\b(?:understood how they felt|put myself in|their perspective|"
    r"they were (?:feeling|struggling|worried|frustrated)|"
    r"listen(?:ed)? to|heard them out|acknowledged)\b",
]


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------

@dataclass
class AnswerSignals:
    """
    Structured extraction from one answer.
    All boolean flags map to entries in POSITIVE_FLAGS / NEGATIVE_FLAGS.
    """
    raw_text: str
    word_count: int = 0

    # Presence flags
    has_ownership: bool = False        # Clear "I did X" statements
    has_result: bool = False           # Described an outcome
    has_action: bool = False           # Described concrete actions
    has_reflection: bool = False       # Showed learning or meta-cognition
    has_quantification: bool = False   # Numbers / metrics cited
    has_emotional_honesty: bool = False
    has_empathy: bool = False

    # Problem flags
    is_vague: bool = False
    is_deflecting: bool = False        # Over-relies on "we"
    is_very_short: bool = False        # < 30 words
    has_contradiction: bool = False    # Detected against prior answers

    # Counts
    ownership_count: int = 0
    deflection_count: int = 0
    vagueness_count: int = 0
    quantification_count: int = 0

    # Derived
    strong_claim: bool = False         # High ownership + quantification

    def to_flag_set(self) -> set[str]:
        """Convert to the set of string flags the engine uses for routing."""
        flags: set[str] = set()
        if self.has_ownership:      flags.add("ownership")
        if self.has_result:         flags.add("result")
        if self.has_action:         flags.add("action")
        if self.has_reflection:     flags.add("reflection")
        if self.has_quantification: flags.add("quantified")
        if self.has_emotional_honesty: flags.add("emotional_honesty")
        if self.has_empathy:        flags.add("empathy_signal")
        if self.strong_claim:       flags.add("strong_claim")

        if self.is_vague:           flags.add("vague")
        if self.is_deflecting:      flags.add("deflection")
        if self.is_very_short:      flags.add("very_short")
        if not self.has_ownership:  flags.add("no_ownership")
        if not self.has_result:     flags.add("no_result")
        if not self.has_action:     flags.add("no_action")
        if not self.has_reflection: flags.add("no_reflection")
        if self.has_contradiction:  flags.add("contradiction")
        return flags


@dataclass
class AnswerScore:
    """
    Result of scoring one answer against a target metric.
    """
    metric: Metric
    question_id: str

    # 0.0 – 5.0 rule-based score
    rule_score: float = 0.0

    # 0.0 – 5.0 optional LLM score (blended in if available)
    llm_score: Optional[float] = None

    # Final blended score exposed to the engine
    final_score: float = 0.0

    # 0.0 – 1.0: how confident we are in this score
    confidence: float = 0.0

    # Which signals fired
    positive_signals: list[str] = field(default_factory=list)
    negative_signals: list[str] = field(default_factory=list)

    # Human-readable explanation
    explanation: str = ""


@dataclass
class ScoringWeights:
    """
    Per-signal contribution to the raw score.
    Separate weight sets per metric let us bias toward what matters most.
    """
    ownership: float = 1.0
    result: float = 1.0
    action: float = 0.8
    reflection: float = 0.7
    quantification: float = 0.5
    emotional_honesty: float = 0.5
    empathy: float = 0.3

    # Penalties
    vagueness_penalty: float = 0.4      # per vague phrase detected
    deflection_penalty: float = 0.3     # per deflection phrase
    very_short_penalty: float = 1.5
    contradiction_penalty: float = 2.0


# Metric-specific weight overrides
METRIC_WEIGHTS: dict[Metric, ScoringWeights] = {
    Metric.LEADERSHIP: ScoringWeights(
        ownership=1.2, result=1.0, empathy=0.8, reflection=0.6,
    ),
    Metric.INITIATIVE: ScoringWeights(
        ownership=1.3, action=1.2, result=1.0, reflection=0.4,
    ),
    Metric.GROWTH: ScoringWeights(
        reflection=1.5, emotional_honesty=0.8, result=0.7, ownership=0.8,
    ),
    Metric.MOTIVATION: ScoringWeights(
        emotional_honesty=1.2, ownership=0.8, reflection=0.7, action=0.5,
    ),
    Metric.VALUES: ScoringWeights(
        emotional_honesty=1.0, ownership=1.0, empathy=0.9, reflection=0.8,
    ),
}


# ---------------------------------------------------------------------------
# Signal extractors (each is a pure function — easy to unit-test or replace)
# ---------------------------------------------------------------------------

def _count_pattern_matches(text: str, patterns: list[str]) -> int:
    count = 0
    for pat in patterns:
        count += len(re.findall(pat, text, re.IGNORECASE))
    return count


def extract_signals(
    answer_text: str,
    prior_answers: list[str] | None = None,
) -> AnswerSignals:
    """
    Parse a raw answer into structured AnswerSignals.

    Args:
        answer_text:   The candidate's raw answer string.
        prior_answers: All previous answers in this session, used for
                       contradiction detection.
    """
    text = answer_text.strip()
    words = text.split()
    word_count = len(words)

    sig = AnswerSignals(raw_text=text, word_count=word_count)

    # ------------------------------------------------------------------
    # Short-circuit: very short answers are almost always low quality
    # ------------------------------------------------------------------
    if word_count < 30:
        sig.is_very_short = True
        sig.is_vague = True
        return sig

    # ------------------------------------------------------------------
    # Ownership vs deflection
    # ------------------------------------------------------------------
    sig.ownership_count = _count_pattern_matches(text, _OWNERSHIP_PHRASES)
    sig.deflection_count = _count_pattern_matches(text, _DEFLECTION_PHRASES)
    sig.has_ownership = sig.ownership_count >= 1

    # Deflection: if "we" appears more than 3× as often as "I did/led/…"
    if sig.deflection_count > 0 and sig.ownership_count == 0:
        sig.is_deflecting = True
    elif sig.deflection_count > 0 and (sig.deflection_count / max(sig.ownership_count, 1)) > 3:
        sig.is_deflecting = True

    # ------------------------------------------------------------------
    # Result / action
    # ------------------------------------------------------------------
    sig.has_result = _count_pattern_matches(text, _RESULT_PHRASES) >= 1
    sig.has_action = _count_pattern_matches(text, _ACTION_PHRASES) >= 1

    # ------------------------------------------------------------------
    # Quantification
    # ------------------------------------------------------------------
    sig.quantification_count = _count_pattern_matches(text, _QUANTIFIED_PATTERNS)
    sig.has_quantification = sig.quantification_count >= 1

    # ------------------------------------------------------------------
    # Reflection
    # ------------------------------------------------------------------
    sig.has_reflection = _count_pattern_matches(text, _REFLECTION_PHRASES) >= 1

    # ------------------------------------------------------------------
    # Vagueness
    # ------------------------------------------------------------------
    sig.vagueness_count = _count_pattern_matches(text, _VAGUENESS_PHRASES)
    # Vague if many hedge words relative to length, or no specifics at all
    vague_density = sig.vagueness_count / max(word_count / 20, 1)
    sig.is_vague = vague_density > 2.0 or (
        not sig.has_result
        and not sig.has_action
        and not sig.has_quantification
    )

    # ------------------------------------------------------------------
    # Emotional honesty / empathy
    # ------------------------------------------------------------------
    sig.has_emotional_honesty = _count_pattern_matches(text, _EMOTIONAL_HONESTY_PHRASES) >= 1
    sig.has_empathy = _count_pattern_matches(text, _EMPATHY_PHRASES) >= 1

    # ------------------------------------------------------------------
    # Strong claim: high ownership + quantification without vagueness
    # ------------------------------------------------------------------
    sig.strong_claim = (
        sig.ownership_count >= 2
        and sig.has_quantification
        and not sig.is_vague
    )

    # ------------------------------------------------------------------
    # Contradiction detection (lightweight: keyword overlap heuristic)
    # ------------------------------------------------------------------
    if prior_answers:
        sig.has_contradiction = _detect_contradiction(text, prior_answers)

    return sig


def _detect_contradiction(current: str, prior_answers: list[str]) -> bool:
    """
    Lightweight contradiction check: look for direct negations of key claims
    made in prior answers.

    This is intentionally simple for the rule-based layer. The LLM layer
    handles semantic contradictions.
    """
    negation_pairs = [
        (r"\bnever\b", r"\balways\b"),
        (r"\bno one\b", r"\beveryone\b"),
        (r"\bnot responsible\b", r"\bresponsible\b"),
        (r"\bdidn't lead\b", r"\bled\b"),
        (r"\bnot my decision\b", r"\bmy decision\b"),
    ]
    for prior in prior_answers[-3:]:  # Check against last 3 answers only
        for neg_pat, pos_pat in negation_pairs:
            current_has_neg = bool(re.search(neg_pat, current, re.IGNORECASE))
            current_has_pos = bool(re.search(pos_pat, current, re.IGNORECASE))
            prior_has_neg = bool(re.search(neg_pat, prior, re.IGNORECASE))
            prior_has_pos = bool(re.search(pos_pat, prior, re.IGNORECASE))

            if (current_has_neg and prior_has_pos) or (current_has_pos and prior_has_neg):
                return True
    return False


# ---------------------------------------------------------------------------
# Scorer
# ---------------------------------------------------------------------------

def _compute_rule_score(
    signals: AnswerSignals,
    weights: ScoringWeights,
) -> tuple[float, list[str], list[str]]:
    """
    Additive scoring against weights. Returns (raw_score, pos_flags, neg_flags).
    The raw score is then clamped to [0, 5].
    """
    score = 0.0
    positive: list[str] = []
    negative: list[str] = []

    if signals.has_ownership:
        score += weights.ownership
        positive.append("ownership")
    if signals.has_result:
        score += weights.result
        positive.append("result")
    if signals.has_action:
        score += weights.action
        positive.append("action")
    if signals.has_reflection:
        score += weights.reflection
        positive.append("reflection")
    if signals.has_quantification:
        score += weights.quantification
        positive.append("quantification")
    if signals.has_emotional_honesty:
        score += weights.emotional_honesty
        positive.append("emotional_honesty")
    if signals.has_empathy:
        score += weights.empathy
        positive.append("empathy")

    # Penalties
    if signals.is_very_short:
        score -= weights.very_short_penalty
        negative.append("very_short")
    if signals.is_vague:
        score -= signals.vagueness_count * weights.vagueness_penalty
        negative.append("vague")
    if signals.is_deflecting:
        score -= signals.deflection_count * weights.deflection_penalty
        negative.append("deflection")
    if signals.has_contradiction:
        score -= weights.contradiction_penalty
        negative.append("contradiction")

    return max(0.0, min(5.0, score)), positive, negative


def _compute_confidence(
    signals: AnswerSignals,
    question: Question,
    has_llm: bool = False,
) -> float:
    """
    Confidence reflects how much signal we actually got from this answer.

    High confidence = many expected signals fired, long answer, no vagueness.
    Low confidence  = short, vague, or contradictory answer.
    """
    base = 0.3

    # Length bonus
    if signals.word_count >= 150:
        base += 0.3
    elif signals.word_count >= 80:
        base += 0.15

    # Signal hit rate against expected signals
    flag_set = signals.to_flag_set()
    if question.expected_signals:
        hit_rate = len(
            set(question.expected_signals) & (flag_set - NEGATIVE_FLAGS)
        ) / len(question.expected_signals)
        base += hit_rate * 0.3

    # Penalties
    if signals.is_very_short:
        base -= 0.2
    if signals.is_vague:
        base -= 0.15
    if signals.is_deflecting:
        base -= 0.1
    if signals.has_contradiction:
        base -= 0.2

    # LLM confirmation bonus
    if has_llm:
        base += 0.1

    return round(max(0.0, min(1.0, base)), 3)


def _build_explanation(
    metric: Metric,
    signals: AnswerSignals,
    score: float,
    pos: list[str],
    neg: list[str],
) -> str:
    parts: list[str] = []
    if score >= 4.0:
        parts.append(f"Strong response for {metric.value}.")
    elif score >= 2.5:
        parts.append(f"Adequate response for {metric.value}.")
    else:
        parts.append(f"Weak response for {metric.value}.")

    if pos:
        parts.append(f"Detected: {', '.join(pos)}.")
    if neg:
        parts.append(f"Missing or problematic: {', '.join(neg)}.")
    if signals.is_vague:
        parts.append("Answer lacked concrete specifics.")
    if signals.is_deflecting:
        parts.append("Candidate deflected ownership to the team.")
    if signals.has_contradiction:
        parts.append("Possible contradiction with earlier answers detected.")

    return " ".join(parts)


# ---------------------------------------------------------------------------
# Main Analyzer class
# ---------------------------------------------------------------------------

class AnswerAnalyzer:
    """
    Analyzes a candidate's answer to produce a structured AnswerScore.

    LLM injection:
        Pass a callable as `llm_scorer` to blend LLM judgment with rules:
            llm_scorer(question_text: str, answer_text: str, metric: str) -> float
        The function should return a score in [0, 5]. If it raises an exception
        the rule score is used alone.
    """

    def __init__(
        self,
        llm_scorer: Optional[Callable[[str, str, str], float]] = None,
        llm_weight: float = 0.4,
    ) -> None:
        self._llm_scorer = llm_scorer
        # How much the LLM score is blended in (0 = ignore, 1 = replace)
        self._llm_weight = min(max(llm_weight, 0.0), 1.0)

    def analyze(
        self,
        question: Question,
        answer_text: str,
        prior_answers: list[str] | None = None,
    ) -> tuple[AnswerSignals, AnswerScore]:
        """
        Main entry point. Returns (signals, score).

        signals: raw extracted features (used by the engine for routing)
        score:   final metric score for this answer
        """
        signals = extract_signals(answer_text, prior_answers)
        weights = METRIC_WEIGHTS.get(question.metric, ScoringWeights())

        rule_score, pos_flags, neg_flags = _compute_rule_score(signals, weights)

        # ------------------------------------------------------------------
        # Optional LLM scoring
        # ------------------------------------------------------------------
        llm_score: Optional[float] = None
        if self._llm_scorer is not None:
            try:
                llm_score = float(
                    self._llm_scorer(question.text, answer_text, question.metric.value)
                )
                llm_score = max(0.0, min(5.0, llm_score))
            except Exception:
                llm_score = None  # Graceful degradation

        # ------------------------------------------------------------------
        # Blend scores
        # ------------------------------------------------------------------
        if llm_score is not None:
            final_score = (
                rule_score * (1 - self._llm_weight)
                + llm_score * self._llm_weight
            )
        else:
            final_score = rule_score

        final_score = round(max(0.0, min(5.0, final_score)), 2)

        confidence = _compute_confidence(
            signals, question, has_llm=(llm_score is not None)
        )

        score = AnswerScore(
            metric=question.metric,
            question_id=question.id,
            rule_score=round(rule_score, 2),
            llm_score=round(llm_score, 2) if llm_score is not None else None,
            final_score=final_score,
            confidence=confidence,
            positive_signals=pos_flags,
            negative_signals=neg_flags,
            explanation=_build_explanation(
                question.metric, signals, final_score, pos_flags, neg_flags
            ),
        )

        return signals, score

    def aggregate_scores(
        self,
        scores: list[AnswerScore],
        metric: Metric,
    ) -> tuple[float, float]:
        """
        Aggregate multiple AnswerScores for a single metric into a
        (weighted_average_score, total_confidence) pair.

        Confidence-weighted averaging: answers where we have high confidence
        pull the metric score more than low-confidence answers.
        """
        relevant = [s for s in scores if s.metric == metric]
        if not relevant:
            return 0.0, 0.0

        total_weight = sum(s.confidence for s in relevant)
        if total_weight == 0:
            # Fall back to simple average
            avg = sum(s.final_score for s in relevant) / len(relevant)
            return round(avg, 2), 0.1

        weighted_sum = sum(s.final_score * s.confidence for s in relevant)
        weighted_avg = weighted_sum / total_weight

        # Confidence grows with more data points but is capped at 1.0
        combined_confidence = min(1.0, total_weight / len(relevant) * (1 + 0.1 * len(relevant)))

        return round(weighted_avg, 2), round(combined_confidence, 3)
