import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { OutboxEvent } from "../../database/entities/outbox-event.entity.js";
import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { OutboxPublisherService } from "./outbox-publisher.service.js";
import { ProcessingReconcilerService } from "./processing-reconciler.service.js";
import { QueueEventsListener } from "./queue-events.listener.js";
import { redisConnection } from "./redis.connection.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([OutboxEvent, ProcessingRun]),
    BullModule.forRoot({ connection: redisConnection() }),
    BullModule.registerQueue({ name: "document-processing.v1" }),
  ],
  providers: [OutboxPublisherService, ProcessingReconcilerService, QueueEventsListener],
  exports: [OutboxPublisherService, ProcessingReconcilerService, QueueEventsListener],
})
export class ProcessingModule {}
