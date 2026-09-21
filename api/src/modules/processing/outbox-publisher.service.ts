import { createHash, randomUUID } from "node:crypto";

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { DataSource } from "typeorm";

import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { processingJobSchema } from "./processing-job.schema.js";

export function bullJobId(idempotencyKey: string): string {
  return createHash("sha256").update(idempotencyKey).digest("base64url");
}

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(OutboxPublisherService.name);
  constructor(private readonly dataSource: DataSource, private readonly transactions: TenantTransactionService, @InjectQueue("document-processing.v1") private readonly queue: Queue) {}
  onModuleInit(): void { this.timer = setInterval(() => void this.publishPending().catch((error: unknown) => this.logger.error("Outbox publish cycle failed", error instanceof Error ? error.stack : undefined)), 1000); this.timer.unref(); }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }
  async publishPending(): Promise<number> {
    type ClaimedEvent = { id: string; organization_id: string; payload: unknown; idempotency_key: string };
    const claimToken = randomUUID();
    const events = await this.dataSource.query<ClaimedEvent[]>("SELECT * FROM public.claim_outbox_events($1, $2::uuid)", [100, claimToken]);
    for (const event of events) {
      try {
        const job = processingJobSchema.parse(event.payload);
        const queued = await this.queue.add(job.jobKind, job, { jobId: bullJobId(job.idempotencyKey), attempts: 5, backoff: { type: "exponential", delay: 1000 } });
        await this.transactions.run(event.organization_id, async (manager) => {
          await manager.update(ProcessingRun, { idempotencyKey: event.idempotency_key }, { bullJobId: queued.id ?? event.idempotency_key });
        });
        await this.dataSource.query("SELECT public.complete_outbox_event($1::uuid, $2::uuid, true, NULL)", [event.id, claimToken]);
      } catch (error) {
        const code = error && typeof error === "object" && "issues" in error ? "INVALID_JOB_SCHEMA" : "QUEUE_PUBLISH_FAILED";
        await this.dataSource.query("SELECT public.complete_outbox_event($1::uuid, $2::uuid, false, $3)", [event.id, claimToken, code]);
      }
    }
    return events.length;
  }
}
