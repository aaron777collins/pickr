"""Test that EXIF orientation is applied during image loading."""
import os
import tempfile

from PIL import Image
from pickr_sidecar.thumbs import load_image


def test_exif_transpose_applied():
    """A portrait phone photo (stored landscape + EXIF rotate-90) should
    be returned with height > width after load_image applies transpose."""
    img = Image.new("RGB", (400, 200), "red")

    tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
    try:
        from PIL.Image import Exif
        exif = Exif()
        exif[0x0112] = 6  # Orientation tag = Rotate 90 CW
        img.save(tmp.name, "JPEG", exif=exif.tobytes())

        result = load_image(tmp.name)
        # After transpose: 200x400 (portrait)
        assert result.size == (200, 400), f"Expected (200, 400), got {result.size}"
    finally:
        os.unlink(tmp.name)


def test_load_image_no_exif():
    """Images without EXIF should load normally."""
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    try:
        img = Image.new("RGB", (300, 200), "blue")
        img.save(tmp.name)
        result = load_image(tmp.name)
        assert result.size == (300, 200)
    finally:
        os.unlink(tmp.name)
