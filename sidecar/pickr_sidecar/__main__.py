"""CLI dispatcher for the Pickr sidecar.

Usage:
    pickr-sidecar scan <folder>
    pickr-sidecar dedup <manifest_json_path>
    pickr-sidecar face_detect <image_or_video_path>
    pickr-sidecar face_match <embedding_b64> <manifest_json_path>

All structured output is newline-delimited JSON on stdout; logs go to stderr.
"""

from __future__ import annotations

import json
import os
import sys

from . import thumbs
from .dedup import assign_dup_groups
from .protocol import emit_error, emit_result, logger
from .recognize import cosine_similarity, decode_embedding, detect_faces
from .scan import run_scan

FACE_MATCH_THRESHOLD = 0.6


def _read_manifest(path: str) -> list[dict]:
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if isinstance(data, dict) and "data" in data:
        data = data["data"]
    if not isinstance(data, list):
        raise ValueError("manifest must be a JSON array (or {'data': [...]})")
    return data


def cmd_scan(args: list[str]) -> int:
    if len(args) != 1:
        emit_error("scan requires exactly one argument: <folder>")
        return 2
    folder = args[0]
    if not os.path.isdir(folder):
        emit_error(f"not a directory: {folder}")
        return 1
    run_scan(folder)
    return 0


def cmd_dedup(args: list[str]) -> int:
    if len(args) != 1:
        emit_error("dedup requires exactly one argument: <manifest_json_path>")
        return 2
    try:
        manifest = _read_manifest(args[0])
    except Exception as exc:  # noqa: BLE001
        emit_error(f"could not read manifest: {exc}")
        return 1
    emit_result(assign_dup_groups(manifest))
    return 0


def _load_image_or_frame(path: str):
    _, ext = os.path.splitext(path)
    kind = thumbs.kind_for_ext(ext)
    if kind == "image":
        return thumbs.load_image(path)
    if kind == "video":
        return thumbs.extract_video_frame(path)
    # Unknown extension: try as image.
    return thumbs.load_image(path)


def cmd_face_detect(args: list[str]) -> int:
    if len(args) != 1:
        emit_error("face_detect requires exactly one argument: <image_path>")
        return 2
    path = args[0]
    if not os.path.isfile(path):
        emit_error(f"file not found: {path}")
        return 1
    try:
        image = _load_image_or_frame(path)
    except Exception as exc:  # noqa: BLE001
        emit_error(f"could not load media: {exc}")
        return 1
    if image is None:
        emit_result([])
        return 0
    emit_result(detect_faces(image))
    return 0


def cmd_face_match(args: list[str]) -> int:
    if len(args) != 2:
        emit_error("face_match requires two arguments: <embedding_b64> <manifest_json_path>")
        return 2
    embedding_b64, manifest_path = args
    try:
        query = decode_embedding(embedding_b64)
    except Exception as exc:  # noqa: BLE001
        emit_error(f"invalid embedding_b64: {exc}")
        return 1
    try:
        manifest = _read_manifest(manifest_path)
    except Exception as exc:  # noqa: BLE001
        emit_error(f"could not read manifest: {exc}")
        return 1

    matches: list[str] = []
    for item in manifest:
        path = item.get("path")
        faces = item.get("faces") or []
        matched = False
        for face in faces:
            b64 = face.get("embedding_b64") if isinstance(face, dict) else None
            if not b64:
                continue
            try:
                emb = decode_embedding(b64)
            except Exception:
                continue
            if cosine_similarity(query, emb) > FACE_MATCH_THRESHOLD:
                matched = True
                break
        if matched and path:
            matches.append(path)
    emit_result(matches)
    return 0


COMMANDS = {
    "scan": cmd_scan,
    "dedup": cmd_dedup,
    "face_detect": cmd_face_detect,
    "face_match": cmd_face_match,
}


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv:
        emit_error(f"no command given; expected one of: {', '.join(COMMANDS)}")
        return 2
    command, rest = argv[0], argv[1:]
    handler = COMMANDS.get(command)
    if handler is None:
        emit_error(f"unknown command: {command}; expected one of: {', '.join(COMMANDS)}")
        return 2
    try:
        return handler(rest)
    except Exception as exc:  # noqa: BLE001 - last-resort guard
        logger.exception("Unhandled error in command %s", command)
        emit_error(str(exc))
        return 1


if __name__ == "__main__":
    sys.exit(main())
