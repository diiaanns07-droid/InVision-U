from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
import uuid


class StructuredEvidence(BaseModel):
    raw_text: str
    claims: List[str] = []
    actions: List[str] = []
    results: List[str] = []
    obstacles: List[str] = []
    reflections: List[str] = []
    projects: List[str] = []
    roles: List[str] = []
    technologies: List[str] = []
    vague_statements: List[str] = []

    specificity: float = 0.0
    ownership: float = 0.0
    impact: float = 0.0
    reflection: float = 0.0

    @property
    def overall_quality(self) -> float:
        return round(
            (self.specificity + self.ownership + self.impact + self.reflection) / 4,
            2,
        )


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    confidence: float


class StructuredTranscript(BaseModel):
    raw_text: str
    segments: List[TranscriptSegment] = []
    language: str = "en"
    asr_confidence: float = 0.0

    claims: List[str] = []
    actions: List[str] = []
    results: List[str] = []
    reflections: List[str] = []
    vague_statements: List[str] = []

    clarity_score: float = Field(default=0.0, ge=0, le=5)
    relevance_score: float = Field(default=2.5, ge=0, le=5)
    specificity_score: float = Field(default=0.0, ge=0, le=5)
    fluency_score: float = Field(default=0.0, ge=0, le=5)
    confidence_signal: float = Field(default=0.0, ge=0, le=5)

    consistency_flags: List[str] = []
    filler_ratio: float = 0.0


class VideoAnalysisResult(BaseModel):
    lip_sync_score: float = Field(..., ge=0, le=1)
    temporal_consistency_score: float = Field(..., ge=0, le=1)
    authenticity_flag: bool
    risk_level: Literal["LOW", "MEDIUM", "HIGH"]

    transcript: str
    structured_transcript: Optional[StructuredTranscript] = None
    word_count: int
    speech_rate_wpm: float

    voice_score: float = Field(default=2.5, ge=0, le=5)
    voice_interpretation: str = "Not analyzed"
    pitch_confidence_score: float = Field(default=2.5, ge=0, le=5)
    energy_score: float = Field(default=2.5, ge=0, le=5)
    pause_score: float = Field(default=2.5, ge=0, le=5)
    stress_indicator: float = Field(default=0.5, ge=0, le=1)

    confidence_score: float = Field(default=2.5, ge=0, le=5)
    communication_score: float = Field(default=2.5, ge=0, le=5)
    authenticity_score: float = Field(default=2.5, ge=0, le=5)
    presence_score: float = Field(default=2.5, ge=0, le=5)

    clarity_score: float = Field(default=0.0, ge=0, le=5)
    final_video_score: float = Field(..., ge=0, le=5)
    video_summary: str
    red_flags: List[str] = []


class FinalEvaluation(BaseModel):
    candidate_id: str
    profile_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.now)

    video_score: float = Field(..., ge=0, le=5)
    final_score: float = Field(..., ge=0, le=5)
    final_recommendation: Literal["STRONG_YES", "YES", "MAYBE", "NO", "REJECT"]

    authenticity_passed: bool
    risk_flags: List[str]

    intelligence_score: float = Field(..., ge=0, le=5)
    intelligence_confidence: float = Field(..., ge=0, le=1)
    
    confidence_score: float = Field(default=0.0, ge=0, le=5)
    communication_score: float = Field(default=0.0, ge=0, le=5)
    authenticity_score: float = Field(default=0.0, ge=0, le=5)
    presence_score: float = Field(default=0.0, ge=0, le=5)

    transcript_text: str = ""
    transcript_quality_score: float = Field(default=0.0, ge=0, le=5)
    transcript_interpretation: str = ""

    ai_summary: str
    why_score: str
    confidence_level: str

    strengths: List[str]
    weaknesses: List[str]

    reasoning_chain: List[str] = []

    processing_time_seconds: float
    system_version: str = "video-only-no-emotion-1.0"


VIDEO_REQUIREMENTS_PROMPT = """
VIDEO SUBMISSION REQUIREMENTS

Each candidate must submit:
- video file OR video URL

PURPOSE:
- authenticity assessment
- temporal consistency checks
- lip-sync validation
- voice intelligence analysis
- speech-to-text transcript analysis
- confidence / communication / presence scoring

TECHNICAL REQUIREMENTS:
1. Face should remain visible when possible
2. Well-lit environment, stable camera, no cuts or transitions
3. One continuous take, 60–120 seconds preferred
4. Speak naturally — do not use heavy editing, filters, or effects
5. Supported formats: MP4 / MOV / AVI / MKV / WEBM

ANTI-CHEAT:
- No deepfakes, AI avatars, voice synthesis, or lip-sync tools
- No editing, cuts, or transitions
"""