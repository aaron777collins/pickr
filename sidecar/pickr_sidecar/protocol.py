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


def _configure_streams() -> None:
    # The Rust parent splits stdout on '\n' and parses each line as UTF-8 JSON.
    # On Windows, stdout defaults to text mode (translates '\n' -> '\r\n') and to
    # the locale codepage, both of which corrupt the NDJSON stream. Force UTF-8
    # and disable newline translation on every platform so output is identical.
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is not None:
            try:
                reconfigure(encoding="utf-8", newline="\n")
            except (ValueError, OSError):
                pass


_configure_streams()


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
