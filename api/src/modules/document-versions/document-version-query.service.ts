import { Injectable, NotFoundException } from "@nestjs/common";
import { In } from "typeorm";

import { Document } from "../../database/entities/document.entity.js";
import { DocumentVersion } from "../../database/entities/document-version.entity.js";
import { ExtractedField } from "../../database/entities/extracted-field.entity.js";
import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { StoredArtifact } from "../../database/entities/stored-artifact.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { StorageService } from "../storage/storage.service.js";

@Injectable()
export class DocumentVersionQueryService {
  constructor(private readonly transactions: TenantTransactionService, private readonly storage: StorageService) {}

  async list(organizationId: string, documentId: string) {
    return this.transactions.run(organizationId, async (manager) => {
      const document = await manager.findOne(Document, { where: { id: documentId, organizationId } });
      if (!document) throw new NotFoundException("Document not found");
      const versions = await manager.find(DocumentVersion, { where: { organizationId, documentId }, order: { number: "ASC" } });
      const versionIds = versions.map((version) => version.id);
      const extractedFields = versionIds.length ? await manager.find(ExtractedField, { where: { organizationId, documentVersionId: In(versionIds) }, order: { key: "ASC" } }) : [];
      const fields = new Map<string, ExtractedField[]>();
      for (const field of extractedFields) {
        let versionFields = fields.get(field.documentVersionId);
        if (!versionFields) { versionFields = []; fields.set(field.documentVersionId, versionFields); }
        versionFields.push(field);
      }
      return versions.map((version) => ({
        id: version.id,
        number: version.number,
        state: version.state,
        createdAt: version.createdAt,
        replacementReason: version.replacementReason,
        isCurrent: version.id === document.currentVersionId,
        fields: (fields.get(version.id) ?? []).map(({ id, key, value, source }) => ({ id, key, value, source })),
      }));
    });
  }

  async findOne(organizationId: string, versionId: string) {
    const data = await this.transactions.run(organizationId, async (manager) => {
      const version = await manager.findOne(DocumentVersion, { where: { id: versionId, organizationId } });
      if (!version) throw new NotFoundException("Document version not found");
      const document = await manager.findOne(Document, { where: { id: version.documentId, organizationId } });
      if (!document) throw new NotFoundException("Document version not found");
      const [fields, processingRuns, cleanArtifact] = await Promise.all([
        manager.find(ExtractedField, { where: { organizationId, documentVersionId: versionId }, order: { key: "ASC" } }),
        manager.find(ProcessingRun, { where: { organizationId, documentVersionId: versionId }, order: { createdAt: "DESC" } }),
        manager.findOne(StoredArtifact, { where: { organizationId, documentVersionId: versionId, zone: "clean" }, order: { createdAt: "DESC" } }),
      ]);
      return { version, document, fields, processingRuns, cleanArtifact };
    });
    const scanPassed = ["SCAN_PASSED", "EXTRACTION_QUEUED", "EXTRACTING", "READY_FOR_REVIEW", "APPROVED", "REJECTED", "RETURNED_FOR_COMPLEMENT"].includes(data.version.state);
    const objectUrl = scanPassed && data.cleanArtifact ? await this.storage.createReadUrl(organizationId, data.cleanArtifact.objectKey) : null;
    return {
      id: data.version.id, documentId: data.version.documentId, number: data.version.number, state: data.version.state,
      createdAt: data.version.createdAt, replacementReason: data.version.replacementReason,
      isCurrent: data.document.currentVersionId === data.version.id, objectUrl, fields: data.fields, processingRuns: data.processingRuns,
    };
  }
}
