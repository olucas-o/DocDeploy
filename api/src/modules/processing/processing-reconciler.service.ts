import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { DataSource } from "typeorm";

import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { OutboxPublisherService } from "./outbox-publisher.service.js";

@Injectable()
export class ProcessingReconcilerService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private readonly logger = new Logger(ProcessingReconcilerService.name);
  constructor(private readonly dataSource: DataSource, private readonly transactions: TenantTransactionService, @InjectQueue("document-processing.v1") private readonly queue: Queue, private readonly publisher: OutboxPublisherService) {}
  onModuleInit(): void { this.timer = setInterval(() => void this.reconcile().catch((error: unknown) => this.logger.error("Processing reconcile failed", error instanceof Error ? error.stack : undefined)), 30_000); this.timer.unref(); }
  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }
  async reconcile(): Promise<number> {
    type RunRow = { id: string; organization_id: string; idempotency_key: string; bull_job_id: string | null };
    const runs = await this.dataSource.query<RunRow[]>("SELECT * FROM public.list_reconcilable_runs($1)", [100]);
    let repaired = 0;
    for (const run of runs) {
      if (!(await this.queue.getJob(run.bull_job_id ?? run.idempotency_key))) {
        await this.publisher.publishPending();
        await this.transactions.run(run.organization_id, async (manager) => {
          await manager.update(ProcessingRun, { id: run.id }, { sanitizedError: { code: "JOB_RECONCILED", category: "queue" } });
        });
        repaired += 1;
      }
    }
    return repaired;
  }
}
