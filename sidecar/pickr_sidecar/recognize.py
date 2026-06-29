"""Face detection & recognition via OpenCV's YuNet + SFace (ONNX models).

Works cross-platform with only opencv-python-headless — no dlib or C++ build
required.  Models are downloaded once on first use and cached in a platform-
appropriate data directory.
"""

from __future__ import annotations

import base64
import os
import platform
import urllib.request

import cv2
import numpy as np
from PIL import Image

from .protocol import logger

# ---------------------------------------------------------------------------
# Model management
# ---------------------------------------------------------------------------

_YUNET_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
_SFACE_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

_YUNET_FILENAME = "face_detection_yunet_2023mar.onnx"
_SFACE_FILENAME = "face_recognition_sface_2021dec.onnx"


def _models_dir() -> str:
    """Platform-appropriate cache directory for ONNX models."""
    system = platform.system()
    if system == "Darwin":
        base = os.path.join(os.path.expanduser("~"), "Library", "Caches")
    elif system == "Windows":
        base = os.environ.get("LOCALAPPDATA", os.path.expanduser("~"))
    else:
        base = os.environ.get("XDG_CACHE_HOME", os.path.join(os.path.expanduser("~"), ".cache"))
    d = os.path.join(base, "pickr", "models")
    os.makedirs(d, exist_ok=True)
    return d


def _ensure_model(filename: str, url: str) -> str:
    """Return local path to model, downloading if absent."""
    path = os.path.join(_models_dir(), filename)
    if os.path.isfile(path):
        return path
    logger.info("Downloading %s …", filename)
    tmp = path + ".tmp"
    try:
        urllib.request.urlretrieve(url, tmp)
        os.replace(tmp, path)
    except Exception:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise
    logger.info("Saved %s (%d bytes)", filename, os.path.getsize(path))
    return path


# ---------------------------------------------------------------------------
# Lazy singletons for detector / recognizer
# ---------------------------------------------------------------------------

_detector: cv2.FaceDetectorYN | None = None
_recognizer: cv2.FaceRecognizerSF | None = None
_detector_input_size: tuple[int, int] = (0, 0)


_SCORE_THRESHOLD = 0.9
_NMS_THRESHOLD = 0.3
_MIN_FACE_SIZE = 20


def _get_detector(w: int, h: int) -> cv2.FaceDetectorYN:
    global _detector, _detector_input_size
    if _detector is None or _detector_input_size != (w, h):
        model_path = _ensure_model(_YUNET_FILENAME, _YUNET_URL)
        _detector = cv2.FaceDetectorYN.create(
            model_path, "", (w, h),
            score_threshold=_SCORE_THRESHOLD,
            nms_threshold=_NMS_THRESHOLD,
        )
        _detector_input_size = (w, h)
    return _detector


def _get_recognizer() -> cv2.FaceRecognizerSF:
    global _recognizer
    if _recognizer is None:
        model_path = _ensure_model(_SFACE_FILENAME, _SFACE_URL)
        _recognizer = cv2.FaceRecognizerSF.create(model_path, "")
    return _recognizer


FACES_AVAILABLE = hasattr(cv2, "FaceDetectorYN") and hasattr(cv2, "FaceRecognizerSF")

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def encode_embedding(vec: np.ndarray) -> str:
    """Encode a float64 embedding vector as base64 (raw little-endian bytes)."""
    return base64.b64encode(np.asarray(vec, dtype=np.float64).tobytes()).decode("ascii")


def decode_embedding(b64: str) -> np.ndarray:
    return np.frombuffer(base64.b64decode(b64), dtype=np.float64)


def _remove_contained_faces(raw_faces: np.ndarray, overlap_thresh: float = 0.6) -> np.ndarray:
    """Remove detections mostly contained within a larger detection."""
    if len(raw_faces) <= 1:
        return raw_faces

    boxes = raw_faces[:, :4].copy()
    areas = boxes[:, 2] * boxes[:, 3]
    keep = []

    order = np.argsort(-areas)
    kept_indices: list[int] = []

    for idx in order:
        x1, y1, w1, h1 = boxes[idx]
        contained = False
        for ki in kept_indices:
            x2, y2, w2, h2 = boxes[ki]
            ix1 = max(x1, x2)
            iy1 = max(y1, y2)
            ix2 = min(x1 + w1, x2 + w2)
            iy2 = min(y1 + h1, y2 + h2)
            if ix2 > ix1 and iy2 > iy1:
                inter = (ix2 - ix1) * (iy2 - iy1)
                if inter / max(areas[idx], 1) > overlap_thresh:
                    contained = True
                    break
        if not contained:
            kept_indices.append(idx)

    return raw_faces[kept_indices] if kept_indices else raw_faces[:0]


def detect_faces(image: Image.Image) -> list[dict]:
    """Return a list of {x, y, w, h, embedding_b64} for each face found.

    Empty list if OpenCV's face APIs are unavailable or no faces are detected.
    """
    if not FACES_AVAILABLE:
        return []
    try:
        arr = np.asarray(image.convert("RGB"))
        bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
        h, w = bgr.shape[:2]

        detector = _get_detector(w, h)
        _, raw_faces = detector.detect(bgr)
        if raw_faces is None or len(raw_faces) == 0:
            return []

        size_mask = (raw_faces[:, 2] >= _MIN_FACE_SIZE) & (raw_faces[:, 3] >= _MIN_FACE_SIZE)
        raw_faces = raw_faces[size_mask]
        if len(raw_faces) == 0:
            return []

        raw_faces = _remove_contained_faces(raw_faces)
        if len(raw_faces) == 0:
            return []

        recognizer = _get_recognizer()
        results: list[dict] = []
        for face in raw_faces:
            fx, fy, fw, fh = int(face[0]), int(face[1]), int(face[2]), int(face[3])
            aligned = recognizer.alignCrop(bgr, face)
            embedding = recognizer.feature(aligned).flatten()
            results.append(
                {
                    "x": fx,
                    "y": fy,
                    "w": fw,
                    "h": fh,
                    "embedding_b64": encode_embedding(embedding),
                }
            )
        return results
    except Exception as exc:  # noqa: BLE001
        logger.warning("Face detection failed: %s", exc)
        return []


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)
