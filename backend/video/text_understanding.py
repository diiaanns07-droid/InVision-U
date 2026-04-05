# text_understanding.py — LLM-powered semantic parsing + sentence embeddings
# IMPROVEMENT 1: GPT-based structured evidence extraction
# IMPROVEMENT 2: Sentence embeddings for cross-modal similarity & contradiction detection

import os
import json
import re
from typing import List, Dict, Optional, Tuple
import numpy as np

# ── Sentence Embeddings ──────────────────────────────────────────────────────
try:
    from sentence_transformers import SentenceTransformer, util
    EMBEDDINGS_AVAILABLE = True
    _EMBED_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    print("[TextEngine] sentence-transformers: ENABLED (all-MiniLM-L6-v2)")
except ImportError:
    EMBEDDINGS_AVAILABLE = False
    _EMBED_MODEL = None
    print("[TextEngine] sentence-transformers not installed — semantic similarity disabled")

# ── OpenAI / LLM ─────────────────────────────────────────────────────────────
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("[TextEngine] openai not installed — using rule-based fallback")

from models import StructuredEvidence


# ─────────────────────────────────────────────────────────────────────────────
# IMPROVEMENT 2 — Embedding utilities
# ─────────────────────────────────────────────────────────────────────────────

def embed(texts: List[str]) -> Optional[np.ndarray]:
    """Return (N, D) embedding matrix or None if unavailable."""
    if not EMBEDDINGS_AVAILABLE or not texts:
        return None
    return _EMBED_MODEL.encode(texts, normalize_embeddings=True, show_progress_bar=False)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two 1-D normalized vectors."""
    return float(np.dot(a, b))


def semantic_similarity_matrix(texts_a: List[str], texts_b: List[str]) -> Optional[np.ndarray]:
    """Return (|A|, |B|) cosine similarity matrix between two sets of texts."""
    if not EMBEDDINGS_AVAILABLE or not texts_a or not texts_b:
        return None
    emb_a = embed(texts_a)
    emb_b = embed(texts_b)
    return np.inner(emb_a, emb_b)  # shape: (|A|, |B|)


def detect_contradictions_semantic(
    claims_a: List[str],
    claims_b: List[str],
    threshold: float = 0.85
) -> List[Dict]:
    """
    IMPROVEMENT 2 — Detect contradictions using semantic similarity.
    Two claims that are very similar but contain negation words are flagged.
    """
    contradictions = []
    if not EMBEDDINGS_AVAILABLE or not claims_a or not claims_b:
        return contradictions

    sim_matrix = semantic_similarity_matrix(claims_a, claims_b)
    if sim_matrix is None:
        return contradictions

    NEG_WORDS = {"not", "never", "failed", "didn't", "couldn't", "no", "none", "refused"}

    for i, ca in enumerate(claims_a):
        for j, cb in enumerate(claims_b):
            sim = float(sim_matrix[i, j])
            if sim > threshold:
                words_a = set(ca.lower().split())
                words_b = set(cb.lower().split())
                neg_a = bool(words_a & NEG_WORDS)
                neg_b = bool(words_b & NEG_WORDS)
                # Semantically similar but one has negation → contradiction
                if neg_a != neg_b:
                    contradictions.append({
                        "type": "semantic_contradiction",
                        "claim_a": ca,
                        "claim_b": cb,
                        "similarity": round(sim, 3),
                        "severity": "high" if sim > 0.92 else "medium",
                        "status": "unresolved"
                    })
    return contradictions


def cross_modal_consistency(
    written_claims: List[str],
    spoken_claims: List[str],
    threshold: float = 0.4
) -> Tuple[float, List[str]]:
    """
    IMPROVEMENT 2+7 — Cross-modal semantic consistency.
    Checks that spoken content in video aligns with written essay/interview.
    Returns (consistency_score 0-1, list_of_mismatches).
    """
    if not EMBEDDINGS_AVAILABLE or not written_claims or not spoken_claims:
        return 0.5, []

    sim_matrix = semantic_similarity_matrix(written_claims, spoken_claims)
    if sim_matrix is None:
        return 0.5, []

    # For each written claim, find best matching spoken claim
    best_matches = sim_matrix.max(axis=1)
    consistency_score = float(np.mean(best_matches))

    mismatches = [
        f"Written claim not echoed in video: '{written_claims[i][:60]}...'"
        for i, score in enumerate(best_matches)
        if score < threshold
    ]
    return round(consistency_score, 3), mismatches


# ─────────────────────────────────────────────────────────────────────────────
# IMPROVEMENT 1 — LLM-powered text parsing
# ─────────────────────────────────────────────────────────────────────────────

LLM_PARSE_SYSTEM_PROMPT = """You are an expert talent analyst parsing candidate text.
Extract structured evidence and return ONLY valid JSON — no markdown, no explanation.

