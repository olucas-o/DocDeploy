"""Deterministic artifact naming and clean-zone promotion.

Object keys are derived from (organization, document version, content hash,
processor version) so re-running the same job produces the same key instead
of duplicating storage. Promotion to the ``clean/`` zone is only allowed once
the scan stage returned ``SCAN_PASSED``; any other status keeps the content
out of reach.
"""

from typing import Any

_ALLOWED_PROMOTION_STATUS = {"SCAN_PASSED"}
_DEFAULT_PROCESSOR_VERSION = "v1"


def _validate_identifiers(tenant_id: str, version_id: str, sha256: str) -> None:
    if not tenant_id or not version_id:
        raise ValueError("tenant_id and document_version_id are required")
    if len(sha256) != 64:
        raise ValueError("sha256 must be a 64-character hex digest")


def artifact_key(
    tenant_id: str,
    version_id: str,
    sha256: str,
    name: str,
    processor_version: str = _DEFAULT_PROCESSOR_VERSION,
) -> str:
    """Deterministic key for a derived artifact (extracted text, tables, OCR output)."""
    _validate_identifiers(tenant_id, version_id, sha256)
    return f"derived/{tenant_id}/{version_id}/{sha256}-{processor_version}-{name}"


def promote_clean(
    tenant_id: str,
    version_id: str,
    sha256: str,
    filename: str,
    scan_status: str,
    processor_version: str = _DEFAULT_PROCESSOR_VERSION,
) -> str:
    """Return the deterministic ``clean/`` key, only when the scan status allows it."""
    if scan_status not in _ALLOWED_PROMOTION_STATUS:
        raise ValueError("Object cannot be promoted before a SCAN_PASSED verdict")
    _validate_identifiers(tenant_id, version_id, sha256)
    return f"clean/{tenant_id}/{version_id}/{sha256}-{processor_version}-{filename}"


def build_completion_result(
    *,
    artifact_refs: list[str],
    extracted_data_ref: str,
    checksum: str,
    processor_version: str,
    duration_ms: int,
    page_count: int | None = None,
    field_count: int | None = None,
    outcome: str = "completed",
) -> dict[str, Any]:
    """Build the compact completion payload defined by the processing-queue contract.

    Only references, hashes and small counters are included; no binary
    content, extracted text or arbitrary URLs ever leave the worker.
    """
    result: dict[str, Any] = {
        "outcome": outcome,
        "artifactRefs": list(artifact_refs),
        "extractedDataRef": extracted_data_ref,
        "checksum": checksum,
        "processorVersion": processor_version,
        "durationMs": duration_ms,
    }
    if page_count is not None:
        result["pageCount"] = page_count
    if field_count is not None:
        result["fieldCount"] = field_count
    return result


__all__ = ["artifact_key", "build_completion_result", "promote_clean"]
