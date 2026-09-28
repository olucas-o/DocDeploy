import { randomUUID } from "node:crypto";

import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";

import { Document } from "../../database/entities/document.entity.js";
import { DocumentVersion } from "../../database/entities/document-version.entity.js";
import { OutboxEvent } from "../../database/entities/outbox-event.entity.js";
import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { StoredArtifact } from "../../database/entities/stored-artifact.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { AuditService } from "../audit/audit.service.js";
import { StorageService } from "../storage/storage.service.js";
import { MAX_UPLOAD_BYTES, uploadContentTypes } from "../documents/dto/create-document.dto.js";
import type { ConfirmUploadDto } from "./dto/confirm-upload.dto.js";
import type { CreateDocumentVersionDto } from "./dto/create-document-version.dto.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { Organization } from "../../database/entities/organization.entity.js";

export function validateUploadConfirmation(input: { contentType: string; size: number; sha256: string }): void {
  if (!(uploadContentTypes as readonly string[]).includes(input.contentType) || input.size < 1 || input.size > MAX_UPLOAD_BYTES || !/^[a-f0-9]{64}$/i.test(input.sha256)) {
    throw new BadRequestException("Only PDF, PNG and JPEG files up to 25 MB are accepted");
  }
}

@Injectable()
export class DocumentVersionsService {
  constructor(private readonly transactions: TenantTransactionService, private readonly audit: AuditService, private readonly storage: StorageService, private readonly notifications: NotificationsService) {}

  async create(organizationId: string, actorId: string, correlationId: string, documentId: string, dto: CreateDocumentVersionDto) {
    validateUploadConfirmation(dto);
    const versionId = randomUUID();
    const safeName = dto.fileName.split(/[\\/]/).at(-1)?.replace(/[^a-zA-Z0-9._-]/g, "_") || "document";
    const objectKey = `quarantine/${organizationId}/${versionId}/${randomUUID()}-${safeName}`;
    return this.transactions.run(organizationId, async (manager) => {
      await manager.query("SELECT id FROM documents WHERE id = $1 AND organization_id = $2 FOR UPDATE", [documentId, organizationId]);
      const currentDocument = await manager.findOne(Document, { where: { id: documentId, organizationId } });
      if (!currentDocument) throw new NotFoundException("Document not found");
      const latest = await manager.findOne(DocumentVersion, { where: { organizationId, documentId }, order: { number: "DESC" } });
      const duplicate = await manager.findOne(DocumentVersion, { where: { organizationId, documentId, sha256: dto.sha256 } });
      if (duplicate && !dto.confirmDuplicate) throw new ConflictException("This document content already exists; confirm duplicate version creation to continue");
      const upload = await this.storage.createUploadUrl(organizationId, objectKey, dto.contentType, dto.sha256, dto.size);
      const next = manager.create(DocumentVersion, {
        id: versionId, organizationId, documentId, number: (latest?.number ?? 0) + 1,
        sha256: dto.sha256, size: String(dto.size), detectedType: dto.contentType, objectKey, objectVersionId: null,
        state: "UPLOADING", createdBy: actorId, replacementReason: dto.replacementReason,
      });
      await manager.save(next);
      currentDocument.receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : currentDocument.receivedAt;
      await manager.save(currentDocument);
      const event = await this.audit.append(manager, { organizationId, actorId, actorType: "human", action: "document.version_created", resourceType: "documentVersion", resourceId: versionId, version: next.number, result: "accepted", reason: dto.replacementReason, correlationId, metadata: { documentId, duplicateConfirmed: Boolean(duplicate) } });
      await this.notifications.fromBusinessEvent(manager, event, currentDocument.responsibleId);
      return { id: documentId, currentVersion: { id: versionId, number: next.number, state: next.state }, upload: { ...upload, objectKey, expiresInSeconds: 300 } };
    });
  }

  async confirm(organizationId: string, actorId: string, correlationId: string, versionId: string, dto: ConfirmUploadDto) {
    validateUploadConfirmation(dto);
    const reference = await this.transactions.run(organizationId, (manager) => manager.findOne(DocumentVersion, { where: { id: versionId, organizationId } }));
    if (!reference) throw new NotFoundException("Document version not found");
    if (reference.sha256 !== dto.sha256 || reference.size !== String(dto.size) || reference.detectedType !== dto.contentType) throw new BadRequestException("Upload metadata differs from the signed request");
    await this.storage.verifyUploadedObject(organizationId, reference.objectKey, { contentType: dto.contentType, sha256: dto.sha256, size: dto.size, ...(dto.objectVersionId ? { versionId: dto.objectVersionId } : {}) });
    return this.transactions.run(organizationId, async (manager) => {
      const version = await manager.findOne(DocumentVersion, { where: { id: versionId, organizationId } });
      if (!version) throw new NotFoundException("Document version not found");
      if (version.state !== "UPLOADING") throw new BadRequestException("Upload was already confirmed");
      const organization = await manager.findOne(Organization, { where: { id: organizationId } });
      version.objectVersionId = dto.objectVersionId ?? null; version.state = "SCAN_QUEUED";
      await manager.save(version);
      await manager.update(Document, { id: version.documentId, organizationId }, { status: "PROCESSING" });
      await manager.insert(StoredArtifact, { organizationId, documentVersionId: version.id, zone: "quarantine", objectKey: version.objectKey, sha256: dto.sha256, size: String(dto.size), contentType: dto.contentType, origin: "upload", retentionUntil: null });
      const idempotencyKey = `${organizationId}:${version.id}:${dto.sha256}:document.virus_scan:scan-v1`;
      const runId = randomUUID();
      await manager.insert(ProcessingRun, { id: runId, organizationId, documentVersionId: version.id, operation: "document.virus_scan", processorVersion: "scan-v1", idempotencyKey, bullJobId: null, state: "QUEUED", stage: "virus_scan", progress: 0, attempts: 0, correlationId, sanitizedError: null });
      await manager.insert(OutboxEvent, { organizationId, eventType: "document.virus_scan", schemaVersion: 1, idempotencyKey, payload: {
        schemaVersion: 1, jobKind: "document.virus_scan", correlationId, traceparent: "00-00000000000000000000000000000000-0000000000000000-00", idempotencyKey,
        tenantId: organizationId, documentId: version.documentId, documentVersionId: version.id,
        source: { bucket: process.env.S3_BUCKET ?? "docdeploy-private", key: version.objectKey, ...(dto.objectVersionId ? { versionId: dto.objectVersionId } : {}), sha256: dto.sha256, contentType: dto.contentType },
        processing: { processorVersion: "scan-v1", ocrLanguages: ["por"], aiOptIn: organization?.aiOptIn === true }, requestedAt: new Date().toISOString(),
      }, publishedAt: null, claimedAt: null, claimToken: null, failureMessage: null });
      await this.audit.append(manager, { organizationId, actorId, actorType: "human", action: "document.upload_confirmed", resourceType: "documentVersion", resourceId: version.id, version: version.number, result: "queued", correlationId });
      return { id: version.id, state: version.state, processingRunId: runId };
    });
  }
}
