"""Shared fixtures: programmatic sharp/blurry/checker images, no binary assets."""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image, ImageDraw, ImageFilter


def _checkerboard(size: int = 256, cell: int = 16) -> Image.Image:
    """High-frequency black/white checkerboard — intentionally very sharp."""
    arr = np.zeros((size, size), dtype=np.uint8)
    for y in range(size):
        for x in range(size):
            if ((x // cell) + (y // cell)) % 2 == 0:
                arr[y, x] = 255
    return Image.fromarray(arr, mode="L").convert("RGB")


@pytest.fixture
def sharp_image() -> Image.Image:
    return _checkerboard()


@pytest.fixture
def blurry_image(sharp_image: Image.Image) -> Image.Image:
    return sharp_image.filter(ImageFilter.GaussianBlur(radius=6))


@pytest.fixture
def solid_image() -> Image.Image:
    """A plain mid-gray image — no edges, no faces."""
    return Image.new("RGB", (256, 256), (128, 128, 128))


@pytest.fixture
def distinct_image() -> Image.Image:
    """A structured image very different from the checkerboard."""
    img = Image.new("RGB", (256, 256), (10, 20, 30))
    draw = ImageDraw.Draw(img)
    draw.ellipse((40, 40, 200, 200), fill=(220, 60, 90))
    draw.rectangle((10, 10, 60, 60), fill=(40, 200, 120))
    return img


@pytest.fixture
def write_jpeg(tmp_path):
    def _write(image: Image.Image, name: str) -> str:
        path = tmp_path / name
        image.convert("RGB").save(path, "JPEG", quality=92)
        return str(path)

    return _write
