"""Pipeline integration tests with isolated infrastructure fakes."""

from hashlib import sha256

import pytest

from app.processors.artifact_persistence import artifact_key, promote_clean
from app.processors.extraction import extract_minimum_fields
from app.processors.image_safety import validate_pixel_count
from app.processors.virus_scan import ScanFailure, validate_signature, virus_scan


@pytest.mark.integration
def test_clean_pdf_is_scanned_extracted_and_promoted() -> None:
    content = b"%PDF-1.7\nIdentifier: NF-42\nIssuer: ACME\nDate: 2026-09-21\nValue: 120.50"
    validate_signature(content, "application/pdf")
    assert virus_scan(content, lambda _: "OK") == "SCAN_PASSED"
    fields = extract_minimum_fields(content.decode())
    assert {field.key for field in fields} == {"identifier", "issuer", "relevant_date", "value"}
    promoted = promote_clean("org-1", "version-1", sha256(content).hexdigest(), "source.pdf", "SCAN_PASSED")
    assert promoted.startswith("clean/org-1/version-1/")
    assert artifact_key("org-1", "version-1", sha256(content).hexdigest(), "text.txt").startswith("derived/")


@pytest.mark.integration
def test_pipeline_fails_closed_for_malware_or_invalid_image() -> None:
    with pytest.raises(ScanFailure):
        virus_scan(b"malware", lambda _: "Eicar-Test-Signature FOUND")
    with pytest.raises(ValueError):
        promote_clean("org-1", "version-1", "a" * 64, "source.pdf", "SECURITY_FAILED")
    with pytest.raises(ValueError):
        validate_pixel_count(100_000, 100_000)
