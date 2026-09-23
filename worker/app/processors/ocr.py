"""Controlled OCR invocation via pytesseract, only used when native text is missing."""

from collections.abc import Sequence

import pytesseract
from PIL import Image

DEFAULT_LANGUAGES: tuple[str, ...] = ("por", "eng")
DEFAULT_TIMEOUT_SECONDS = 30


def run_ocr(image: Image.Image, languages: Sequence[str] | None = None, timeout: int = DEFAULT_TIMEOUT_SECONDS) -> str:
    """Run Tesseract OCR on an already safety-checked image.

    A bounded ``timeout`` prevents a single malformed or adversarial image
    from hanging the worker. Any engine failure surfaces as a plain
    ``RuntimeError`` so callers can classify it as a retryable dependency
    failure instead of leaking Tesseract internals.
    """
    selected = list(languages) if languages else list(DEFAULT_LANGUAGES)
    lang = "+".join(selected)
    try:
        return pytesseract.image_to_string(image, lang=lang, timeout=timeout)
    except pytesseract.TesseractNotFoundError as error:
        raise RuntimeError("OCR engine is not available") from error
    except RuntimeError as error:
        raise RuntimeError("OCR processing failed or timed out") from error


__all__ = ["DEFAULT_LANGUAGES", "run_ocr"]
