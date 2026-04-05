import time
from models import FinalEvaluation
from video_analysis import VideoAuthenticityAnalyzer


class VideoOnlyEvaluationPipeline:
    ARCHITECTURE_EXPLANATION = (
        "VIDEO-ONLY SYSTEM: "
        "(1) temporal consistency / anti-deepfake checks, "
        "(2) lip-sync validation, "
        "(3) ASR transcript extraction, "
        "(4) voice intelligence scoring, "
        "(5) confidence / communication / authenticity / presence scoring, "
        "(6) final video-native recommendation."
    )

    def __init__(self, whisper_model_size: str = "base"):
        self.video_analyzer = VideoAuthenticityAnalyzer(
            whisper_model_size=whisper_model_size
        )

    def run_video_evaluation(
        self,
        candidate_id: str,
        video_path: str,
    ) -> FinalEvaluation:
        start = time.time()

        video_result = self.video_analyzer.analyze(
            video_path=video_path,
            essay_claims=None,
            interview_claims=None,
        )

        video_score = round(video_result.final_video_score, 2)
        transcript_quality_score = self._compute_transcript_quality(video_result)
        confidence = self._compute_confidence(video_result)
        recommendation = self._recommend(video_result)

        strengths, weaknesses = self._extract_strengths_weaknesses(video_result)
        reasoning_chain = self._build_reasoning_chain(
            video_result=video_result,
            video_score=video_score,
            transcript_quality_score=transcript_quality_score,
            recommendation=recommendation,
        )

        elapsed = round(time.time() - start, 2)

        return FinalEvaluation(
            candidate_id=candidate_id,
            video_score=video_score,
            final_score=video_score,
            final_recommendation=recommendation,
            authenticity_passed=video_result.authenticity_flag,
            risk_flags=video_result.red_flags,
            intelligence_score=video_score,
            intelligence_confidence=confidence,

            confidence_score=video_result.confidence_score,
            communication_score=video_result.communication_score,
            authenticity_score=video_result.authenticity_score,
            presence_score=video_result.presence_score,

            transcript_text=video_result.transcript,
            transcript_quality_score=transcript_quality_score,
            transcript_interpretation=self._transcript_interpretation(video_result),
            ai_summary=video_result.video_summary,
            why_score=self._why_score(video_result, video_score, recommendation),
            confidence_level=self._confidence_label(confidence),
            strengths=strengths,
            weaknesses=weaknesses,
            reasoning_chain=reasoning_chain,
            processing_time_seconds=elapsed,
        )

    def _compute_transcript_quality(self, video_result) -> float:
        st = video_result.structured_transcript
        if not st:
            return 0.0

        score = (
            st.clarity_score * 0.30 +
            st.fluency_score * 0.25 +
            st.specificity_score * 0.20 +
            st.confidence_signal * 0.15 +
            (st.asr_confidence * 5.0) * 0.10
        )
        return round(min(5.0, max(0.0, score)), 2)

    def _compute_confidence(self, video_result) -> float:
        parts = [
            1.0 if video_result.authenticity_flag else 0.35,
            min(1.0, video_result.lip_sync_score),
            min(1.0, video_result.temporal_consistency_score),
            min(1.0, video_result.voice_score / 5.0),
            min(1.0, video_result.confidence_score / 5.0),
            min(1.0, video_result.communication_score / 5.0),
            min(1.0, video_result.authenticity_score / 5.0),
            min(1.0, video_result.presence_score / 5.0),
        ]

        st = video_result.structured_transcript
        if st:
            parts.append(min(1.0, st.asr_confidence))

        raw = sum(parts) / len(parts)
        if video_result.risk_level == "HIGH":
            raw *= 0.65
        elif video_result.risk_level == "MEDIUM":
            raw *= 0.85

        return round(min(1.0, max(0.0, raw)), 2)

    def _recommend(self, video_result) -> str:
        score = video_result.final_video_score
        risk = video_result.risk_level

        if risk == "HIGH":
            if score >= 3.8:
                return "NO"
            return "REJECT"

        if score >= 4.3:
            return "STRONG_YES"
        if score >= 3.4:
            return "YES"
        if score >= 2.3:
            return "MAYBE"
        if score >= 1.6:
            return "NO"
        return "REJECT"

    def _extract_strengths_weaknesses(self, video_result):
        strengths = []
        weaknesses = []

        if video_result.temporal_consistency_score >= 0.7:
            strengths.append("Natural temporal facial consistency")
        else:
            weaknesses.append("Temporal consistency may be suspicious")

        if video_result.confidence_score >= 3.4:
            strengths.append("Shows reasonable confidence")
        else:
            weaknesses.append("Confidence appears limited")

        if video_result.communication_score >= 3.4:
            strengths.append("Communication is fairly clear")
        else:
            weaknesses.append("Communication lacks clarity or specificity")

        if video_result.authenticity_score >= 3.4:
            strengths.append("Authenticity signals are acceptable")
        else:
            weaknesses.append("Authenticity signals are not strong enough")

        if video_result.presence_score >= 3.2:
            strengths.append("Good on-camera presence")
        else:
            weaknesses.append("On-camera presence feels weak")

        st = video_result.structured_transcript
        if st:
            if st.filler_ratio <= 0.08:
                strengths.append("Low filler-word usage")
            else:
                weaknesses.append("Too many filler words in speech")

        return strengths[:5], weaknesses[:5]

    def _transcript_interpretation(self, video_result) -> str:
        st = video_result.structured_transcript
        if not st:
            return "No transcript available."

        parts = []
        parts.append(f"ASR confidence: {st.asr_confidence:.0%}.")
        parts.append(f"Clarity: {st.clarity_score:.1f}/5.")
        parts.append(f"Fluency: {st.fluency_score:.1f}/5.")
        parts.append(f"Specificity: {st.specificity_score:.1f}/5.")
        if st.filler_ratio > 0.12:
            parts.append("High filler-word ratio detected.")
        elif st.filler_ratio < 0.05:
            parts.append("Low filler-word ratio.")
        return " ".join(parts)

    def _why_score(self, video_result, video_score: float, recommendation: str) -> str:
        return (
            f"Final score {video_score:.2f}/5 based on confidence, communication, "
            f"authenticity, presence, and transcript quality. "
            f"Risk level: {video_result.risk_level}. Recommendation: {recommendation}."
        )

    def _confidence_label(self, confidence: float) -> str:
        if confidence >= 0.8:
            return "HIGH"
        if confidence >= 0.6:
            return "MEDIUM"
        return "LOW"

    def _build_reasoning_chain(
        self,
        video_result,
        video_score: float,
        transcript_quality_score: float,
        recommendation: str,
    ):
        return [
            f"Confidence score: {video_result.confidence_score:.2f}/5",
            f"Communication score: {video_result.communication_score:.2f}/5",
            f"Authenticity score: {video_result.authenticity_score:.2f}/5",
            f"Presence score: {video_result.presence_score:.2f}/5",
            f"Lip-sync score: {video_result.lip_sync_score:.2f}",
            f"Temporal consistency score: {video_result.temporal_consistency_score:.2f}",
            f"Transcript quality score: {transcript_quality_score:.2f}/5",
            f"Risk level: {video_result.risk_level}",
            f"Final video score: {video_result.final_video_score:.2f}/5",
            f"Recommendation: {recommendation}",
        ]


def evaluate_candidate_video_only(
    candidate_id: str,
    video_path: str,
    whisper_model_size: str = "base",
):
    pipeline = VideoOnlyEvaluationPipeline(whisper_model_size=whisper_model_size)
    return pipeline.run_video_evaluation(
        candidate_id=candidate_id,
        video_path=video_path,
    )