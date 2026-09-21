"""Compatibility tests for the private BullMQ envelope."""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.models.processing_job import ProcessingJob


def valid_job() -> dict[str, object]:
    return {
        "schemaVersion": 1,
        "jobKind": "document.virus_scan",
        "correlationId": "a22a25ce-a3b8-45fa-a818-290a7d38c36d",
        "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        "idempotencyKey": "org-1:version-1:scan:v1",
        "tenantId": "11111111-1111-4111-8111-111111111111",
        "documentId": "22222222-2222-4222-8222-222222222222",
        "documentVersionId": "33333333-3333-4333-8333-333333333333",
        "source": {
            "bucket": "docdeploy-private",
            "key": "quarantine/11111111-1111-4111-8111-111111111111/version-1/source.pdf",
            "versionId": "object-version-1",
            "sha256": "a" * 64,
            "contentType": "application/pdf",
        },
        "processing": {"processorVersion": "scan-v1", "ocrLanguages": ["por"]},
        "requestedAt": datetime.now(UTC).isoformat(),
    }


@pytest.mark.contract
def test_queue_contract_accepts_valid_job() -> None:
    job = ProcessingJob.model_validate(valid_job())
    assert job.schema_version == 1
    assert job.source.key.startswith("quarantine/11111111-1111-4111-8111-111111111111/")


@pytest.mark.contract
@pytest.mark.parametrize(
    "field",
    ["binary", "text", "url", "localPath", "jwt", "refreshToken", "storageCredentials", "openAiApiKey"],
)
def test_queue_contract_rejects_forbidden_fields(field: str) -> None:
    payload = valid_job()
    payload[field] = "secret"
    with pytest.raises(ValidationError):
        ProcessingJob.model_validate(payload)
