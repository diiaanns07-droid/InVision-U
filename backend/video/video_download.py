# video_download.py — IMPROVEMENT 9: Video via URL
# Supports: direct links, Google Drive share links, S3 pre-signed URLs

import os
import re
import time
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, Dict

# Maximum allowed video file size: 500 MB
MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024

# Supported video MIME types and extensions
SUPPORTED_MIME_TYPES = {
    "video/mp4", "video/quicktime", "video/x-msvideo",
    "video/avi", "video/mov", "video/x-matroska", "video/webm"
}
SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}

# Download timeout in seconds
DOWNLOAD_TIMEOUT = 120


class VideoDownloadError(Exception):
    """Raised when video download fails for any reason."""
    pass


def _resolve_google_drive_url(url: str) -> str:
    """
    Convert Google Drive share URLs to direct download URLs.

    Supported formats:
    - https://drive.google.com/file/d/FILE_ID/view
    - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    - https://drive.google.com/open?id=FILE_ID
    """
    # Format: /file/d/FILE_ID/
    match = re.search(r"/file/d/([a-zA-Z0-9_-]+)", url)
    if match:
        file_id = match.group(1)
        return f"https://drive.google.com/uc?export=download&id={file_id}&confirm=t"

    # Format: ?id=FILE_ID
    match = re.search(r"[?&]id=([a-zA-Z0-9_-]+)", url)
    if match:
        file_id = match.group(1)
        return f"https://drive.google.com/uc?export=download&id={file_id}&confirm=t"

    raise VideoDownloadError(
        f"Could not extract Google Drive file ID from URL: {url}. "
        "Expected format: https://drive.google.com/file/d/FILE_ID/view"
    )


def _resolve_url(url: str) -> str:
    """
    Resolve provider-specific share URLs to direct download URLs.
    Falls back to the original URL for direct links.
    """
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()

    if "drive.google.com" in host:
        return _resolve_google_drive_url(url)

    # Add more providers here as needed:
    # if "dropbox.com" in host:
    #     return url.replace("?dl=0", "?dl=1")

    # Assume it's a direct download link
    return url


def _detect_extension_from_headers(headers) -> Optional[str]:
    """Try to detect video format from Content-Type header."""
    content_type = headers.get("Content-Type", "").lower().split(";")[0].strip()
    mime_to_ext = {
        "video/mp4": ".mp4",
        "video/quicktime": ".mov",
        "video/x-msvideo": ".avi",
        "video/avi": ".avi",
        "video/x-matroska": ".mkv",
        "video/webm": ".webm",
    }
    return mime_to_ext.get(content_type)


def _detect_extension_from_url(url: str) -> Optional[str]:
    """Try to detect video format from URL path."""
    path = urllib.parse.urlparse(url).path.lower()
    for ext in SUPPORTED_EXTENSIONS:
        if path.endswith(ext):
            return ext
    return None


