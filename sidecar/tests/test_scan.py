"""Tests for folder scanning, manifest structure, caching, and dedup."""

from __future__ import annotations

import os

from pickr_sidecar import scan
from pickr_sidecar.dedup import assign_dup_groups

EXPECTED_KEYS = {
    "path",
    "filename",
    "kind",
    "w",
    "h",
    "duration_sec",
    "sharpness",
    "face_count",
    "phash",
    "thumb_path",
    "faces",
}


def _make_folder(tmp_path, sharp_image, distinct_image):
    sharp_image.convert("RGB").save(tmp_path / "sharp.jpg", "JPEG", quality=92)
    distinct_image.convert("RGB").save(tmp_path / "other.png", "PNG")
    # A duplicate of sharp.jpg (re-encoded) to exercise dedup.
    sharp_image.convert("RGB").save(tmp_path / "sharp_copy.jpg", "JPEG", quality=80)
    # A non-media file that must be ignored.
    (tmp_path / "notes.txt").write_text("ignore me")
    return str(tmp_path)


def test_scan_manifest_structure(tmp_path, sharp_image, distinct_image):
    folder = _make_folder(tmp_path, sharp_image, distinct_image)
    manifest = scan.scan_folder(folder)

    filenames = {item["filename"] for item in manifest}
    assert filenames == {"sharp.jpg", "other.png", "sharp_copy.jpg"}

    for item in manifest:
        assert EXPECTED_KEYS.issubset(item.keys())
        assert item["kind"] == "image"
        assert item["duration_sec"] is None
        assert os.path.isabs(item["path"])
        assert item["w"] > 0 and item["h"] > 0
        assert 1 <= item["sharpness"] <= 10
        assert item["phash"]
        assert os.path.exists(item["thumb_path"])

    # Thumbnails landed in .pickr/thumbs.
    thumbs_dir = os.path.join(folder, ".pickr", "thumbs")
    assert os.path.isdir(thumbs_dir)


def test_scan_uses_cache_on_rescan(tmp_path, sharp_image, distinct_image):
    folder = _make_folder(tmp_path, sharp_image, distinct_image)
    first = scan.scan_folder(folder)
    assert os.path.exists(os.path.join(folder, ".pickr", "cache.json"))

    # Re-scan without changes should return the same manifest content.
    second = scan.scan_folder(folder)
    by_name = {i["filename"]: i for i in first}
    for item in second:
        assert item["phash"] == by_name[item["filename"]]["phash"]


def test_dedup_groups_duplicates(tmp_path, sharp_image, distinct_image):
    folder = _make_folder(tmp_path, sharp_image, distinct_image)
    manifest = scan.scan_folder(folder)
    grouped = assign_dup_groups(manifest)

    by_name = {i["filename"]: i for i in grouped}
    # sharp.jpg and sharp_copy.jpg are near-identical → same non-null group.
    g1 = by_name["sharp.jpg"]["dup_group"]
    g2 = by_name["sharp_copy.jpg"]["dup_group"]
    assert g1 is not None
    assert g1 == g2
    # The distinct image is not part of that group.
    assert by_name["other.png"]["dup_group"] != g1
