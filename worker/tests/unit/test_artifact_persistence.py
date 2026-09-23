"""Unit tests for deterministic artifact naming and clean-zone promotion."""

import pytest

from app.processors.artifact_persistence import artifact_key, build_completion_result, promote_clean

TENANT = "org-1"
VERSION = "version-1"
SHA = "a" * 64


def test_artifact_key_is_deterministic_for_same_inputs() -> None:
    first = artifact_key(TENANT, VERSION, SHA, "text.txt", processor_version="v2")
    second = artifact_key(TENANT, VERSION, SHA, "text.txt", processor_version="v2")
    assert first == second
    assert first == f"derived/{TENANT}/{VERSION}/{SHA}-v2-text.txt"


def test_promote_clean_only_after_scan_passed() -> None:
    key = promote_clean(TENANT, VERSION, SHA, "source.pdf", "SCAN_PASSED")
    assert key == f"clean/{TENANT}/{VERSION}/{SHA}-v1-source.pdf"


@pytest.mark.parametrize("status", ["SECURITY_FAILED", "PENDING", "SCAN_UNAVAILABLE", ""])
def test_promote_clean_rejects_any_non_passed_status(status: str) -> None:
    with pytest.raises(ValueError):
        promote_clean(TENANT, VERSION, SHA, "source.pdf", status)


def test_promote_clean_rejects_invalid_checksum() -> None:
    with pytest.raises(ValueError):
        promote_clean(TENANT, VERSION, "short", "source.pdf", "SCAN_PASSED")


def test_build_completion_result_is_compact_and_has_no_binary_fields() -> None:
    result = build_completion_result(
        artifact_refs=["clean/org-1/version-1/hash-v1-source.pdf"],
        extracted_data_ref="derived/org-1/version-1/hash-v1-extracted.json",
        checksum=SHA,
        processor_version="v1",
        duration_ms=42,
        page_count=3,
        field_count=4,
    )
    assert result == {
        "outcome": "completed",
        "artifactRefs": ["clean/org-1/version-1/hash-v1-source.pdf"],
        "extractedDataRef": "derived/org-1/version-1/hash-v1-extracted.json",
        "checksum": SHA,
        "processorVersion": "v1",
        "durationMs": 42,
        "pageCount": 3,
        "fieldCount": 4,
    }
