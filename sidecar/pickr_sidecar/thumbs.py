"""Media loading and thumbnail generation.

Handles HEIC/HEIF decoding (via pillow-heif) and video frame extraction (via
imageio/ffmpeg). All callers get a PIL.Image back regardless of source kind.
"""

from __future__ import annotations

import os

from PIL import Image, ImageOps

from .protocol import logger

# Register HEIF/HEIC support so PIL.Image.open handles .heic/.heif directly.
try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
    _HEIF_OK = True
except Exception as exc:  # noqa: BLE001
    logger.warning("pillow-heif unavailable; HEIC files will fail to load: %s", exc)
    _HEIF_OK = False

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".heic", ".heif"}
VIDEO_EXTS = {".mp4", ".mov", ".avi", ".webm", ".mkv"}
MEDIA_EXTS = IMAGE_EXTS | VIDEO_EXTS

THUMB_LONG_EDGE = 320
VIDEO_FRAME_FRACTION = 0.40
NEEDS_PREVIEW_EXTS = {".heic", ".heif"}


def kind_for_ext(ext: str) -> str | None:
    ext = ext.lower()
    if ext in IMAGE_EXTS:
        return "image"
    if ext in VIDEO_EXTS:
        return "video"
    return None


def load_image(path: str) -> Image.Image:
    """Open an image file as an RGB PIL image with EXIF orientation applied."""
    img = Image.open(path)
    img.load()
    img = ImageOps.exif_transpose(img) or img
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return img


def _video_plugin() -> str:
    """Return the best available imageio plugin for video I/O."""
    try:
        import av  # noqa: F401
        return "pyav"
    except ImportError:
        return "FFMPEG"


def video_metadata(path: str) -> tuple[int, int, float | None]:
    """Return (width, height, duration_sec) for a video. Best-effort."""
    import imageio.v3 as iio

    plugin = _video_plugin()
    width = height = 0
    duration: float | None = None
    try:
        meta = iio.immeta(path, plugin=plugin)
        size = meta.get("source_size") or meta.get("size") or meta.get("shape")
        if size and len(size) >= 2:
            width, height = int(size[0]), int(size[1])
        if meta.get("duration") is not None:
            duration = float(meta["duration"])
        fps = meta.get("fps")
        n_frames = meta.get("nframes") or meta.get("n_images")
        if duration is None and fps and n_frames and n_frames not in (float("inf"),):
            duration = float(n_frames) / float(fps)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not read video metadata for %s: %s", path, exc)
    if width == 0 or height == 0:
        frame = extract_video_frame(path)
        if frame is not None:
            width, height = frame.size
    return width, height, duration


def extract_video_frame(path: str, fraction: float = VIDEO_FRAME_FRACTION) -> Image.Image | None:
    """Extract a representative frame at `fraction` of the video as a PIL image."""
    import imageio.v3 as iio

    plugin = _video_plugin()
    try:
        try:
            n_frames = iio.improps(path, plugin=plugin).shape[0]
        except Exception:
            n_frames = None
        if n_frames and n_frames > 0 and n_frames != float("inf"):
            idx = max(0, min(n_frames - 1, int(n_frames * fraction)))
            frame = iio.imread(path, index=idx, plugin=plugin)
        else:
            frame = iio.imread(path, index=0, plugin=plugin)
        return Image.fromarray(frame).convert("RGB")
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to extract frame from %s: %s", path, exc)
        return None


def load_media_image(path: str, kind: str) -> Image.Image | None:
    """Return a PIL image for either an image file or a video's representative frame."""
    if kind == "image":
        return load_image(path)
    return extract_video_frame(path)


def thumbs_dir(folder: str) -> str:
    return os.path.join(folder, ".pickr", "thumbs")


def thumb_path_for(folder: str, filename: str) -> str:
    stem, _ = os.path.splitext(filename)
    return os.path.join(thumbs_dir(folder), f"{stem}_thumb.jpg")


def write_thumbnail(image: Image.Image, dest_path: str, long_edge: int = THUMB_LONG_EDGE) -> str:
    """Write a JPEG thumbnail scaled so its long edge is `long_edge` px."""
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    thumb = image.copy()
    if thumb.mode != "RGB":
        thumb = thumb.convert("RGB")
    thumb.thumbnail((long_edge, long_edge), Image.LANCZOS)
    thumb.save(dest_path, "JPEG", quality=85)
    return dest_path


def preview_path_for(folder: str, filename: str) -> str:
    stem, _ = os.path.splitext(filename)
    return os.path.join(thumbs_dir(folder), f"{stem}_preview.jpg")


def write_preview(image: Image.Image, dest_path: str) -> str:
    """Write a full-resolution JPEG preview for formats the browser can't display."""
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    preview = image if image.mode == "RGB" else image.convert("RGB")
    preview.save(dest_path, "JPEG", quality=92)
    return dest_path
