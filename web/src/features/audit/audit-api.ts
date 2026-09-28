import { apiRequest } from "../../services/api-client";

export interface AuditEventView { id: string; sequence: string; action: string; actorId: string | null; resourceType: string; resourceId: string; result: string; reason: string | null; createdAt: string; currentHash: string; }
export interface AuditExport { events: AuditEventView[]; checkpoint: { organizationId: string; sequence: string | null; hash: string | null; exportHash: string }; }

export function listAuditEvents(filters: { from?: string; to?: string; resourceId?: string; actorId?: string }): Promise<AuditEventView[]> {
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return apiRequest(`/audit-events${query.size ? `?${query}` : ""}`);
}
export function exportAuditEvents(filters: { from?: string; to?: string; resourceId?: string; actorId?: string }): Promise<AuditExport> {
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1])));
  return apiRequest(`/audit-events/export${query.size ? `?${query}` : ""}`);
}
