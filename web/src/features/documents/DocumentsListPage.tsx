import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { listDocuments, type DocumentSummary } from "../../services/documents-api";
import { serializeDocumentFilters, type DocumentFilters } from "./document-filters";

export function DocumentsListPage() {
  const [filters, setFilters] = useState<DocumentFilters>({});
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void listDocuments(serializeDocumentFilters(filters)).then(setDocuments).catch((caught: Error) => setError(caught.message)); }, [filters]);
  return <main><h1>Documentos</h1><nav aria-label="Navegação principal"><Link to="/documents/new">Novo documento</Link> · <Link to="/audit">Auditoria</Link></nav>
    <label>Buscar<input value={filters.name ?? ""} onChange={(event) => setFilters({ ...filters, name: event.target.value })} /></label>
    {error && <p role="alert">{error}</p>}
    <table><caption>Documentos da organização</caption><thead><tr><th>Nome</th><th>Tipo</th><th>Status</th><th>Recebimento</th><th>Ações</th></tr></thead><tbody>
      {documents.map((document) => <tr key={document.id}><td><Link to={`/documents/${encodeURIComponent(document.id)}`}>{document.name}</Link></td><td>{document.type}</td><td>{document.status}</td><td>{new Date(document.receivedAt).toLocaleDateString("pt-BR")}</td><td><Link to={`/documents/${encodeURIComponent(document.id)}/versions`}>Versões</Link></td></tr>)}
    </tbody></table>
  </main>;
}