def download_video_from_url(url: str, dest_dir: str) -> str:
    """
    IMPROVEMENT 9 — Download a video from a URL to a local temp directory.

    Args:
        url: Video URL (direct link, Google Drive share link, S3 URL, etc.)
        dest_dir: Local directory to save the file

    Returns:
        str: Full path to the downloaded video file

    Raises:
        VideoDownloadError: If download fails or file is invalid/too large
    """
    if not url or not url.strip():
        raise VideoDownloadError("Empty URL provided.")

    url = url.strip()

    # Validate URL scheme
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise VideoDownloadError(
            f"Unsupported URL scheme '{parsed.scheme}'. Only HTTP/HTTPS links are supported."
        )

    # Resolve provider-specific URLs (e.g. Google Drive share → direct download)
    direct_url = _resolve_url(url)
    print(f"[VideoDownload] Resolved URL: {direct_url[:80]}...")

    # ── HEAD request: check size and content type before downloading ──────────
    try:
        req = urllib.request.Request(direct_url, method="HEAD")
        req.add_header("User-Agent", "Mozilla/5.0 (compatible; ImbaAI/4.0)")
        with urllib.request.urlopen(req, timeout=15) as resp:
            headers = resp.headers

            content_length = headers.get("Content-Length")
            if content_length and int(content_length) > MAX_VIDEO_SIZE_BYTES:
                size_mb = int(content_length) / (1024 * 1024)
                raise VideoDownloadError(
                    f"Video file too large: {size_mb:.0f} MB (max {MAX_VIDEO_SIZE_BYTES // 1024 // 1024} MB)."
                )

            # Detect extension
            ext = _detect_extension_from_headers(headers)
    except VideoDownloadError:
        raise
    except Exception:
        # HEAD request failed (some servers don't support it) — proceed anyway
        headers = {}
        ext = None

    # Fallback extension detection from URL
    if ext is None:
        ext = _detect_extension_from_url(direct_url) or ".mp4"

    dest_path = os.path.join(dest_dir, f"candidate_video{ext}")

    # ── Download the file ─────────────────────────────────────────────────────
    try:
        req = urllib.request.Request(direct_url)
        req.add_header("User-Agent", "Mozilla/5.0 (compatible; ImbaAI/4.0)")

        print(f"[VideoDownload] Starting download → {dest_path}")
        start = time.time()

        with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT) as response:
            downloaded = 0
            with open(dest_path, "wb") as f:
                while True:
                    chunk = response.read(1024 * 1024)  # 1 MB chunks
                    if not chunk:
                        break
                    downloaded += len(chunk)
                    if downloaded > MAX_VIDEO_SIZE_BYTES:
                        f.close()
                        os.remove(dest_path)
                        raise VideoDownloadError(
                            f"Video exceeds size limit ({MAX_VIDEO_SIZE_BYTES // 1024 // 1024} MB). "
                            "Download aborted."
                        )
                    f.write(chunk)

        elapsed = time.time() - start
        size_mb = downloaded / (1024 * 1024)
        print(f"[VideoDownload] Done: {size_mb:.1f} MB in {elapsed:.1f}s")

    except VideoDownloadError:
        raise
    except urllib.error.HTTPError as e:
        raise VideoDownloadError(
            f"HTTP {e.code} error downloading video: {e.reason}. "
            "Check that the link is publicly accessible."
        )
    except urllib.error.URLError as e:
        raise VideoDownloadError(f"Network error: {e.reason}")
    except TimeoutError:
        raise VideoDownloadError(
            f"Download timed out after {DOWNLOAD_TIMEOUT}s. "
            "File may be too large or server too slow."
        )
    except Exception as e:
        raise VideoDownloadError(f"Unexpected download error: {str(e)}")

    # ── Basic file validation ─────────────────────────────────────────────────
    if not os.path.exists(dest_path) or os.path.getsize(dest_path) < 1024:
        raise VideoDownloadError("Downloaded file is empty or corrupted.")

    return dest_path


def validate_video_url(url: str) -> Dict:
    """
    IMPROVEMENT 9 — Validate a video URL without downloading the full file.
    Uses a HEAD request to check accessibility, content type, and size.

    Returns:
        {
            valid: bool,
            url_type: str,          # "direct", "google_drive", "unknown"
            detected_format: str,   # ".mp4", ".mov", etc. or "unknown"
            size_mb: float | null,
            content_type: str | null,
            error: str | null
        }
    """
    if not url or not url.strip():
        return {"valid": False, "error": "Empty URL", "url_type": "unknown",
                "detected_format": "unknown", "size_mb": None, "content_type": None}

    url = url.strip()
    parsed = urllib.parse.urlparse(url)

    # Detect URL type
    if "drive.google.com" in parsed.netloc:
        url_type = "google_drive"
    elif parsed.scheme in ("http", "https"):
        url_type = "direct"
    else:
        return {"valid": False, "url_type": "unknown", "detected_format": "unknown",
                "size_mb": None, "content_type": None,
                "error": f"Unsupported scheme: {parsed.scheme}"}

    try:
        direct_url = _resolve_url(url)
        req = urllib.request.Request(direct_url, method="HEAD")
        req.add_header("User-Agent", "Mozilla/5.0 (compatible; ImbaAI/4.0)")

        with urllib.request.urlopen(req, timeout=10) as resp:
            headers = resp.headers
            content_type = headers.get("Content-Type", "").lower().split(";")[0].strip()
            content_length = headers.get("Content-Length")

            size_mb = round(int(content_length) / (1024 * 1024), 1) if content_length else None
            ext = _detect_extension_from_headers(headers) or _detect_extension_from_url(direct_url) or "unknown"

            too_large = size_mb is not None and size_mb > MAX_VIDEO_SIZE_BYTES / (1024 * 1024)

            return {
                "valid": not too_large,
                "url_type": url_type,
                "detected_format": ext,
                "size_mb": size_mb,
                "content_type": content_type,
                "error": f"File too large: {size_mb} MB (max {MAX_VIDEO_SIZE_BYTES // 1024 // 1024} MB)" if too_large else None
            }

    except Exception as e:
        return {
            "valid": False,
            "url_type": url_type,
            "detected_format": "unknown",
            "size_mb": None,
            "content_type": None,
            "error": str(e)
        }
