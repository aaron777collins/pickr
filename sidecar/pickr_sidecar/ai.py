"""Image analysis primitives: sharpness, perceptual hash, Haar face counting.

These functions operate on PIL images or numpy arrays and avoid any I/O so they
are cheap to unit-test.
"""

from __future__ import annotations

import functools

import cv2
import imagehash
import numpy as np
from PIL import Image

from .protocol import logger


def _to_gray(image: Image.Image) -> np.ndarray:
    """Convert a PIL image to a grayscale uint8 numpy array."""
    arr = np.asarray(image.convert("L"))
    return arr


def laplacian_variance(image: Image.Image) -> float:
    """Raw Laplacian variance — higher means more high-frequency detail (sharper)."""
    gray = _to_gray(image)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def sharpness_score(image: Image.Image) -> int:
    """Map Laplacian variance onto a 1-10 integer scale.

    Buckets are calibrated so blurry images land 1-3, acceptable 4-6, sharp 7-10.
    """
    var = laplacian_variance(image)
    # Piecewise-linear mapping. var<100 -> 1..3, 100..500 -> 4..6, >500 -> 7..10.
    if var <= 0:
        return 1
    if var < 100:
        score = 1 + (var / 100.0) * 2.0  # 1..3
    elif var < 500:
        score = 4 + ((var - 100.0) / 400.0) * 2.0  # 4..6
    else:
        # Saturate towards 10; 500 -> 7, ~5000 -> 10.
        score = 7 + min((var - 500.0) / 1500.0, 3.0)  # 7..10
    return int(max(1, min(10, round(score))))


def phash_hex(image: Image.Image) -> str:
    """Perceptual hash as a hex string (stable across resaves/scaling)."""
    return str(imagehash.phash(image))


def phash_from_hex(hex_str: str) -> imagehash.ImageHash:
    return imagehash.hex_to_hash(hex_str)


def hamming_distance(hex_a: str, hex_b: str) -> int:
    return phash_from_hex(hex_a) - phash_from_hex(hex_b)


@functools.lru_cache(maxsize=1)
def _face_cascade() -> "cv2.CascadeClassifier | None":
    path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    cascade = cv2.CascadeClassifier(path)
    if cascade.empty():
        logger.warning("Haar cascade failed to load from %s; face_count will be 0", path)
        return None
    return cascade


def count_faces(image: Image.Image) -> int:
    """Count faces with an OpenCV Haar cascade. Returns 0 on any failure."""
    cascade = _face_cascade()
    if cascade is None:
        return 0
    try:
        gray = _to_gray(image)
        faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        return int(len(faces))
    except Exception as exc:  # noqa: BLE001 - never crash a scan on one image
        logger.warning("Face counting failed: %s", exc)
        return 0
