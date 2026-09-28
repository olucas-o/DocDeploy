import { Injectable } from "@nestjs/common";

import { AuditEvent } from "../../database/entities/audit-event.entity.js";
import { TenantTransactionService } from "../../database/tenant-transaction.service.js";

export interface AuditFilters { from?: string; to?: string; resourceId?: string; actorId?: string; }

@Injectable()
export class AuditQueryService {
  constructor(private readonly transactions: TenantTransactionService) {}

  async list(organizationId: string, filters: AuditFilters = {}, limit = 1000): Promise<AuditEvent[]> {
    return this.transactions.run(organizationId, async (manager) => {
      const query = manager.getRepository(AuditEvent).createQueryBuilder("event").where("event.organizationId = :organizationId", { organizationId });
      if (filters.from) query.andWhere("event.createdAt >= :from", { from: filters.from });
      if (filters.to) query.andWhere("event.createdAt < (CAST(:to AS date) + INTERVAL '1 day')", { to: filters.to });
      if (filters.resourceId) query.andWhere("event.resourceId = :resourceId", { resourceId: filters.resourceId });
      if (filters.actorId) query.andWhere("event.actorId = :actorId", { actorId: filters.actorId });
      return query.orderBy("event.sequence", "ASC").take(Math.min(Math.max(limit, 1), 1000)).getMany();
    });
  }

  async checkpoint(organizationId: string): Promise<AuditEvent | null> {
    return this.transactions.run(organizationId, (manager) => manager.findOne(AuditEvent, { where: { organizationId }, order: { sequence: "DESC" } }));
  }
}
