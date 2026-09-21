export interface DocumentFilters { name?: string; type?: string; status?: string; responsibleId?: string; receivedFrom?: string; receivedTo?: string; hasPendingTasks?: boolean; }
export function serializeDocumentFilters(filters: DocumentFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}
