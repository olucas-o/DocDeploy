import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { DataSource } from "typeorm";

import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { OutboxPublisherService } from "./outbox-publisher.service.js";
import { QueueEventsListener } from "./queue-events.listener.js";
import { OutboxEvent } from "../../database/entities/outbox-event.entity.js";

@Injectable()
export class ProcessingReconcilerService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(ProcessingReconcilerService.name);
  constructor(private readonly dataSource: DataSource, private readonly transactions: TenantTransactionService, @InjectQueue("document-processing.v1") private readonly queue: Queue, private readonly publisher: OutboxPublisherService, private readonly events: QueueEventsListener) {}
  onModuleInit(): void { this.timer = setInterval(() => void this.reconcile().catch((error: unknown) => this.logger.error("Processing reconcile failed", error instanceof Error ? error.stack : undefined)), 30_000); this.timer.unref(); }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }
  async reconcile(): Promise<number> {
    type RunRow = { id: string; organization_id: string; idempotency_key: string; bull_job_id: string | null; state: string };
    const runs = await this.dataSource.query<RunRow[]>("SELECT * FROM public.list_reconcilable_runs($1)", [100]);
    let repaired = 0;
    for (const run of runs) {
      try {
        const jobId = run.bull_job_id ?? run.idempotency_key;
        const job = await this.queue.getJob(jobId);
        if (job && await job.getState() === "completed") {
          await this.events.reconcileCompleted(jobId);
          repaired += 1;
        } else if (!job) {
          await this.transactions.run(run.organization_id, async (manager) => {
            await manager.update(ProcessingRun, { id: run.id }, { sanitizedError: { code: "JOB_RECONCILED", category: "queue" } });
            await manager.update(OutboxEvent, { organizationId: run.organization_id, idempotencyKey: run.idempotency_key }, { publishedAt: null, claimedAt: null, claimToken: null });
          });
          await this.publisher.publishPending();
          repaired += 1;
        }
      } catch (error) {
        this.logger.warn(`Could not reconcile processing run ${run.id}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }
    return repaired;
  }
}
