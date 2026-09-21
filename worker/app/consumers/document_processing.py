"""Idempotent entry point for document-processing commands."""

from collections.abc import Awaitable, Callable
from typing import Any

from app.clients.queue import ProcessingFailure, classify_failure
from app.models.processing_job import ProcessingJob

Handler = Callable[[ProcessingJob], Awaitable[dict[str, Any]]]


async def consume(payload: dict[str, Any], handler: Handler) -> dict[str, Any]:
    try:
        job = ProcessingJob.model_validate(payload)
    except ValueError as error:
        raise classify_failure("UNKNOWN_SCHEMA") from error
    result = await handler(job)
    return {
        "schemaVersion": 1,
        "correlationId": job.correlation_id,
        "tenantId": job.tenant_id,
        "documentVersionId": job.document_version_id,
        **result,
    }


__all__ = ["ProcessingFailure", "consume"]
