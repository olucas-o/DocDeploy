import { randomUUID } from "node:crypto";

import { BadRequestException, Controller, Get, NotFoundException, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";

import type { AuthenticatedPrincipal } from "../../common/auth/jwt.strategy.js";
import { OrganizationContextGuard } from "../../common/authorization/organization-context.guard.js";
import { PermissionGuard } from "../../common/authorization/permission.guard.js";
import { RequirePermissions } from "../../common/authorization/permissions.decorator.js";
import { OutboxEvent } from "../../database/entities/outbox-event.entity.js";
import { ProcessingRun } from "../../database/entities/processing-run.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";
import { AuditService } from "../audit/audit.service.js";

type AuthRequest = Request & { user: AuthenticatedPrincipal; correlationId?: string };
const fallbackCorrelation = "00000000-0000-4000-8000-000000000000";

@ApiTags("processing") @ApiBearerAuth("bearer")
@Controller("processing-runs")
@UseGuards(AuthGuard("jwt"), OrganizationContextGuard, PermissionGuard)
export class ProcessingController {
  constructor(
    private readonly transactions: TenantTransactionService,
    private readonly audit: AuditService,
  ) {}

  /** Read-only status/progress of processing runs, persisted by the queue events listener. */
  @Get() @RequirePermissions("processing:read")
  list(@Req() request: AuthRequest, @Query("documentVersionId") documentVersionId?: string) {
    return this.transactions.run(request.user.organizationId, (manager) => {
      const where: Record<string, unknown> = { organizationId: request.user.organizationId };
      if (documentVersionId) where.documentVersionId = documentVersionId;
      return manager.find(ProcessingRun, { where, order: { createdAt: "DESC" }, take: 100 });
    });
  }

  @Get(":id") @RequirePermissions("processing:read")
  async findOne(@Req() request: AuthRequest, @Param("id") id: string) {
    const run = await this.transactions.run(request.user.organizationId, (manager) => manager.findOne(ProcessingRun, { where: { id, organizationId: request.user.organizationId } }));
    if (!run) throw new NotFoundException("Processing run not found");
    return run;
  }

  /**
   * Administrative, audited manual reprocessing. Only terminal runs (completed, failed or
   * dead-lettered) may be reprocessed; a brand-new correlation is used so the new attempt is
   * traceable independently from the original run.
   */
  @Post(":id/reprocess") @RequirePermissions("processing:reprocess")
  async reprocess(@Req() request: AuthRequest, @Param("id") id: string) {
    const organizationId = request.user.organizationId;
    const correlationId = request.correlationId ?? fallbackCorrelation;
    return this.transactions.run(organizationId, async (manager) => {
      const run = await manager.findOne(ProcessingRun, { where: { id, organizationId } });
      if (!run) throw new NotFoundException("Processing run not found");
      if (!["COMPLETED", "FAILED", "DEAD_LETTERED", "CANCELLED"].includes(run.state)) {
        throw new BadRequestException("Only a terminal processing run can be reprocessed");
      }
      const newCorrelationId = randomUUID();
      const idempotencyKey = `${run.idempotencyKey}:reprocess:${newCorrelationId}`;
      const outboxPayload = await manager.query<{ payload: unknown }[]>(
        "SELECT payload FROM outbox_events WHERE organization_id = $1 AND idempotency_key = $2 ORDER BY created_at DESC LIMIT 1",
        [organizationId, run.idempotencyKey],
      );
      const basePayload = (outboxPayload[0]?.payload ?? {}) as Record<string, unknown>;
      const newRunId = randomUUID();
      await manager.insert(ProcessingRun, {
        id: newRunId, organizationId, documentVersionId: run.documentVersionId, operation: run.operation, processorVersion: run.processorVersion,
        idempotencyKey, bullJobId: null, state: "QUEUED", stage: run.stage, progress: 0, attempts: 0, correlationId: newCorrelationId, sanitizedError: null, result: null,
      });
      await manager.insert(OutboxEvent, {
        organizationId, eventType: run.operation, schemaVersion: 1, idempotencyKey,
        payload: { ...basePayload, correlationId: newCorrelationId, idempotencyKey, requestedAt: new Date().toISOString() },
        publishedAt: null, claimedAt: null, claimToken: null, failureMessage: null,
      });
      await this.audit.append(manager, {
        organizationId, actorId: request.user.userId, actorType: "human", action: "processing_run.reprocess_requested",
        resourceType: "processingRun", resourceId: newRunId, result: "queued", correlationId,
        metadata: { originalRunId: run.id, newCorrelationId },
      });
      return { id: newRunId, state: "QUEUED", correlationId: newCorrelationId };
    });
  }
}
