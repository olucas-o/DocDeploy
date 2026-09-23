"""Pipeline integration tests with isolated infrastructure fakes."""

from hashlib import sha256

import asyncio
import fitz
import pytest

from app.clients.queue import ProcessingFailure
from app.consumers.document_processing import build_pipeline_handler
from app.models.processing_job import ProcessingJob
from app.processors.artifact_persistence import artifact_key, promote_clean
from app.processors.extraction import extract_minimum_fields
from app.processors.image_safety import validate_pixel_count
from app.processors.virus_scan import ScanFailure, validate_signature, virus_scan


def _build_pdf(text: str) -> bytes:
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    content = document.tobytes()
    document.close()
    return content


def _job_payload(content: bytes, content_type: str = "application/pdf") -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "jobKind": "document.extract",
        "correlationId": "a22a25ce-a3b8-45fa-a818-290a7d38c36d",
        "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        "idempotencyKey": "org-1:version-1:extract:v1",
        "tenantId": "11111111-1111-4111-8111-111111111111",
        "documentId": "22222222-2222-4222-8222-222222222222",
        "documentVersionId": "33333333-3333-4333-8333-333333333333",
        "source": {
            "bucket": "docdeploy-private",
            "key": "quarantine/11111111-1111-4111-8111-111111111111/version-1/source.pdf",
            "versionId": "object-version-1",
            "sha256": sha256(content).hexdigest(),
            "contentType": content_type,
        },
        "processing": {"processorVersion": "extract-v1", "ocrLanguages": ["por"]},
        "requestedAt": "2026-09-22T00:00:00+00:00",
    }


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


@pytest.mark.integration
def test_consumer_pipeline_scans_extracts_and_returns_compact_result() -> None:
    asyncio.run(_run_pipeline_success())


async def _run_pipeline_success() -> None:
    content = _build_pdf("Identifier: NF-42\nIssuer: ACME\nDate: 2026-09-21\nValue: 120.50")
    payload = _job_payload(content)

    async def load_content(_: ProcessingJob) -> bytes:
        return content

    handler = build_pipeline_handler(load_content, lambda _: "stream: OK")
    job = ProcessingJob.model_validate(payload)
    result = await handler(job)

    assert result["outcome"] == "completed"
    assert result["artifactRefs"][0].startswith("clean/11111111-1111-4111-8111-111111111111/")
    assert result["extractedDataRef"].startswith("derived/11111111-1111-4111-8111-111111111111/")
    assert result["checksum"] == sha256(content).hexdigest()
    assert result["pageCount"] == 1
    assert result["fieldCount"] == 4
    assert "binary" not in result and "content" not in result


@pytest.mark.integration
def test_consumer_pipeline_fails_closed_and_keeps_content_unpromoted_on_malware() -> None:
    asyncio.run(_run_pipeline_malware())


async def _run_pipeline_malware() -> None:
    content = _build_pdf("irrelevant")
    payload = _job_payload(content)

    async def load_content(_: ProcessingJob) -> bytes:
        return content

    handler = build_pipeline_handler(load_content, lambda _: "stream: Eicar-Test-Signature FOUND")
    job = ProcessingJob.model_validate(payload)

    with pytest.raises(ProcessingFailure) as excinfo:
        await handler(job)
    assert excinfo.value.code == "MALWARE"
    assert excinfo.value.retryable is False


@pytest.mark.integration
def test_consumer_pipeline_fails_closed_when_scan_transport_is_unavailable() -> None:
    asyncio.run(_run_pipeline_scan_unavailable())


async def _run_pipeline_scan_unavailable() -> None:
    content = _build_pdf("irrelevant")
    payload = _job_payload(content)

    async def load_content(_: ProcessingJob) -> bytes:
        return content

    def unavailable_transport(_: bytes) -> str:
        raise TimeoutError("clamd did not respond")

    handler = build_pipeline_handler(load_content, unavailable_transport)
    job = ProcessingJob.model_validate(payload)

    with pytest.raises(ProcessingFailure) as excinfo:
        await handler(job)
    assert excinfo.value.code == "SCAN_UNAVAILABLE"
    assert excinfo.value.retryable is True


@pytest.mark.integration
def test_consumer_pipeline_rejects_checksum_mismatch_as_permanent_failure() -> None:
    asyncio.run(_run_pipeline_checksum_mismatch())


async def _run_pipeline_checksum_mismatch() -> None:
    content = _build_pdf("irrelevant")
    payload = _job_payload(content)
    payload["source"]["sha256"] = "b" * 64  # does not match actual content hash

    async def load_content(_: ProcessingJob) -> bytes:
        return content

    handler = build_pipeline_handler(load_content, lambda _: "stream: OK")
    job = ProcessingJob.model_validate(payload)

    with pytest.raises(ProcessingFailure) as excinfo:
        await handler(job)
    assert excinfo.value.code == "CORRUPT_FILE"
