"""Strict versioned BullMQ payload models."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SourceReference(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    bucket: str = Field(min_length=1)
    key: str = Field(pattern=r"^(quarantine|clean|derived)/[A-Za-z0-9-]+/[A-Za-z0-9/_\-.]+$")
    version_id: str | None = Field(default=None, alias="versionId")
    sha256: str = Field(pattern=r"^[a-fA-F0-9]{64}$")
    content_type: Literal["application/pdf", "image/png", "image/jpeg"] = Field(alias="contentType")


class ProcessingOptions(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    processor_version: str = Field(alias="processorVersion", min_length=1)
    ocr_languages: list[str] = Field(alias="ocrLanguages", max_length=5)


class ProcessingJob(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    schema_version: Literal[1] = Field(alias="schemaVersion")
    job_kind: Literal["document.virus_scan", "document.extract", "document.ocr", "document.analyze"] = Field(alias="jobKind")
    correlation_id: str = Field(alias="correlationId", pattern=r"^[a-fA-F0-9-]{36}$")
    traceparent: str = Field(pattern=r"^00-[a-fA-F0-9]{32}-[a-fA-F0-9]{16}-[a-fA-F0-9]{2}$")
    idempotency_key: str = Field(alias="idempotencyKey", min_length=1, max_length=255)
    tenant_id: str = Field(alias="tenantId", pattern=r"^[a-fA-F0-9-]{36}$")
    document_id: str = Field(alias="documentId", pattern=r"^[a-fA-F0-9-]{36}$")
    document_version_id: str = Field(alias="documentVersionId", pattern=r"^[a-fA-F0-9-]{36}$")
    source: SourceReference
    processing: ProcessingOptions
    requested_at: datetime = Field(alias="requestedAt")
