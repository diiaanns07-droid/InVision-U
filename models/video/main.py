import shutil
import tempfile

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from models import FinalEvaluation, VIDEO_REQUIREMENTS_PROMPT
from pipeline import VideoOnlyEvaluationPipeline, evaluate_candidate_video_only
from video_download import download_video_from_url, VideoDownloadError


app = FastAPI(
    title="Imba AI Video-Only Evaluation System",
    description="Video-only candidate evaluation: confidence, communication, authenticity, presence, transcript.",
    version="1.0-VIDEO-ONLY-NO-EMOTION"
)

pipeline = VideoOnlyEvaluationPipeline()


@app.get("/")
async def root():
    return {
        "system": "Imba AI Video-Only Evaluation",
        "version": "1.0-VIDEO-ONLY-NO-EMOTION",
        "active_components": [
            "Temporal consistency / anti-deepfake",
            "Lip-sync validation",
            "ASR transcript extraction",
            "Voice intelligence scoring",
            "Confidence / communication / authenticity / presence",
            "Video-native final recommendation",
        ],
    }


@app.get("/video-requirements")
async def video_requirements():
    return {
        "requirements": VIDEO_REQUIREMENTS_PROMPT,
        "supported_video_input": {
            "file_upload": "Direct upload via multipart/form-data",
            "url": "Video link via /evaluate-url",
        },
    }


@app.post("/evaluate", response_model=FinalEvaluation)
async def evaluate_endpoint(
    candidate_id: str = Form(...),
    video: UploadFile = File(...),
    whisper_model: str = Form(default="medium"),
):
    video_dir = None

    try:
        video_dir = tempfile.mkdtemp()
        video_path = f"{video_dir}/candidate_video.mp4"

        with open(video_path, "wb") as f:
            shutil.copyfileobj(video.file, f)

        result = evaluate_candidate_video_only(
            candidate_id=candidate_id,
            video_path=video_path,
            whisper_model_size=whisper_model,
        )
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if video_dir:
            shutil.rmtree(video_dir, ignore_errors=True)


@app.post("/evaluate-url", response_model=FinalEvaluation)
async def evaluate_url_endpoint(
    candidate_id: str = Form(...),
    video_url: str = Form(...),
    whisper_model: str = Form(default="base"),
):
    video_dir = None

    try:
        video_dir = tempfile.mkdtemp()

        try:
            video_path = download_video_from_url(video_url, video_dir)
        except VideoDownloadError as e:
            raise HTTPException(status_code=422, detail=str(e))

        result = evaluate_candidate_video_only(
            candidate_id=candidate_id,
            video_path=video_path,
            whisper_model_size=whisper_model,
        )
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if video_dir:
            shutil.rmtree(video_dir, ignore_errors=True)