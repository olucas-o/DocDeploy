import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { QueueEvents, type Queue } from "bullmq";

import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { processingJobSchema } from "./processing-job.schema.js";
import { PROCESSING_RUN_STATES, PROCESSING_RUN_TRANSITIONS, ProcessingResultsService, type ProcessingCompletionPayload } from "./processing-results.service.js";
import { redisConnection } from "./redis.connection.js";
import { StorageService } from "../storage/storage.service.js";

const states = new Set<string>(PROCESSING_RUN_STATES);
const transitions = PROCESSING_RUN_TRANSITIONS;

@Injectable()
export class QueueEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly events = new QueueEvents("document-processing.v1", { connection: redisConnection() });
  private readonly logger = new Logger(QueueEventsListener.name);
  constructor(
    @InjectQueue("document-processing.v1") private readonly queue: Queue,
    private readonly transactions: TenantTransactionService,
    private readonly results: ProcessingResultsService,
    private readonly storage: StorageService,
  ) {}
  onModuleInit(): void {
    this.events.on("active", ({ jobId }) => this.safe(() => this.fromJob(jobId, "ACTIVE")));
    this.events.on("progress", ({ jobId, data }) => this.safe(() => this.fromJob(jobId, "ACTIVE", typeof data === "number" ? data : 0)));
    this.events.on("completed", ({ jobId }) => this.safe(() => this.handleCompleted(jobId)));
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
  private async handleCompleted(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    const identity = job ? processingIdentity(job.data) : undefined;
    if (!job || !identity) return;
    const parsedResult = parseCompletionResult(job.returnvalue);
    if (!parsedResult) throw new Error("Completed processing job did not return a valid compact result; completion remains eligible for reconciliation");
    if (parsedResult.tenantId !== identity.tenantId || parsedResult.documentVersionId !== identity.documentVersionId || parsedResult.correlationId !== identity.correlationId) {
      throw new Error("Completed processing result identity does not match its queue envelope");
    }
    const extractedFields = parsedResult.extractedDataRef ? await this.extractedFields(identity.tenantId, parsedResult.extractedDataRef) : [];
    await this.results.persistCompletion({ idempotencyKey: identity.idempotencyKey, result: parsedResult, extractedFields });
  }
  async reconcileCompleted(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    const identity = job ? processingIdentity(job.data) : undefined;
    if (!job || !identity) return;
    await this.persist(identity.tenantId, identity.idempotencyKey, jobId, "ACTIVE", 100);
    await this.handleCompleted(jobId);
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

  private async extractedFields(organizationId: string, reference: string) {
    const artifact = await this.storage.readDerivedJson(organizationId, reference);
    if (!artifact || typeof artifact !== "object" || !("fields" in artifact) || !Array.isArray(artifact.fields)) return [];
    return artifact.fields.filter((field): field is { key: string; value: string | null; source?: "local" | "ocr" | "ai" | "human"; page?: number | null; excerpt?: string | null; confidence?: number | null } =>
      Boolean(field) && typeof field === "object" && typeof field.key === "string" && (typeof field.value === "string" || field.value === null),
    );
  }
}

function processingIdentity(data: unknown): { tenantId: string; idempotencyKey: string; documentVersionId: string; correlationId: string } | undefined {
  const parsed = processingJobSchema.safeParse(data);
  return parsed.success ? { tenantId: parsed.data.tenantId, idempotencyKey: parsed.data.idempotencyKey, documentVersionId: parsed.data.documentVersionId, correlationId: parsed.data.correlationId } : undefined;
}

function parseCompletionResult(raw: unknown): ProcessingCompletionPayload | undefined {
  const value = typeof raw === "string" ? safeJsonParse(raw) : raw;
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || (candidate.outcome !== "completed" && candidate.outcome !== "rejected")) return undefined;
  if (typeof candidate.correlationId !== "string" || typeof candidate.tenantId !== "string" || typeof candidate.documentVersionId !== "string") return undefined;
  if (!Array.isArray(candidate.artifactRefs) || !candidate.artifactRefs.every((reference) => typeof reference === "string")) return undefined;
  if (typeof candidate.checksum !== "string" || typeof candidate.processorVersion !== "string" || typeof candidate.durationMs !== "number" || candidate.durationMs < 0) return undefined;
  if (candidate.extractedDataRef !== undefined && candidate.extractedDataRef !== null && typeof candidate.extractedDataRef !== "string") return undefined;
  if (candidate.outcome === "rejected" && typeof candidate.rejectionCode !== "string") return undefined;
  return candidate as unknown as ProcessingCompletionPayload;
}

function safeJsonParse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return undefined; }
}