JSON schema:
{
  "claims": ["specific claim 1", ...],          // concrete statements made
  "actions": ["action taken 1", ...],           // things the candidate DID
  "results": ["quantified result 1", ...],      // outcomes with numbers if present
  "obstacles": ["challenge 1", ...],            // difficulties faced
  "reflections": ["lesson learned 1", ...],     // self-reflection / growth
  "projects": ["project name 1", ...],          // projects mentioned
  "roles": ["role 1", ...],                     // positions / responsibilities
  "technologies": ["tech 1", ...],              // tools, languages, frameworks
  "vague_statements": ["vague phrase 1", ...],  // unsubstantiated or generic claims
  "specificity": 0.0,   // 0-1: how specific and concrete is this text?
  "ownership": 0.0,     // 0-1: does the candidate take personal ownership? ("I" vs "we")
  "impact": 0.0,        // 0-1: is there measurable impact with numbers?
  "reflection": 0.0     // 0-1: does the candidate show self-awareness and learning?
}

Be strict. Vague statements like "I helped the team" or "things got better" must go in vague_statements.
Quantified results like "reduced errors by 40%" must go in results."""


class TextUnderstandingEngine:
    """
    IMPROVEMENT 1 — LLM-powered semantic parsing.
    Falls back gracefully to rule-based parsing if OpenAI is unavailable.

    IMPROVEMENT 2 — Produces embeddings for cross-modal reasoning.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.client = None

        if OPENAI_AVAILABLE and self.api_key:
            self.client = OpenAI(api_key=self.api_key)
            print("[TextEngine] LLM parsing: ENABLED (GPT-4o-mini)")
        else:
            print("[TextEngine] LLM parsing: DISABLED — using rule-based fallback")

    def parse(self, text: str, source: str = "unknown") -> StructuredEvidence:
        """Parse text into StructuredEvidence with LLM or rule-based fallback."""
        if self.client:
            return self._parse_llm(text, source)
        return self._parse_rules(text, source)

    def parse_transcript(
        self,
        text: str,
        essay_claims: Optional[List[str]] = None,
        interview_claims: Optional[List[str]] = None
    ):
        """
        Parse video transcript and check cross-modal consistency.
        Returns StructuredTranscript-compatible object.
        """
        from models import StructuredTranscript

        evidence = self.parse(text, "transcript")

        # IMPROVEMENT 7 — Cross-modal consistency check
        consistency_flags = []
        if essay_claims:
            _, mismatches = cross_modal_consistency(essay_claims, evidence.claims)
            consistency_flags.extend(mismatches[:3])
        if interview_claims:
            _, iv_mismatches = cross_modal_consistency(interview_claims, evidence.claims)
            consistency_flags.extend(iv_mismatches[:2])

        # Compute filler ratio (ums, uhs, like, you know)
        filler_words = {"um", "uh", "like", "you", "know", "basically", "literally", "just"}
        words = text.lower().split()
        filler_ratio = sum(1 for w in words if w in filler_words) / max(len(words), 1)

        return StructuredTranscript(
            raw_text=text,
            claims=evidence.claims,
            actions=evidence.actions,
            results=evidence.results,
            reflections=evidence.reflections,
            vague_statements=evidence.vague_statements,
            clarity_score=round(5 * (1 - filler_ratio), 2),
            relevance_score=round(5 * evidence.specificity, 2),
            specificity_score=round(5 * evidence.specificity, 2),
            fluency_score=round(5 * (1 - filler_ratio * 2), 2),
            confidence_signal=round(5 * evidence.ownership, 2),
            consistency_flags=consistency_flags,
            filler_ratio=round(filler_ratio, 3)
        )

    # ── LLM Parser ────────────────────────────────────────────────────────────

    def _parse_llm(self, text: str, source: str) -> StructuredEvidence:
        """IMPROVEMENT 1 — GPT-based structured extraction."""
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": LLM_PARSE_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Source: {source}\n\nText:\n{text}"}
                ],
                temperature=0.1,
                max_tokens=1000,
                response_format={"type": "json_object"}
            )
            raw = response.choices[0].message.content
            data = json.loads(raw)
            return StructuredEvidence(
                raw_text=text,
                claims=data.get("claims", []),
                actions=data.get("actions", []),
                results=data.get("results", []),
                obstacles=data.get("obstacles", []),
                reflections=data.get("reflections", []),
                projects=data.get("projects", []),
                roles=data.get("roles", []),
                technologies=data.get("technologies", []),
                vague_statements=data.get("vague_statements", []),
                specificity=float(data.get("specificity", 0.5)),
                ownership=float(data.get("ownership", 0.5)),
                impact=float(data.get("impact", 0.3)),
                reflection=float(data.get("reflection", 0.3))
            )
        except Exception as e:
            print(f"[TextEngine] LLM parse failed ({e}), using rule-based fallback")
            return self._parse_rules(text, source)

    # ── Rule-based Fallback ───────────────────────────────────────────────────

    def _parse_rules(self, text: str, source: str) -> StructuredEvidence:
        """Heuristic rule-based parsing — used when OpenAI is unavailable."""
        words = text.lower().split()
        sentences = [s.strip() for s in re.split(r'[.!?]', text) if len(s.strip()) > 10]

        has_numbers = bool(re.search(r'\d+', text))
        i_count = sum(1 for w in words if w == 'i')
        we_count = sum(1 for w in words if w == 'we')

        action_verbs = {"led", "built", "created", "managed", "developed", "implemented",
                        "designed", "launched", "improved", "reduced", "increased", "delivered"}
        reflect_words = {"learned", "realized", "improved", "would", "differently", "mistake",
                         "challenge", "insight", "lesson", "growth"}
        vague_triggers = {"helped", "assisted", "supported", "involved", "contributed",
                          "worked", "things", "better", "good", "fine"}

        claims = sentences[:5]
        actions = [s for s in sentences if any(v in s.lower() for v in action_verbs)]
        results = [s for s in sentences if re.search(r'\d+\s*(%|x|times|million|billion|k\b)', s.lower())]
        reflections = [s for s in sentences if any(w in s.lower() for w in reflect_words)]
        vague = [s for s in sentences if any(v in s.lower() for v in vague_triggers) and not actions]
        projects = list({s.strip() for s in re.findall(r'"([^"]+)"|project\s+(\w+)', text, re.I) if s})
        technologies = list({w for w in words if w in {
            "python", "react", "sql", "aws", "docker", "kubernetes", "tensorflow",
            "pytorch", "fastapi", "redis", "postgres", "mongodb", "gpt", "llm"
        }})

        ownership = min(1.0, i_count / max(we_count + i_count, 1))
        specificity = min(1.0, 0.2 + 0.3 * has_numbers + 0.05 * len(actions) + 0.02 * len(words) / 100)
        impact = min(1.0, 0.1 + 0.6 * bool(results) + 0.3 * has_numbers)
        reflection = min(1.0, 0.1 + 0.5 * bool(reflections))

        return StructuredEvidence(
            raw_text=text,
            claims=claims,
            actions=actions,
            results=results,
            obstacles=[],
            reflections=reflections,
            projects=[p for p in projects if p],
            roles=[],
            technologies=technologies,
            vague_statements=vague[:3],
            specificity=round(specificity, 2),
            ownership=round(ownership, 2),
            impact=round(impact, 2),
            reflection=round(reflection, 2)
        )

    # ── Embedding utilities (public API) ──────────────────────────────────────

    def get_embedding(self, text: str) -> Optional[np.ndarray]:
        """Return 1-D embedding vector for a single text."""
        if not EMBEDDINGS_AVAILABLE:
            return None
        result = embed([text])
        return result[0] if result is not None else None

    def semantic_similarity(self, text_a: str, text_b: str) -> float:
        """Cosine similarity between two texts. Returns 0.5 if embeddings unavailable."""
        if not EMBEDDINGS_AVAILABLE:
            return 0.5
        emb_a = embed([text_a])
        emb_b = embed([text_b])
        if emb_a is None or emb_b is None:
            return 0.5
        return cosine_similarity(emb_a[0], emb_b[0])
