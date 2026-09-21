import { createHash } from "node:crypto";

import { Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { AuditEvent } from "../../database/entities/audit-event.entity.js";

export interface AppendAuditEvent {
  organizationId: string; actorId: string | null; actorType: "human" | "service"; action: string;
  resourceType: string; resourceId: string; version?: number; result: string; reason?: string;
  correlationId: string; metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  async append(manager: EntityManager, input: AppendAuditEvent): Promise<AuditEvent> {
    await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [input.organizationId]);
    const previous = await manager.findOne(AuditEvent, { where: { organizationId: input.organizationId }, order: { sequence: "DESC" } });
    const sequence = String(previous ? Number(previous.sequence) + 1 : 1);
    const payload = JSON.stringify({ ...input, sequence, previousHash: previous?.currentHash ?? null });
    const event = manager.create(AuditEvent, {
      ...input,
      sequence,
      previousHash: previous?.currentHash ?? null,
      currentHash: createHash("sha256").update(payload).digest("hex"),
      metadata: input.metadata ?? {},
      reason: input.reason ?? null,
      version: input.version ?? null,
    });
    return manager.save(event);
  }
}
