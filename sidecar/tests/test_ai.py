"""Tests for sharpness scoring, perceptual hashing, and face counting."""

from __future__ import annotations

from pickr_sidecar import ai


def test_sharp_scores_higher_than_blurry(sharp_image, blurry_image):
    sharp_var = ai.laplacian_variance(sharp_image)
    blurry_var = ai.laplacian_variance(blurry_image)
    assert sharp_var > blurry_var

    sharp_score = ai.sharpness_score(sharp_image)
    blurry_score = ai.sharpness_score(blurry_image)
    # Meaningful, not marginal, separation.
    assert sharp_score - blurry_score >= 3
    assert 1 <= blurry_score <= 10
    assert 1 <= sharp_score <= 10


def test_phash_identical_images_match(sharp_image):
    h1 = ai.phash_hex(sharp_image)
    h2 = ai.phash_hex(sharp_image.copy())
    assert h1 == h2
    assert ai.hamming_distance(h1, h2) == 0


def test_phash_different_images_differ(sharp_image, distinct_image):
    h_sharp = ai.phash_hex(sharp_image)
    h_distinct = ai.phash_hex(distinct_image)
    assert h_sharp != h_distinct
    assert ai.hamming_distance(h_sharp, h_distinct) > 8


def test_face_count_blank_image_is_zero(solid_image):
    assert ai.count_faces(solid_image) == 0
