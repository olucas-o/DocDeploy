"""Local, deterministic extraction: native PDF text first, layout second.

PyMuPDF is used for fast native text extraction. pdfplumber is only invoked
when a page needs table/layout analysis, since it is considerably slower.
Nothing here talks to the network or persists binaries; callers decide what
to keep as a compact artifact.
"""

from dataclasses import dataclass
from io import BytesIO
from re import Pattern, compile as re_compile

import fitz  # PyMuPDF

_MIN_NATIVE_CHARS = 20

_FIELD_PATTERNS: dict[str, Pattern[str]] = {
    "identifier": re_compile(r"Identifier:\s*(.+)"),
    "issuer": re_compile(r"Issuer:\s*(.+)"),
    "relevant_date": re_compile(r"Date:\s*(.+)"),
    "value": re_compile(r"Value:\s*(.+)"),
}


@dataclass(frozen=True)
class PageContent:
    page: int
    text: str

    @property
    def char_count(self) -> int:
        return len(self.text.strip())


@dataclass(frozen=True)
class ExtractedFieldResult:
    key: str
    value: str
    source: str = "local"
    page: int | None = None
    excerpt: str | None = None
    confidence: float | None = None


def extract_pdf_text(content: bytes) -> list[PageContent]:
    """Extract native text per page using PyMuPDF, without OCR fallback."""
    pages: list[PageContent] = []
    with fitz.open(stream=content, filetype="pdf") as document:
        for index, page in enumerate(document, start=1):
            text = page.get_text("text") or ""
            pages.append(PageContent(page=index, text=text))
    return pages


def needs_layout_analysis(pages: list[PageContent], min_chars: int = _MIN_NATIVE_CHARS) -> bool:
    """True when at least one page has too little native text for reliable extraction."""
    return any(page.char_count < min_chars for page in pages)


def needs_ocr(pages: list[PageContent], min_chars: int = _MIN_NATIVE_CHARS) -> bool:
    """True when at least one page has no usable native text and likely needs OCR."""
    return any(page.char_count < min_chars for page in pages)


def extract_tables(content: bytes) -> dict[int, list[list[list[str | None]]]]:
    """Extract tables/layout only for pages that need it, using pdfplumber."""
    import pdfplumber

    tables_by_page: dict[int, list[list[list[str | None]]]] = {}
    with pdfplumber.open(BytesIO(content)) as document:
        for index, page in enumerate(document.pages, start=1):
            tables = page.extract_tables()
            if tables:
                tables_by_page[index] = tables
    return tables_by_page


def extract_minimum_fields(text: str) -> list[ExtractedFieldResult]:
    """Extract the small, well-known set of governance fields from plain text."""
    fields: list[ExtractedFieldResult] = []
    for key, pattern in _FIELD_PATTERNS.items():
        match = pattern.search(text)
        if not match:
            continue
        fields.append(
            ExtractedFieldResult(
                key=key,
                value=match.group(1).strip(),
                excerpt=match.group(0).strip(),
                confidence=1.0,
            )
        )
    return fields


__all__ = [
    "ExtractedFieldResult",
    "PageContent",
    "extract_minimum_fields",
    "extract_pdf_text",
    "extract_tables",
    "needs_layout_analysis",
    "needs_ocr",
]
