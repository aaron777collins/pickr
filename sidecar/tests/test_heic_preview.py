"""Test that preview JPEG is generated for non-web-native image formats."""
import os
import tempfile

from PIL import Image

from pickr_sidecar.thumbs import NEEDS_PREVIEW_EXTS, preview_path_for, write_preview


def test_preview_path_for():
    path = preview_path_for("/photos", "vacation.heic")
    assert path.endswith("vacation_preview.jpg")
    assert ".pickr" in path


def test_write_preview_creates_jpeg():
    img = Image.new("RGB", (2000, 1500), "green")
    with tempfile.TemporaryDirectory() as tmpdir:
        dest = os.path.join(tmpdir, "preview.jpg")
        write_preview(img, dest)
        assert os.path.exists(dest)
        result = Image.open(dest)
        assert result.size == (2000, 1500)
        assert result.format == "JPEG"


def test_needs_preview_exts():
    assert ".heic" in NEEDS_PREVIEW_EXTS
    assert ".heif" in NEEDS_PREVIEW_EXTS
    assert ".jpg" not in NEEDS_PREVIEW_EXTS
    assert ".png" not in NEEDS_PREVIEW_EXTS
