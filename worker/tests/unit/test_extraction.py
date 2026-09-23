"""Unit tests for native PDF text extraction and minimal field parsing."""

import fitz
import pytest

from app.processors.extraction import (
    extract_minimum_fields,
    extract_pdf_text,
    needs_layout_analysis,
    needs_ocr,
)


def _build_pdf_with_text(text: str) -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    content = document.tobytes()
    document.close()
    return content


def test_extract_pdf_text_returns_native_text_per_page() -> None:
    content = _build_pdf_with_text("Identifier: NF-42")
    pages = extract_pdf_text(content)
    assert len(pages) == 1
    assert "Identifier: NF-42" in pages[0].text


def test_needs_ocr_true_for_blank_page() -> None:
    content = _build_pdf_with_text("")
    pages = extract_pdf_text(content)
    assert needs_ocr(pages) is True
    assert needs_layout_analysis(pages) is True


def test_needs_ocr_false_when_page_has_enough_native_text() -> None:
    content = _build_pdf_with_text("A" * 40)
    pages = extract_pdf_text(content)
    assert needs_ocr(pages) is False


@pytest.mark.parametrize(
    ("text", "expected_keys"),
    [
        ("Identifier: NF-1\nIssuer: ACME\nDate: 2026-01-01\nValue: 10.00", {"identifier", "issuer", "relevant_date", "value"}),
        ("Nothing relevant here", set()),
        ("Issuer: ACME only", {"issuer"}),
    ],
)
def test_extract_minimum_fields_parses_known_labels(text: str, expected_keys: set[str]) -> None:
    fields = extract_minimum_fields(text)
    assert {field.key for field in fields} == expected_keys
