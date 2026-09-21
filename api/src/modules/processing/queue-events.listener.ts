import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { QueueEvents, type Queue } from "bullmq";

import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { processingJobSchema } from "./processing-job.schema.js";
import { redisConnection } from "./redis.connection.js";

const states = new Set(["QUEUED", "ACTIVE", "COMPLETED", "RETRY_SCHEDULED", "FAILED", "DEAD_LETTERED", "CANCELLED"]);
const transitions: Record<string, Set<string>> = {
  QUEUED: new Set(["ACTIVE", "CANCELLED", "FAILED"]),
  ACTIVE: new Set(["COMPLETED", "RETRY_SCHEDULED", "FAILED", "CANCELLED"]),
  RETRY_SCHEDULED: new Set(["ACTIVE", "DEAD_LETTERED", "CANCELLED"]),
};

@Injectable()
export class QueueEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly events = new QueueEvents("document-processing.v1", { connection: redisConnection() });
  private readonly logger = new Logger(QueueEventsListener.name);
  constructor(@InjectQueue("document-processing.v1") private readonly queue: Queue, private readonly transactions: TenantTransactionService) {}
  onModuleInit(): void {
    this.events.on("active", ({ jobId }) => this.safe(() => this.fromJob(jobId, "ACTIVE")));
    this.events.on("progress", ({ jobId, data }) => this.safe(() => this.fromJob(jobId, "ACTIVE", typeof data === "number" ? data : 0)));
    this.events.on("completed", ({ jobId }) => this.safe(() => this.fromJob(jobId, "COMPLETED", 100)));
    this.events.on("failed", ({ jobId }) => this.safe(() => this.handleFailure(jobId)));
    this.events.on("error", (error) => this.logger.error("QueueEvents failed", error.stack));
  }
  async onModuleDestroy(): Promise<void> { await this.events.close(); }
  async persist(organizationId: string, idempotencyKey: string, jobId: string, state: string, progress = 0): Promise<void> {
    if (!states.has(state) || progress < 0 || progress > 100) return;
    await this.transactions.run(organizationId, async (manager) => {
      const run = await manager.findOne(ProcessingRun, { where: { idempotencyKey } });
      if (!run || !transitions[run.state]?.has(state)) return;
      run.bullJobId = jobId; run.state = state; run.progress = progress; await manager.save(run);
    });
  }
  private async fromJob(jobId: string, state: string, progress = 0): Promise<void> {
    const job = await this.queue.getJob(jobId);
    const parsed = job ? processingIdentity(job.data) : undefined;
    if (parsed) await this.persist(parsed.tenantId, parsed.idempotencyKey, jobId, state, progress);
  }
  private async handleFailure(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    const parsed = job ? processingIdentity(job.data) : undefined;
    if (!job || !parsed) return;
    const maxAttempts = job.opts.attempts ?? 1;
    await this.persist(parsed.tenantId, parsed.idempotencyKey, jobId, job.attemptsMade < maxAttempts ? "RETRY_SCHEDULED" : "DEAD_LETTERED", 0);
  }
  private safe(operation: () => Promise<void>): void {
    void operation().catch((error: unknown) => this.logger.error("Queue event could not be persisted", error instanceof Error ? error.stack : undefined));
  }
}

function processingIdentity(data: unknown): { tenantId: string; idempotencyKey: string } | undefined {
  const parsed = processingJobSchema.safeParse(data);
  return parsed.success ? { tenantId: parsed.data.tenantId, idempotencyKey: parsed.data.idempotencyKey } : undefined;
}
