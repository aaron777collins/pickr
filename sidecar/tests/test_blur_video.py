"""Test video blurring."""
import os
import subprocess
import tempfile

import pytest

from pickr_sidecar.blur import blur_video


@pytest.fixture
def test_video():
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    subprocess.run(
        [
            "ffmpeg", "-y", "-f", "lavfi",
            "-i", "testsrc=duration=1:size=320x240:rate=10",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", tmp.name,
        ],
        capture_output=True,
        check=True,
    )
    yield tmp.name
    os.unlink(tmp.name)


def test_blur_video_creates_output(test_video):
    with tempfile.TemporaryDirectory() as tmpdir:
        dest = os.path.join(tmpdir, "blurred.mp4")
        progress = []
        blur_video(
            test_video, dest, keep_embeddings=[],
            on_progress=lambda d, t: progress.append((d, t)),
        )
        assert os.path.exists(dest)
        assert os.path.getsize(dest) > 0
        assert len(progress) > 0
