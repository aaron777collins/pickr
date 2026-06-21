"""Folder scanning: produce a manifest of media items with analysis fields.

Non-recursive. Generates thumbnails into ``<folder>/.pickr/thumbs/`` and caches
per-file results keyed by source mtime in ``<folder>/.pickr/cache.json`` so
re-scans of an unchanged folder are cheap.
"""

from __future__ import annotations

import json
import os

from . import ai, thumbs
from .protocol import emit_progress, emit_result, logger
from .recognize import FACES_AVAILABLE, detect_faces


def _cache_path(folder: str) -> str:
    return os.path.join(folder, ".pickr", "cache.json")


def _load_cache(folder: str) -> dict:
    try:
        with open(_cache_path(folder), "r", encoding="utf-8") as fh:
            data = json.load(fh)
            if isinstance(data, dict):
                return data
    except FileNotFoundError:
        pass
    except Exception as exc:  # noqa: BLE001
        logger.warning("Ignoring unreadable cache %s: %s", _cache_path(folder), exc)
    return {}


def _save_cache(folder: str, cache: dict) -> None:
    path = _cache_path(folder)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(cache, fh)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not write cache %s: %s", path, exc)


def _list_media(folder: str) -> list[str]:
    names = []
    for name in sorted(os.listdir(folder)):
        full = os.path.join(folder, name)
        if not os.path.isfile(full):
            continue
        _, ext = os.path.splitext(name)
        if thumbs.kind_for_ext(ext) is not None:
            names.append(name)
    return names


def analyze_file(folder: str, filename: str) -> dict | None:
    """Analyze a single media file into a manifest item, or None if unreadable."""
    path = os.path.join(folder, filename)
    _, ext = os.path.splitext(filename)
    kind = thumbs.kind_for_ext(ext)
    if kind is None:
        return None

    thumb_path = thumbs.thumb_path_for(folder, filename)
    duration_sec: float | None = None

    try:
        if kind == "image":
            image = thumbs.load_image(path)
            w, h = image.size
            analysis_img = image
        else:
            w, h, duration_sec = thumbs.video_metadata(path)
            analysis_img = thumbs.extract_video_frame(path)
            if analysis_img is None:
                logger.warning("No frame extracted for video %s; skipping analysis", filename)
                # Still emit a manifest entry with best-effort fields.
                return {
                    "path": os.path.abspath(path),
                    "filename": filename,
                    "kind": kind,
                    "w": w,
                    "h": h,
                    "duration_sec": duration_sec,
                    "sharpness": 1,
                    "face_count": 0,
                    "phash": None,
                    "thumb_path": None,
                }
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to load %s: %s", filename, exc)
        return None

    try:
        sharpness = ai.sharpness_score(analysis_img)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sharpness failed for %s: %s", filename, exc)
        sharpness = 1
    try:
        phash = ai.phash_hex(analysis_img)
    except Exception as exc:  # noqa: BLE001
        logger.warning("pHash failed for %s: %s", filename, exc)
        phash = None
    try:
        face_count = ai.count_faces(analysis_img)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Face count failed for %s: %s", filename, exc)
        face_count = 0

    # When face_recognition is available, also store embeddings so a later
    # face_match command can compare against this item. Falls back to the Haar
    # count above when it is not.
    faces: list[dict] = []
    if FACES_AVAILABLE:
        faces = detect_faces(analysis_img)
        if faces:
            face_count = len(faces)

    try:
        thumbs.write_thumbnail(analysis_img, thumb_path)
        thumb_out: str | None = os.path.abspath(thumb_path)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Thumbnail failed for %s: %s", filename, exc)
        thumb_out = None

    return {
        "path": os.path.abspath(path),
        "filename": filename,
        "kind": kind,
        "w": w,
        "h": h,
        "duration_sec": duration_sec,
        "sharpness": sharpness,
        "face_count": face_count,
        "phash": phash,
        "thumb_path": thumb_out,
        "faces": faces,
    }


def scan_folder(folder: str) -> list[dict]:
    """Scan a folder and emit progress; returns the manifest list."""
    folder = os.path.abspath(folder)
    if not os.path.isdir(folder):
        raise NotADirectoryError(folder)

    if not FACES_AVAILABLE:
        logger.info("face_recognition disabled; face embeddings will be empty")

    names = _list_media(folder)
    total = len(names)
    cache = _load_cache(folder)
    new_cache: dict = {}
    manifest: list[dict] = []

    for i, filename in enumerate(names, start=1):
        emit_progress(i, total, filename)
        path = os.path.join(folder, filename)
        try:
            mtime = os.path.getmtime(path)
        except OSError:
            mtime = None

        entry = cache.get(filename)
        thumb_path = thumbs.thumb_path_for(folder, filename)
        cache_valid = (
            entry is not None
            and mtime is not None
            and entry.get("mtime") == mtime
            and entry.get("item") is not None
            and _thumb_ok(entry["item"], thumb_path)
        )

        if cache_valid:
            manifest.append(entry["item"])
            new_cache[filename] = entry
            continue

        item = analyze_file(folder, filename)
        if item is None:
            continue
        manifest.append(item)
        if mtime is not None:
            new_cache[filename] = {"mtime": mtime, "item": item}

    _save_cache(folder, new_cache)
    return manifest


def _thumb_ok(item: dict, thumb_path: str) -> bool:
    tp = item.get("thumb_path")
    if tp is None:
        # Item legitimately had no thumb (e.g. unreadable video frame); cache still valid.
        return True
    return os.path.exists(tp)


def run_scan(folder: str) -> None:
    manifest = scan_folder(folder)
    emit_result(manifest)
