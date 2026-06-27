"""Face blurring: detect faces and blur those not matching identified people.

Uses face_recognition for detection+encoding. Falls back gracefully when
face_recognition is unavailable (returns image unchanged).
"""

from __future__ import annotations

import cv2
import numpy as np
from PIL import Image, ImageFilter

from .protocol import logger
from .recognize import (
    FACES_AVAILABLE,
    cosine_similarity,
    decode_embedding,
    detect_faces,
)

BLUR_RADIUS = 51
MATCH_THRESHOLD = 0.6


def blur_face_region(
    image: Image.Image,
    box: dict,
    radius: int = BLUR_RADIUS,
) -> Image.Image:
    """Apply Gaussian blur to a single face region defined by {x, y, w, h}."""
    x, y, w, h = int(box["x"]), int(box["y"]), int(box["w"]), int(box["h"])
    img_w, img_h = image.size
    x1 = max(0, x)
    y1 = max(0, y)
    x2 = min(img_w, x + w)
    y2 = min(img_h, y + h)
    if x2 <= x1 or y2 <= y1:
        return image

    result = image.copy()
    face_crop = result.crop((x1, y1, x2, y2))
    blurred = face_crop.filter(ImageFilter.GaussianBlur(radius=radius))
    result.paste(blurred, (x1, y1))
    return result


def _face_matches_any(
    embedding_b64: str,
    keep_embeddings: list[np.ndarray],
    threshold: float,
) -> bool:
    """Return True if the face embedding matches any of the keep list."""
    face_emb = decode_embedding(embedding_b64)
    for keep in keep_embeddings:
        if cosine_similarity(face_emb, keep) > threshold:
            return True
    return False


def blur_non_matching_faces(
    image: Image.Image,
    keep_embeddings: list[str],
    threshold: float = MATCH_THRESHOLD,
) -> Image.Image:
    """Detect all faces and blur those not matching any keep embedding.

    Args:
        image: PIL image to process.
        keep_embeddings: List of base64-encoded embeddings to keep unblurred.
        threshold: Cosine similarity threshold for matching.

    Returns:
        New image with non-matching faces blurred. If face_recognition is
        unavailable or no faces are found, returns the original unchanged.
    """
    if not FACES_AVAILABLE:
        logger.warning("face_recognition unavailable; skipping blur")
        return image

    faces = detect_faces(image)
    if not faces:
        return image

    decoded_keep = [decode_embedding(e) for e in keep_embeddings]
    result = image.copy()

    for face in faces:
        emb = face.get("embedding_b64")
        if emb and _face_matches_any(emb, decoded_keep, threshold):
            continue
        result = blur_face_region(result, face)

    return result


def blur_frame_array(
    frame: np.ndarray,
    keep_embeddings: list[str],
    threshold: float = MATCH_THRESHOLD,
    detection_scale: float = 0.25,
) -> np.ndarray:
    """Blur non-matching faces in a raw video frame (numpy array, RGB).

    Uses downscaled detection for speed, then blurs on the full-res frame.
    """
    if not FACES_AVAILABLE:
        return frame

    import face_recognition

    h, w = frame.shape[:2]
    small_h, small_w = max(1, int(h * detection_scale)), max(1, int(w * detection_scale))
    small = cv2.resize(frame, (small_w, small_h))

    locations = face_recognition.face_locations(small)
    if not locations:
        return frame

    scale_inv = 1.0 / detection_scale
    full_locations = [
        (int(top * scale_inv), int(right * scale_inv),
         int(bottom * scale_inv), int(left * scale_inv))
        for top, right, bottom, left in locations
    ]

    encodings = face_recognition.face_encodings(frame, full_locations)
    decoded_keep = [decode_embedding(e) for e in keep_embeddings]

    result = frame.copy()
    for (top, right, bottom, left), enc in zip(full_locations, encodings):
        matched = False
        for keep in decoded_keep:
            if cosine_similarity(enc, keep) > threshold:
                matched = True
                break
        if matched:
            continue

        y1, y2 = max(0, top), min(h, bottom)
        x1, x2 = max(0, left), min(w, right)
        if y2 > y1 and x2 > x1:
            roi = result[y1:y2, x1:x2]
            ksize = BLUR_RADIUS if BLUR_RADIUS % 2 == 1 else BLUR_RADIUS + 1
            result[y1:y2, x1:x2] = cv2.GaussianBlur(roi, (ksize, ksize), 0)

    return result


def blur_video(
    src_path: str,
    dest_path: str,
    keep_embeddings: list[str],
    threshold: float = MATCH_THRESHOLD,
    detection_scale: float = 0.25,
    on_progress: callable | None = None,
) -> None:
    """Blur non-matching faces in a video, preserving audio.

    Uses ffmpeg pipes for streaming frame I/O.
    """
    import json as _json
    import subprocess

    probe = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", src_path],
        capture_output=True, text=True,
    )
    if probe.returncode != 0:
        raise RuntimeError(f"ffprobe failed on {src_path}")

    info = _json.loads(probe.stdout)
    video_stream = next(
        (s for s in info.get("streams", []) if s.get("codec_type") == "video"), None
    )
    if video_stream is None:
        raise RuntimeError(f"No video stream in {src_path}")

    w = int(video_stream["width"])
    h = int(video_stream["height"])
    fps_parts = video_stream.get("r_frame_rate", "30/1").split("/")
    fps = float(fps_parts[0]) / float(fps_parts[1]) if len(fps_parts) == 2 else 30.0
    nb_frames_str = video_stream.get("nb_frames")
    total_frames = int(nb_frames_str) if nb_frames_str and nb_frames_str.isdigit() else None

    frame_size = w * h * 3
    import os
    os.makedirs(os.path.dirname(dest_path) or ".", exist_ok=True)

    reader = subprocess.Popen(
        ["ffmpeg", "-i", src_path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-v", "quiet", "-"],
        stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )

    writer = subprocess.Popen(
        [
            "ffmpeg", "-y",
            "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-s", f"{w}x{h}", "-r", str(fps),
            "-i", "-",
            "-i", src_path,
            "-map", "0:v", "-map", "1:a?",
            "-c:v", "libx264", "-preset", "fast", "-crf", "18",
            "-c:a", "copy", "-shortest",
            "-v", "quiet",
            dest_path,
        ],
        stdin=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )

    frame_idx = 0
    try:
        while True:
            raw = reader.stdout.read(frame_size)
            if len(raw) < frame_size:
                break
            frame = np.frombuffer(raw, dtype=np.uint8).reshape(h, w, 3)
            processed = blur_frame_array(frame, keep_embeddings, threshold, detection_scale)
            writer.stdin.write(processed.tobytes())
            frame_idx += 1
            if on_progress and total_frames:
                on_progress(frame_idx, total_frames)
    finally:
        if reader.stdout:
            reader.stdout.close()
        reader.wait()
        if writer.stdin:
            writer.stdin.close()
        writer.wait()

    if not os.path.exists(dest_path) or os.path.getsize(dest_path) == 0:
        raise RuntimeError(f"blur_video produced no output for {src_path}")
