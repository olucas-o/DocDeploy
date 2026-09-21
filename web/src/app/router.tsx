import { createBrowserRouter } from "react-router-dom";

import { createDocument } from "../services/documents-api";
import { DocumentsListPage } from "../features/documents/DocumentsListPage";
import { DocumentUploadForm } from "../features/documents/DocumentUploadForm";

function HomePage() {
  return <main><h1>DocDeploy</h1><p>Governança segura de documentos.</p></main>;
}

function NewDocumentPage() { return <main><h1>Novo documento</h1><DocumentUploadForm onSubmit={async (input, file) => { await createDocument(input, file); }} /></main>; }

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/documents", element: <DocumentsListPage /> },
  { path: "/documents/new", element: <NewDocumentPage /> },
]);
