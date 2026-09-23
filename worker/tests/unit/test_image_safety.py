"""Unit tests for the Pillow decompression-bomb guard."""

from io import BytesIO

import pytest
from PIL import Image

from app.processors.image_safety import open_image_safely, validate_pixel_count


def test_validate_pixel_count_accepts_reasonable_dimensions() -> None:
    validate_pixel_count(1000, 1000)


def test_validate_pixel_count_rejects_huge_dimensions() -> None:
    with pytest.raises(ValueError):
        validate_pixel_count(100_000, 100_000)


def test_validate_pixel_count_rejects_zero_or_negative_dimensions() -> None:
    with pytest.raises(ValueError):
        validate_pixel_count(0, 100)


def test_open_image_safely_returns_image_within_limit() -> None:
    buffer = BytesIO()
    Image.new("RGB", (10, 10), color="white").save(buffer, format="PNG")
    image = open_image_safely(buffer.getvalue(), max_pixels=1000)
    assert image.size == (10, 10)


def test_open_image_safely_rejects_image_over_limit() -> None:
    buffer = BytesIO()
    Image.new("RGB", (50, 50), color="white").save(buffer, format="PNG")
    with pytest.raises(ValueError):
        open_image_safely(buffer.getvalue(), max_pixels=100)
