"""Idempotent entry point for document-processing commands.

``consume`` validates the envelope and delegates to a handler. The default
production pipeline (scan -> extraction -> conditional OCR -> artifact
persistence -> compact result) is assembled by ``build_pipeline_handler``,
which takes its I/O collaborators (content loader, antivirus transport) as
explicit dependencies so it stays testable without real infrastructure.
"""

from collections.abc import Awaitable, Callable
from hashlib import sha256
from time import perf_counter
from typing import Any

from app.clients.queue import ProcessingFailure, classify_failure
from app.models.processing_job import ProcessingJob
from app.processors.artifact_persistence import artifact_key, build_completion_result, promote_clean
from app.processors.extraction import extract_minimum_fields, extract_pdf_text, needs_ocr
from app.processors.image_safety import open_image_safely
from app.processors.ocr import run_ocr
from app.processors.virus_scan import ScanFailure, ScanTransport, validate_signature, virus_scan

Handler = Callable[[ProcessingJob], Awaitable[dict[str, Any]]]
ContentLoader = Callable[[ProcessingJob], Awaitable[bytes]]


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


def _artifact_filename(job: ProcessingJob) -> str:
    return job.source.key.rsplit("/", 1)[-1]


def _render_page_image(pdf_content: bytes, page_number: int) -> bytes:
    """Render a single PDF page to PNG bytes so it can go through OCR."""
    import fitz  # PyMuPDF

    with fitz.open(stream=pdf_content, filetype="pdf") as document:
        pixmap = document[page_number - 1].get_pixmap()
        return pixmap.tobytes("png")


def build_pipeline_handler(load_content: ContentLoader, scan_transport: ScanTransport) -> Handler:
    """Compose the User Story 2 pipeline into a queue handler.

    Steps, in order: revalidate checksum, scan (fail closed), promote to the
    clean zone only after SCAN_PASSED, extract native text, run OCR only for
    pages without usable native text, and return a compact result with
    references and counters (never binaries).
    """

    async def handle(job: ProcessingJob) -> dict[str, Any]:
        started = perf_counter()
        content = await load_content(job)

        checksum = sha256(content).hexdigest()
        if checksum != job.source.sha256:
            raise classify_failure("CORRUPT_FILE")

        try:
            validate_signature(content, job.source.content_type)
            scan_status = virus_scan(content, scan_transport)
        except ScanFailure as failure:
            raise classify_failure(failure.code) from failure

        clean_key = promote_clean(
            job.tenant_id,
            job.document_version_id,
            checksum,
            _artifact_filename(job),
            scan_status,
            processor_version=job.processing.processor_version,
        )

        page_count: int | None = None
        if job.source.content_type == "application/pdf":
            pages = extract_pdf_text(content)
            page_count = len(pages)
            text_parts = [page.text for page in pages]
            if needs_ocr(pages):
                for page in pages:
                    if page.char_count == 0:
                        rendered = _render_page_image(content, page.page)
                        image = open_image_safely(rendered)
                        text_parts.append(run_ocr(image, job.processing.ocr_languages))
            text = "\n".join(text_parts)
        else:
            image = open_image_safely(content)
            text = run_ocr(image, job.processing.ocr_languages)

        fields = extract_minimum_fields(text)

        extracted_ref = artifact_key(
            job.tenant_id,
            job.document_version_id,
            checksum,
            "extracted.json",
            processor_version=job.processing.processor_version,
        )

        duration_ms = int((perf_counter() - started) * 1000)
        return build_completion_result(
            artifact_refs=[clean_key],
            extracted_data_ref=extracted_ref,
            checksum=checksum,
            processor_version=job.processing.processor_version,
            duration_ms=duration_ms,
            page_count=page_count,
            field_count=len(fields),
        )

    return handle


__all__ = ["ProcessingFailure", "build_pipeline_handler", "consume"]
