"""Unit tests for signature validation and fail-closed antivirus scanning."""

import pytest

from app.processors.virus_scan import ScanFailure, validate_signature, virus_scan


def test_validate_signature_accepts_matching_pdf_bytes() -> None:
    validate_signature(b"%PDF-1.7\n...", "application/pdf")


def test_validate_signature_accepts_matching_png_and_tiff_bytes() -> None:
    validate_signature(b"\x89PNG\r\n\x1a\n" + b"0" * 16, "image/png")
    validate_signature(b"II*\x00" + b"0" * 16, "image/tiff")


@pytest.mark.parametrize("content_type", ["application/pdf", "image/png", "image/jpeg", "image/tiff"])
def test_validate_signature_rejects_mismatched_bytes_as_corrupt(content_type: str) -> None:
    with pytest.raises(ScanFailure) as excinfo:
        validate_signature(b"not-a-real-payload-with-wrong-magic-bytes", content_type)
    assert excinfo.value.code == "CORRUPT_FILE"
    assert excinfo.value.retryable is False


def test_validate_signature_rejects_unsupported_content_type() -> None:
    with pytest.raises(ScanFailure) as excinfo:
        validate_signature(b"%PDF-1.7", "application/zip")
    assert excinfo.value.code == "UNSUPPORTED_FORMAT"


def test_validate_signature_rejects_executable_payload() -> None:
    with pytest.raises(ScanFailure) as excinfo:
        validate_signature(b"MZ\x90\x00\x03\x00\x00\x00", "application/pdf")
    assert excinfo.value.code == "EXECUTABLE_CONTENT"
    assert excinfo.value.category == "permanent"


def test_validate_signature_rejects_zip_payload() -> None:
    with pytest.raises(ScanFailure) as excinfo:
        validate_signature(b"PK\x03\x04rest-of-archive", "application/pdf")
    assert excinfo.value.code == "UNSUPPORTED_FORMAT"


def test_validate_signature_rejects_encrypted_pdf() -> None:
    content = b"%PDF-1.7\n/Encrypt 5 0 R\n"
    with pytest.raises(ScanFailure) as excinfo:
        validate_signature(content, "application/pdf")
    assert excinfo.value.code == "ENCRYPTED_FILE"


def test_validate_signature_rejects_oversized_content() -> None:
    with pytest.raises(ScanFailure) as excinfo:
        validate_signature(b"%PDF-" + b"0" * 10, "application/pdf", max_bytes=5)
    assert excinfo.value.code == "FILE_TOO_LARGE"


def test_virus_scan_returns_scan_passed_on_ok_verdict() -> None:
    assert virus_scan(b"clean", lambda _: "stream: OK") == "SCAN_PASSED"


def test_virus_scan_raises_malware_on_found_verdict() -> None:
    with pytest.raises(ScanFailure) as excinfo:
        virus_scan(b"eicar", lambda _: "stream: Eicar-Test-Signature FOUND")
    assert excinfo.value.code == "MALWARE"
    assert excinfo.value.retryable is False


def test_virus_scan_fails_closed_when_transport_raises() -> None:
    def broken_transport(_: bytes) -> str:
        raise ConnectionError("clamd unreachable")

    with pytest.raises(ScanFailure) as excinfo:
        virus_scan(b"content", broken_transport)
    assert excinfo.value.code == "SCAN_UNAVAILABLE"
    assert excinfo.value.retryable is True


def test_virus_scan_fails_closed_on_empty_verdict() -> None:
    with pytest.raises(ScanFailure) as excinfo:
        virus_scan(b"content", lambda _: "")
    assert excinfo.value.code == "SCAN_UNAVAILABLE"


def test_virus_scan_fails_closed_on_ambiguous_verdict() -> None:
    with pytest.raises(ScanFailure) as excinfo:
        virus_scan(b"content", lambda _: "UNKNOWN RESPONSE")
    assert excinfo.value.code == "SCAN_UNAVAILABLE"
