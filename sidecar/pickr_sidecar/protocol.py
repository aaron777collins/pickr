"""Newline-delimited JSON output protocol.

stdout carries ONLY structured JSON (one object per line). All human-readable
logging goes to stderr so the Rust parent can parse stdout unambiguously.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any

logger = logging.getLogger("pickr_sidecar")


def _setup_logging() -> None:
    if logger.handlers:
        return
    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(logging.Formatter("[pickr-sidecar] %(levelname)s: %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)


_setup_logging()


def emit(obj: dict[str, Any]) -> None:
    """Write one JSON object as a line to stdout and flush immediately."""
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def emit_progress(done: int, total: int, current: str) -> None:
    emit({"type": "progress", "done": done, "total": total, "current": current})


def emit_result(data: Any) -> None:
    emit({"type": "result", "data": data})


def emit_error(message: str) -> None:
    emit({"type": "error", "message": message})
