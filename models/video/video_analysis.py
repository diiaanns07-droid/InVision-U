import cv2
import numpy as np
import mediapipe as mp
import tempfile
import os
from typing import List, Dict, Optional
from scipy.stats import pearsonr

from models import VideoAnalysisResult
from voice_analysis import EnhancedASRPipeline, VoiceIntelligenceAnalyzer
from text_understanding import TextUnderstandingEngine


class VideoAuthenticityAnalyzer:
    """
    Video-only pipeline:
    - temporal consistency
    - lip-sync validation
    - ASR transcript
    - voice intelligence
    - confidence / communication / authenticity / presence
    """

    LIPS_UPPER = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]
    LIPS_LOWER = [146, 91, 181, 84, 17, 314, 405, 321, 375, 291]

    def __init__(self, whisper_model_size: str = "base"):
        self.face_mesh = mp.solutions.face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        self.asr = EnhancedASRPipeline(model_size=whisper_model_size)
        self.voice_analyzer = VoiceIntelligenceAnalyzer()
        self.text_engine = TextUnderstandingEngine()

    def analyze(
        self,
        video_path: str,
        essay_claims: Optional[List[str]] = None,
        interview_claims: Optional[List[str]] = None
    ) -> VideoAnalysisResult:
        frames, fps, duration = self._extract_frames(video_path)
        if len(frames) < 10:
            return self._error_result("Insufficient frames")

        face_data = self._analyze_faces(frames)
        face_detection_ratio = face_data["valid_frames"] / max(len(frames), 1)

        if face_data["valid_frames"] == 0:
            return self._error_result("No face detected in video")

        low_face_detection = face_detection_ratio < 0.3

        temporal_score = self._analyze_temporal_consistency(face_data)

        audio_path = self._extract_audio(video_path)

        transcript_data = self.asr.transcribe(audio_path)
        voice_result = self.voice_analyzer.analyze(audio_path)

        structured_transcript = self.text_engine.parse_transcript(
            transcript_data["text"],
            essay_claims=essay_claims or [],
            interview_claims=interview_claims or []
        )
        structured_transcript.segments = transcript_data["segments"]
        structured_transcript.asr_confidence = transcript_data["confidence"]
        structured_transcript.language = transcript_data["language"]
        structured_transcript.filler_ratio = transcript_data["filler_ratio"]

        import librosa
        y, sr = librosa.load(audio_path, sr=16000)
        rms = librosa.feature.rms(y=y)[0]
        lip_sync = self._validate_lip_sync(face_data["lip_aperture"], rms)

        behavior = self._analyze_behavior(face_data)

        os.remove(audio_path)

        clarity = self._score_clarity(transcript_data, structured_transcript)

        confidence_score = (
            voice_result.get("overall_voice_score", 2.5) * 0.35 +
            voice_result.get("pitch_confidence_score", 2.5) * 0.25 +
            voice_result.get("pause_score", 2.5) * 0.20 +
            structured_transcript.fluency_score * 0.20
        )
        if voice_result.get("stress_indicator", 0.5) > 0.8:
            confidence_score *= 0.85

        communication_score = (
            structured_transcript.clarity_score * 0.35 +
            structured_transcript.fluency_score * 0.25 +
            structured_transcript.specificity_score * 0.20 +
            max(0.0, 5 - structured_transcript.filler_ratio * 20) * 0.20
        )

        authenticity_score = (
            lip_sync * 5 * 0.45 +
            temporal_score * 5 * 0.35 +
            structured_transcript.asr_confidence * 5 * 0.20
        )

        presence_score = (
            min(5.0, behavior["energy"]) * 0.40 +
            voice_result.get("overall_voice_score", 2.5) * 0.30 +
            structured_transcript.confidence_signal * 0.30
        )

        risk_level, flags = self._assess_risk(
            lip_sync=lip_sync,
            temporal_score=temporal_score,
            voice_result=voice_result,
            structured_transcript=structured_transcript
        )

        if low_face_detection:
            flags.append(f"Low face detection coverage: {face_detection_ratio:.0%}")
            if risk_level == "LOW":
                risk_level = "MEDIUM"

        video_score = (
            confidence_score * 0.30 +
            communication_score * 0.30 +
            authenticity_score * 0.25 +
            presence_score * 0.15
        )

        if low_face_detection:
            video_score *= 0.75

        final_video_score = max(0.0, min(5.0, round(video_score, 2)))

        return VideoAnalysisResult(
            lip_sync_score=round(lip_sync, 3),
            temporal_consistency_score=round(temporal_score, 3),
            authenticity_flag=risk_level != "HIGH",
            risk_level=risk_level,
            transcript=transcript_data["text"],
            structured_transcript=structured_transcript,
            word_count=transcript_data["word_count"],
            speech_rate_wpm=transcript_data["wpm"],
            voice_score=round(voice_result.get("overall_voice_score", 2.5), 2),
            voice_interpretation=voice_result.get("interpretation", ""),
            pitch_confidence_score=round(voice_result.get("pitch_confidence_score", 2.5), 2),
            energy_score=round(voice_result.get("energy_score", 2.5), 2),
            pause_score=round(voice_result.get("pause_score", 2.5), 2),
            stress_indicator=round(voice_result.get("stress_indicator", 0.5), 2),
            confidence_score=round(max(0.0, min(5.0, confidence_score)), 2),
            communication_score=round(max(0.0, min(5.0, communication_score)), 2),
            authenticity_score=round(max(0.0, min(5.0, authenticity_score)), 2),
            presence_score=round(max(0.0, min(5.0, presence_score)), 2),
            clarity_score=round(clarity, 2),
            final_video_score=final_video_score,
            video_summary=self._build_summary(
                risk_level=risk_level,
                confidence_score=confidence_score,
                communication_score=communication_score,
                authenticity_score=authenticity_score,
                presence_score=presence_score,
                clarity=clarity
            ),
            red_flags=flags
        )

    def _extract_frames(self, video_path: str, max_frames: int = 90):
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            return [], 0.0, 0.0

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = total_frames / fps if fps > 0 else 0.0

        step = max(1, total_frames // max_frames) if total_frames > 0 else 1
        frames = []
        idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if idx % step == 0:
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frames.append(frame_rgb)
            idx += 1

        cap.release()
        return frames, fps, duration

    def _analyze_faces(self, frames: List[np.ndarray]) -> Dict:
        lip_apertures = []
        valid_frames = 0
        face_boxes = []

        for frame in frames:
            results = self.face_mesh.process(frame)
            if not results.multi_face_landmarks:
                lip_apertures.append(0.0)
                continue

            valid_frames += 1
            landmarks = results.multi_face_landmarks[0].landmark
            h, w, _ = frame.shape

            xs = [lm.x * w for lm in landmarks]
            ys = [lm.y * h for lm in landmarks]
            face_boxes.append((min(xs), min(ys), max(xs), max(ys)))

            upper = np.mean([[landmarks[i].x * w, landmarks[i].y * h] for i in self.LIPS_UPPER], axis=0)
            lower = np.mean([[landmarks[i].x * w, landmarks[i].y * h] for i in self.LIPS_LOWER], axis=0)
            lip_apertures.append(float(np.linalg.norm(upper - lower)))

        return {
            "valid_frames": valid_frames,
            "lip_aperture": lip_apertures,
            "face_boxes": face_boxes
        }

    def _analyze_temporal_consistency(self, face_data: Dict) -> float:
        boxes = face_data["face_boxes"]
        if len(boxes) < 2:
            return 0.2

        centers = []
        sizes = []
        for x1, y1, x2, y2 in boxes:
            centers.append(((x1 + x2) / 2, (y1 + y2) / 2))
            sizes.append((x2 - x1) * (y2 - y1))

        center_jumps = []
        for i in range(1, len(centers)):
            dx = centers[i][0] - centers[i - 1][0]
            dy = centers[i][1] - centers[i - 1][1]
            center_jumps.append((dx ** 2 + dy ** 2) ** 0.5)

        size_changes = []
        for i in range(1, len(sizes)):
            prev = max(sizes[i - 1], 1e-6)
            size_changes.append(abs(sizes[i] - sizes[i - 1]) / prev)

        mean_jump = float(np.mean(center_jumps)) if center_jumps else 0.0
        mean_size_change = float(np.mean(size_changes)) if size_changes else 0.0

        score = 1.0 - min(1.0, mean_jump / 60.0 + mean_size_change)
        return round(max(0.0, score), 3)

    def _extract_audio(self, video_path: str) -> str:
        import subprocess
        audio_path = tempfile.mktemp(suffix=".wav")
        cmd = [
            "ffmpeg", "-y",
            "-i", video_path,
            "-ac", "1",
            "-ar", "16000",
            audio_path
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return audio_path

    def _validate_lip_sync(self, lip_aperture: List[float], rms: np.ndarray) -> float:
        if not lip_aperture or len(rms) < 2:
            return 0.2

        lip = np.array(lip_aperture, dtype=np.float32)
        lip = (lip - lip.mean()) / (lip.std() + 1e-6)

        target_len = len(lip)
        if len(rms) != target_len:
            x_old = np.linspace(0, 1, len(rms))
            x_new = np.linspace(0, 1, target_len)
            rms = np.interp(x_new, x_old, rms)

        rms = (rms - rms.mean()) / (rms.std() + 1e-6)

        try:
            corr, _ = pearsonr(lip, rms)
            corr = 0.0 if np.isnan(corr) else corr
        except Exception:
            corr = 0.0

        return round(max(0.0, min(1.0, (corr + 1) / 2)), 3)

    def _analyze_behavior(self, face_data: Dict) -> Dict:
        energy = 3.0
        lip = face_data.get("lip_aperture", [])
        if lip:
            energy = min(5.0, max(1.0, np.std(lip) / 4.0))
        return {"energy": round(float(energy), 2)}

    def _score_clarity(self, transcript_data: Dict, structured_transcript) -> float:
        if structured_transcript is None:
            return 0.0

        base = (
            structured_transcript.clarity_score * 0.35 +
            structured_transcript.fluency_score * 0.25 +
            structured_transcript.specificity_score * 0.20 +
            structured_transcript.confidence_signal * 0.20
        )

        if transcript_data.get("confidence", 0.0) < 0.4:
            base *= 0.8

        return round(min(5.0, max(0.0, base)), 2)

    def _assess_risk(
        self,
        lip_sync: float,
        temporal_score: float,
        voice_result: Dict,
        structured_transcript,
    ):
        flags = []

        if lip_sync < 0.35:
            flags.append("Low lip-sync consistency")
        if temporal_score < 0.35:
            flags.append("Low temporal consistency")
        if voice_result.get("stress_indicator", 0.5) > 0.85:
            flags.append("High stress indicator")
        if structured_transcript and structured_transcript.asr_confidence < 0.35:
            flags.append("Low ASR confidence")
        if structured_transcript and structured_transcript.filler_ratio > 0.18:
            flags.append("High filler-word ratio")

        if lip_sync < 0.25 or temporal_score < 0.25:
            return "HIGH", flags
        if lip_sync < 0.45 or temporal_score < 0.45 or len(flags) >= 3:
            return "MEDIUM", flags
        return "LOW", flags

    def _build_summary(
        self,
        risk_level: str,
        confidence_score: float,
        communication_score: float,
        authenticity_score: float,
        presence_score: float,
        clarity: float
    ) -> str:
        return (
            f"Video-only assessment completed. "
            f"Risk={risk_level}, confidence={confidence_score:.2f}/5, "
            f"communication={communication_score:.2f}/5, "
            f"authenticity={authenticity_score:.2f}/5, "
            f"presence={presence_score:.2f}/5, "
            f"clarity={clarity:.2f}/5."
        )

    def _error_result(self, message: str) -> VideoAnalysisResult:
        return VideoAnalysisResult(
            lip_sync_score=0.0,
            temporal_consistency_score=0.0,
            authenticity_flag=False,
            risk_level="HIGH",
            transcript="",
            structured_transcript=None,
            word_count=0,
            speech_rate_wpm=0.0,
            voice_score=0.0,
            voice_interpretation=message,
            pitch_confidence_score=0.0,
            energy_score=0.0,
            pause_score=0.0,
            stress_indicator=1.0,
            confidence_score=0.0,
            communication_score=0.0,
            authenticity_score=0.0,
            presence_score=0.0,
            clarity_score=0.0,
            final_video_score=0.0,
            video_summary=message,
            red_flags=[message]
        )