import { useEffect, useState } from "react";

import { listDocuments, type DocumentSummary } from "../../services/documents-api";
import { serializeDocumentFilters, type DocumentFilters } from "./document-filters";

export function DocumentsListPage() {
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void listDocuments(serializeDocumentFilters(filters)).then(setDocuments).catch((caught: Error) => setError(caught.message)); }, [filters]);
  return <main><h1>Documentos</h1>
    <label>Buscar<input value={filters.name ?? ""} onChange={(event) => setFilters({ ...filters, name: event.target.value })} /></label>
    {error && <p role="alert">{error}</p>}
    <table><thead><tr><th>Nome</th><th>Tipo</th><th>Status</th><th>Recebimento</th></tr></thead><tbody>
      {documents.map((document) => <tr key={document.id}><td>{document.name}</td><td>{document.type}</td><td>{document.status}</td><td>{new Date(document.receivedAt).toLocaleDateString("pt-BR")}</td></tr>)}
    </tbody></table>
  </main>;
}
