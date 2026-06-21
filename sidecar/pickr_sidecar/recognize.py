"""Face detection & matching via the `face_recognition` library (dlib-backed).

dlib can fail to build on some platforms, so the whole library is optional. When
it is missing, every function degrades gracefully (empty results) instead of
raising, and `FACES_AVAILABLE` reports the capability.
"""

from __future__ import annotations

import base64
import contextlib
import sys

import numpy as np
from PIL import Image

from .protocol import logger

try:
    # face_recognition's model loader may print to stdout and then call
    # sys.exit() (raising SystemExit) when face_recognition_models / pkg_resources
    # is missing. Redirect stdout to stderr during import so nothing pollutes the
    # JSON stream, and catch BaseException so SystemExit can't escape.
    with contextlib.redirect_stdout(sys.stderr):
        import face_recognition

    FACES_AVAILABLE = True
except BaseException as exc:  # noqa: BLE001 - dlib build / SystemExit on missing models
    face_recognition = None  # type: ignore[assignment]
    FACES_AVAILABLE = False
    logger.warning("face_recognition unavailable; face features disabled: %s", exc)


def _image_to_array(image: Image.Image) -> np.ndarray:
    return np.asarray(image.convert("RGB"))


def encode_embedding(vec: np.ndarray) -> str:
    """Encode a float64 embedding vector as base64 (raw little-endian bytes)."""
    return base64.b64encode(np.asarray(vec, dtype=np.float64).tobytes()).decode("ascii")


def decode_embedding(b64: str) -> np.ndarray:
    return np.frombuffer(base64.b64decode(b64), dtype=np.float64)


def detect_faces(image: Image.Image) -> list[dict]:
    """Return a list of {x, y, w, h, embedding_b64} for each face found.

    Empty list if face_recognition is unavailable or no faces are detected.
    """
    if not FACES_AVAILABLE:
        return []
    try:
        arr = _image_to_array(image)
        # face_recognition returns (top, right, bottom, left) boxes.
        locations = face_recognition.face_locations(arr)
        if not locations:
            return []
        encodings = face_recognition.face_encodings(arr, known_face_locations=locations)
        results: list[dict] = []
        for (top, right, bottom, left), enc in zip(locations, encodings):
            results.append(
                {
                    "x": int(left),
                    "y": int(top),
                    "w": int(right - left),
                    "h": int(bottom - top),
                    "embedding_b64": encode_embedding(enc),
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
