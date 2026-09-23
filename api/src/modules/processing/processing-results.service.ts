import { randomUUID } from "node:crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { Document } from "../../database/entities/document.entity.js";
import { DocumentVersion } from "../../database/entities/document-version.entity.js";
import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { Review } from "../../database/entities/review.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { AuditService } from "../audit/audit.service.js";
import { ExtractedFieldsService, type RawExtractedField } from "./extracted-fields.service.js";

export const PROCESSING_RUN_STATES = ["QUEUED", "ACTIVE", "COMPLETED", "RETRY_SCHEDULED", "FAILED", "DEAD_LETTERED", "CANCELLED"] as const;
export type ProcessingRunState = typeof PROCESSING_RUN_STATES[number];

/** Only forward transitions are legal; terminal states never accept a new state. */
export const PROCESSING_RUN_TRANSITIONS: Record<string, Set<string>> = {
  QUEUED: new Set(["ACTIVE", "CANCELLED", "FAILED"]),
  ACTIVE: new Set(["COMPLETED", "RETRY_SCHEDULED", "FAILED", "CANCELLED"]),
  RETRY_SCHEDULED: new Set(["ACTIVE", "DEAD_LETTERED", "CANCELLED"]),
};

/** Applies (and validates) a monotonic ProcessingRun state transition, rejecting stale/late events. */
export function applyProcessingTransition(current: string, next: string): ProcessingRunState {
  if (!PROCESSING_RUN_STATES.includes(next as ProcessingRunState)) throw new BadRequestException("Unknown processing run state");
  if (!PROCESSING_RUN_TRANSITIONS[current]?.has(next)) throw new BadRequestException(`Illegal processing run transition ${current} -> ${next}`);
  return next as ProcessingRunState;
}

export interface CompactProcessingResult {
  idempotencyKey: string;
  checksum: string;
  [key: string]: unknown;
}

/**
 * The worker result queue is delivered at-least-once. A repeated delivery for the same
 * idempotency key must return the previously persisted compact result unchanged; a delivery that
 * reuses the key with a different checksum indicates a corrupted or mismatched retry and must be
 * rejected instead of silently overwriting the accepted result.
 */
export function deduplicateProcessingResult<T extends CompactProcessingResult>(previous: T, incoming: Pick<T, "idempotencyKey" | "checksum">): T {
  if (previous.idempotencyKey !== incoming.idempotencyKey) throw new BadRequestException("Idempotency key mismatch");
  if (previous.checksum !== incoming.checksum) throw new BadRequestException("Result checksum differs from the previously persisted run");
  return previous;
}

export interface ProcessingCompletionPayload {
  schemaVersion: 1;
  correlationId: string;
  tenantId: string;
  documentVersionId: string;
  outcome: "completed" | "rejected";
  artifactRefs: string[];
  extractedDataRef?: string;
  checksum: string;
  processorVersion: string;
  durationMs: number;
  pageCount?: number;
  fieldCount?: number;
}

export interface PersistCompletionInput {
  idempotencyKey: string;
  result: ProcessingCompletionPayload;
  extractedFields?: RawExtractedField[];
}

@Injectable()
export class ProcessingResultsService {
  constructor(
    private readonly transactions: TenantTransactionService,
    private readonly audit: AuditService,
    private readonly extractedFields: ExtractedFieldsService,
  ) {}

  async persistCompletion(input: PersistCompletionInput): Promise<ProcessingRun> {
    const { idempotencyKey, result } = input;
    return this.transactions.run(result.tenantId, async (manager) => {
      const run = await manager.findOne(ProcessingRun, { where: { organizationId: result.tenantId, idempotencyKey } });
      if (!run) throw new NotFoundException("Processing run not found for the given idempotency key");
      if (run.documentVersionId !== result.documentVersionId) throw new BadRequestException("Document version does not match the processing run");

      const version = await manager.findOne(DocumentVersion, { where: { id: result.documentVersionId, organizationId: result.tenantId } });
      if (!version) throw new NotFoundException("Document version not found");
      if (version.sha256 && version.sha256 !== result.checksum) throw new BadRequestException("Result checksum does not match the document version hash");

      const nextState: ProcessingRunState = result.outcome === "completed" ? "COMPLETED" : "FAILED";

      if (run.state === nextState) {
        deduplicateProcessingResult(run.result as CompactProcessingResult ?? { idempotencyKey, checksum: result.checksum }, { idempotencyKey, checksum: result.checksum });
        return run;
      }

      applyProcessingTransition(run.state, nextState);
      run.state = nextState;
      run.progress = 100;
      run.result = { idempotencyKey, ...result };
      run.sanitizedError = result.outcome === "rejected" ? { code: "PROCESSING_REJECTED", category: "permanent" } : null;
      await manager.save(run);

      await this.audit.append(manager, {
        organizationId: result.tenantId,
        actorId: null,
        actorType: "service",
        action: result.outcome === "completed" ? "processing.completed" : "processing.rejected",
        resourceType: "processingRun",
        resourceId: run.id,
        result: result.outcome,
        correlationId: result.correlationId,
        metadata: { operation: run.operation, processorVersion: result.processorVersion, checksum: result.checksum },
      });

      if (result.outcome === "completed") {
        if (input.extractedFields?.length) {
          await this.extractedFields.persist(manager, result.tenantId, version.id, input.extractedFields);
        }
        version.state = "READY_FOR_REVIEW";
        await manager.save(version);
        await manager.update(Document, { id: version.documentId }, { status: "READY_FOR_REVIEW" });
        const existingReview = await manager.findOne(Review, { where: { organizationId: result.tenantId, documentVersionId: version.id } });
        if (!existingReview) {
          await manager.insert(Review, {
            id: randomUUID(), organizationId: result.tenantId, documentId: version.documentId, documentVersionId: version.id,
            state: "PENDING", responsibleId: null, decision: null, justification: null, decidedAt: null,
          });
        }
      } else {
        version.state = "REJECTED";
        await manager.save(version);
        await manager.update(Document, { id: version.documentId }, { status: "REJECTED" });
      }

      return run;
    });
  }
}
