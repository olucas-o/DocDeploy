import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuditEvent } from "../../database/entities/audit-event.entity.js";
import { Document } from "../../database/entities/document.entity.js";
import { DocumentVersion } from "../../database/entities/document-version.entity.js";
import { OutboxEvent } from "../../database/entities/outbox-event.entity.js";
import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { StoredArtifact } from "../../database/entities/stored-artifact.entity.js";
import { DatabaseModule } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import { DocumentVersionsController } from "../document-versions/document-versions.controller.js";
import { DocumentVersionsService } from "../document-versions/document-versions.service.js";
import { StorageService } from "../storage/storage.service.js";
import { DocumentsController } from "./documents.controller.js";
import { DocumentsService } from "./documents.service.js";

@Module({
  imports: [DatabaseModule, TypeOrmModule.forFeature([Document, DocumentVersion, StoredArtifact, ProcessingRun, OutboxEvent, AuditEvent])],
  controllers: [DocumentsController, DocumentVersionsController],
  providers: [DocumentsService, DocumentVersionsService, StorageService, AuditService],
})
export class DocumentsModule {}
