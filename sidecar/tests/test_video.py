"""Test video metadata and frame extraction with available backends."""
import subprocess
import tempfile
import os

import pytest
from PIL import Image

from pickr_sidecar.thumbs import video_metadata, extract_video_frame


@pytest.fixture
def test_video():
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "testsrc=duration=2:size=320x240:rate=25",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", tmp.name,
        ],
        capture_output=True,
        check=True,
    )
    yield tmp.name
    os.unlink(tmp.name)


def test_video_metadata(test_video):
    w, h, dur = video_metadata(test_video)
    assert w == 320
    assert h == 240
    assert dur is not None and 1.5 <= dur <= 2.5


def test_extract_video_frame(test_video):
    frame = extract_video_frame(test_video)
    assert frame is not None
    assert isinstance(frame, Image.Image)
    assert frame.size[0] > 0 and frame.size[1] > 0
