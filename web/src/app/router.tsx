import { createBrowserRouter } from "react-router-dom";

import { createDocument } from "../services/documents-api";
import { DocumentsListPage } from "../features/documents/DocumentsListPage";
import { DocumentUploadForm } from "../features/documents/DocumentUploadForm";
import { DocumentDetailPage } from "../features/documents/DocumentDetailPage";
import { DocumentVersionCompare } from "../features/documents/DocumentVersionCompare";
import { AuditTimelinePage } from "../features/audit/AuditTimelinePage";
import { LoginPage } from "../features/auth/LoginPage";

function HomePage() {
  return <main><h1>DocDeploy</h1><p>Governança segura de documentos.</p><nav><a href="/login">Entrar</a> · <a href="/documents">Documentos</a></nav></main>;
}

function NewDocumentPage() { return <main><h1>Novo documento</h1><DocumentUploadForm onSubmit={async (input, file) => { await createDocument(input, file); }} /></main>; }

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/documents", element: <DocumentsListPage /> },
  { path: "/documents/new", element: <NewDocumentPage /> },
  { path: "/documents/:id", element: <DocumentDetailPage /> },
  { path: "/documents/:id/versions", element: <DocumentVersionCompare /> },
  { path: "/audit", element: <AuditTimelinePage /> },
]);
