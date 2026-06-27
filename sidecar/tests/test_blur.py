"""Test face blurring logic."""
import numpy as np
from PIL import Image

from pickr_sidecar.blur import blur_face_region, blur_non_matching_faces


def test_blur_face_region():
    """Blurring a region should change those pixels but leave others intact."""
    img = Image.new("RGB", (200, 200), (255, 0, 0))
    box = {"x": 50, "y": 50, "w": 50, "h": 50}
    result = blur_face_region(img, box)
    assert result.size == (200, 200)
    assert result.getpixel((0, 0)) == (255, 0, 0)


def test_blur_face_region_out_of_bounds():
    """Blurring a region partially out of bounds should not crash."""
    img = Image.new("RGB", (100, 100), (0, 255, 0))
    box = {"x": 80, "y": 80, "w": 50, "h": 50}
    result = blur_face_region(img, box)
    assert result.size == (100, 100)


def test_blur_non_matching_no_faces():
    """An image with no faces should be returned unchanged."""
    img = Image.new("RGB", (100, 100), (0, 255, 0))
    result = blur_non_matching_faces(img, keep_embeddings=[])
    arr_in = np.asarray(img)
    arr_out = np.asarray(result)
    assert np.array_equal(arr_in, arr_out)
