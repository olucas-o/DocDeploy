import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { AuditEvent } from "../../database/entities/audit-event.entity.js";
import { Document } from "../../database/entities/document.entity.js";
import { DocumentVersion } from "../../database/entities/document-version.entity.js";
import { ExtractedField } from "../../database/entities/extracted-field.entity.js";
import { OutboxEvent } from "../../database/entities/outbox-event.entity.js";
import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { Review } from "../../database/entities/review.entity.js";
import { DatabaseModule } from "../../database/database.module.js";
import { AuditService } from "../audit/audit.service.js";
import { ExtractedFieldsService } from "./extracted-fields.service.js";
import { OutboxPublisherService } from "./outbox-publisher.service.js";
import { ProcessingController } from "./processing.controller.js";
import { ProcessingReconcilerService } from "./processing-reconciler.service.js";
import { ProcessingResultsService } from "./processing-results.service.js";
import { QueueEventsListener } from "./queue-events.listener.js";
import { redisConnection } from "./redis.connection.js";

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([OutboxEvent, ProcessingRun, Document, DocumentVersion, ExtractedField, Review, AuditEvent]),
    BullModule.forRoot({ connection: redisConnection() }),
    BullModule.registerQueue({ name: "document-processing.v1" }),
  ],
  controllers: [ProcessingController],
  providers: [OutboxPublisherService, ProcessingReconcilerService, QueueEventsListener, ProcessingResultsService, ExtractedFieldsService, AuditService],
  exports: [OutboxPublisherService, ProcessingReconcilerService, QueueEventsListener, ProcessingResultsService, ExtractedFieldsService],
})
export class ProcessingModule {}
