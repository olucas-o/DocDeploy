import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";

import { AuditQueryService, type AuditFilters } from "./audit-query.service.js";

@Injectable()
export class AuditExportService {
  constructor(private readonly queries: AuditQueryService) {}

  async export(organizationId: string, filters: AuditFilters) {
    const events = await this.queries.list(organizationId, filters, 1000);
    const checkpoint = events.at(-1) ?? null;
    const exportHash = createHash("sha256").update(JSON.stringify(events.map((event) => ({ id: event.id, sequence: event.sequence, currentHash: event.currentHash })))).digest("hex");
    return { events, checkpoint: { organizationId, sequence: checkpoint?.sequence ?? null, hash: checkpoint?.currentHash ?? null, exportHash } };
  }
}
