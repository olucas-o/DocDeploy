import { useEffect, useState } from "react";

import { exportAuditEvents, listAuditEvents, type AuditEventView } from "./audit-api";

export function AuditTimelinePage() {
  const [filters, setFilters] = useState({ from: "", to: "", resourceId: "", actorId: "" });
  const [events, setEvents] = useState<AuditEventView[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void listAuditEvents(filters).then(setEvents).catch((caught: Error) => setError(caught.message)); }, [filters]);
  async function download() {
    try {
      const result = await exportAuditEvents(filters);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = Object.assign(document.createElement("a"), { href: url, download: "docdeploy-audit.json" });
      anchor.click(); URL.revokeObjectURL(url);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Falha ao exportar auditoria."); }
  }
  return <main><h1>Linha do tempo de auditoria</h1>
    <label>De<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
    <label>Até<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
    <label>Documento<input value={filters.resourceId} onChange={(event) => setFilters({ ...filters, resourceId: event.target.value })} /></label>
    <label>Participante<input value={filters.actorId} onChange={(event) => setFilters({ ...filters, actorId: event.target.value })} /></label>
    <button type="button" onClick={() => void download()}>Exportar eventos filtrados</button>
    {error && <p role="alert">{error}</p>}
    <ol>{events.map((event) => <li key={event.id}><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString("pt-BR")}</time> — {event.action} — {event.result} — {event.resourceType} {event.resourceId} <small>#{event.sequence} · {event.currentHash}</small></li>)}</ol>
  </main>;
}
