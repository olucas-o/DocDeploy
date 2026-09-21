import { randomUUID } from "node:crypto";
import { basename } from "node:path";

import { Injectable, NotFoundException } from "@nestjs/common";
import type { SelectQueryBuilder } from "typeorm";

import { Document } from "../../database/entities/document.entity.js";
import { DocumentVersion } from "../../database/entities/document-version.entity.js";
import { OrganizationMembership } from "../../database/entities/organization-membership.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { AuditService } from "../audit/audit.service.js";
import { StorageService } from "../storage/storage.service.js";
import type { CreateDocumentDto } from "./dto/create-document.dto.js";

export interface DocumentSearchFilters {
  name?: string; type?: string; status?: string; responsibleId?: string;
  receivedFrom?: string; receivedTo?: string; hasPendingTasks?: boolean;
}

export function buildDocumentSearch(organizationId: string, filters: DocumentSearchFilters): DocumentSearchFilters & { organizationId: string } {
  const allowed: DocumentSearchFilters = {};
  for (const key of ["name", "type", "status", "responsibleId", "receivedFrom", "receivedTo", "hasPendingTasks"] as const) {
    if (filters[key] !== undefined) Object.assign(allowed, { [key]: filters[key] });
  }
  return { organizationId, ...allowed };
}

@Injectable()
export class DocumentsService {
  constructor(private readonly transactions: TenantTransactionService, private readonly storage: StorageService, private readonly audit: AuditService) {}

  async create(organizationId: string, actorId: string, correlationId: string, dto: CreateDocumentDto) {
    const documentId = randomUUID();
    const versionId = randomUUID();
    const safeName = basename(dto.fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const objectKey = `quarantine/${organizationId}/${versionId}/${randomUUID()}-${safeName}`;
    return this.transactions.run(organizationId, async (manager) => {
      const responsibleIsMember = await manager.exists(OrganizationMembership, { where: { organizationId, userId: dto.responsibleId, status: "active" } });
      if (!responsibleIsMember) throw new NotFoundException("Responsible member not found");
      const upload = await this.storage.createUploadUrl(organizationId, objectKey, dto.contentType, dto.sha256, dto.size);
      await manager.insert(Document, {
        id: documentId, organizationId, name: dto.name, type: dto.type, origin: dto.origin,
        responsibleId: dto.responsibleId, status: "UPLOADING", receivedAt: new Date(dto.receivedAt), currentVersionId: null,
      });
      await manager.insert(DocumentVersion, {
        id: versionId, organizationId, documentId, number: 1, objectKey, state: "UPLOADING", createdBy: actorId,
        sha256: dto.sha256, size: String(dto.size), detectedType: dto.contentType, objectVersionId: null, replacementReason: null,
      });
      await manager.update(Document, { id: documentId }, { currentVersionId: versionId });
      await this.audit.append(manager, { organizationId, actorId, actorType: "human", action: "document.created", resourceType: "document", resourceId: documentId, version: 1, result: "accepted", correlationId });
      return { id: documentId, status: "UPLOADING", currentVersion: { id: versionId, number: 1, state: "UPLOADING" }, upload: { ...upload, objectKey, expiresInSeconds: 300 } };
    });
  }

  async list(organizationId: string, filters: DocumentSearchFilters): Promise<Document[]> {
    return this.transactions.run(organizationId, async (manager) => {
      const query = manager.getRepository(Document).createQueryBuilder("document");
      this.applyFilters(query, buildDocumentSearch(organizationId, filters));
      return query.orderBy("document.receivedAt", "DESC").take(100).getMany();
    });
  }

  async findOne(organizationId: string, documentId: string): Promise<Document> {
    const document = await this.transactions.run(organizationId, (manager) => manager.findOne(Document, { where: { id: documentId, organizationId } }));
    if (!document) throw new NotFoundException("Document not found");
    return document;
  }

  private applyFilters(query: SelectQueryBuilder<Document>, filters: ReturnType<typeof buildDocumentSearch>): void {
    query.where("document.organizationId = :organizationId", { organizationId: filters.organizationId });
    if (filters.name) query.andWhere("document.name ILIKE :name", { name: `%${filters.name}%` });
    if (filters.type) query.andWhere("document.type = :type", { type: filters.type });
    if (filters.status) query.andWhere("document.status = :status", { status: filters.status });
    if (filters.responsibleId) query.andWhere("document.responsibleId = :responsibleId", { responsibleId: filters.responsibleId });
    if (filters.receivedFrom) query.andWhere("document.receivedAt >= :receivedFrom", { receivedFrom: filters.receivedFrom });
    if (filters.receivedTo) query.andWhere("document.receivedAt <= :receivedTo", { receivedTo: filters.receivedTo });
    if (filters.hasPendingTasks === true) query.andWhere("FALSE");
  }
}
