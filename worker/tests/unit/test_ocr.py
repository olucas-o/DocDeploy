"""Unit tests for the controlled OCR wrapper, mocking the Tesseract engine."""

from unittest.mock import patch

import pytest
from PIL import Image

from app.processors.ocr import run_ocr


def _blank_image() -> Image.Image:
    return Image.new("L", (10, 10), color=255)


def test_run_ocr_returns_engine_text() -> None:
    with patch("app.processors.ocr.pytesseract.image_to_string", return_value="Identifier: NF-1") as mocked:
        result = run_ocr(_blank_image(), languages=["por"])
    assert result == "Identifier: NF-1"
    mocked.assert_called_once()
    assert mocked.call_args.kwargs["lang"] == "por"


def test_run_ocr_uses_default_languages_when_none_given() -> None:
    with patch("app.processors.ocr.pytesseract.image_to_string", return_value="") as mocked:
        run_ocr(_blank_image())
    assert mocked.call_args.kwargs["lang"] == "por+eng"


def test_run_ocr_wraps_engine_failure_as_runtime_error() -> None:
    with patch("app.processors.ocr.pytesseract.image_to_string", side_effect=RuntimeError("timeout")):
        with pytest.raises(RuntimeError):
            run_ocr(_blank_image())
