"""Blur-export command: blur non-identified faces during export.

Expects a JSON config file:
{
  "keep_embeddings": ["base64_emb1", ...],
  "items": [
    {"src": "/path/to/file", "dest": "/export/01_file.jpg", "kind": "image"|"video"},
    ...
  ]
}
"""
from __future__ import annotations

import json
import os

from . import thumbs
from .blur import blur_non_matching_faces, blur_video
from .protocol import emit_error, emit_progress, emit_result, logger


def run_blur_export(config_path: str) -> int:
    if not os.path.isfile(config_path):
        emit_error(f"config file not found: {config_path}")
        return 1

    try:
        with open(config_path, "r", encoding="utf-8") as fh:
            config = json.load(fh)
    except Exception as exc:
        emit_error(f"could not read config: {exc}")
        return 1

    keep_embeddings: list[str] = config.get("keep_embeddings", [])
    items: list[dict] = config.get("items", [])
    total = len(items)
    exported = 0
    skipped = 0

    for i, item in enumerate(items, start=1):
        src = item.get("src", "")
        dest = item.get("dest", "")
        kind = item.get("kind", "image")

        if not os.path.isfile(src):
            logger.warning("Source not found, skipping: %s", src)
            skipped += 1
            continue

        emit_progress(i, total, os.path.basename(src))

        try:
            if kind == "video":
                def on_video_progress(done: int, frame_total: int) -> None:
                    emit_progress(i, total, f"frame {done}/{frame_total}")
                blur_video(src, dest, keep_embeddings, on_progress=on_video_progress)
            else:
                image = thumbs.load_image(src)
                blurred = blur_non_matching_faces(image, keep_embeddings)
                os.makedirs(os.path.dirname(dest) or ".", exist_ok=True)
                if blurred.mode != "RGB":
                    blurred = blurred.convert("RGB")
                _, ext = os.path.splitext(dest)
                fmt = "PNG" if ext.lower() == ".png" else "JPEG"
                blurred.save(dest, fmt, quality=92)
            exported += 1
        except Exception as exc:
            logger.warning("Blur failed for %s: %s", src, exc)
            skipped += 1

    emit_result({"exported_count": exported, "skipped_count": skipped})
    return 0
