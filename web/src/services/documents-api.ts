import { apiRequest, ApiError } from "./api-client";

export interface DocumentSummary { id: string; name: string; type: string; origin: string; status: string; receivedAt: string; currentVersionId: string | null; }
export interface CreateDocumentInput { name: string; type: string; origin: string; receivedAt: string; responsibleId: string; fileName: string; contentType: string; size: number; }
export interface CreateDocumentResponse { id: string; currentVersion: { id: string; number: number; state: string }; upload: { url: string; objectKey: string; headers: Record<string, string> }; }

export async function createDocument(input: CreateDocumentInput, file: File): Promise<CreateDocumentResponse> {
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map((value) => value.toString(16).padStart(2, "0")).join("");
  const created = await apiRequest<CreateDocumentResponse>("/documents", { method: "POST", body: JSON.stringify({ ...input, sha256 }) });
  const upload = await fetch(created.upload.url, { method: "PUT", body: file, headers: created.upload.headers });
  if (!upload.ok) throw new Error("Falha ao enviar arquivo para a quarentena.");
  await apiRequest(`/document-versions/${created.currentVersion.id}/confirm-upload`, { method: "POST", body: JSON.stringify({ sha256, contentType: file.type, size: file.size, objectVersionId: upload.headers.get("x-amz-version-id") ?? undefined }) });
  return created;
}

export async function uploadDocumentVersion(documentId: string, file: File, replacementReason: string): Promise<boolean> {
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))).map((value) => value.toString(16).padStart(2, "0")).join("");
  const create = (confirmDuplicate: boolean) => apiRequest<CreateDocumentResponse>(`/documents/${encodeURIComponent(documentId)}/versions`, {
    method: "POST", body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, sha256, replacementReason, confirmDuplicate }),
  });
  let created: CreateDocumentResponse;
  try { created = await create(false); }
  catch (error) {
    if (!(error instanceof ApiError) || error.status !== 409) throw error;
    if (!window.confirm("Este conteúdo já existe no histórico. Deseja criar mesmo assim uma nova versão?")) return false;
    created = await create(true);
  }
  const upload = await fetch(created.upload.url, { method: "PUT", body: file, headers: created.upload.headers });
  if (!upload.ok) throw new Error("Falha ao enviar arquivo para a quarentena.");
  await apiRequest(`/document-versions/${created.currentVersion.id}/confirm-upload`, {
    method: "POST", body: JSON.stringify({ sha256, contentType: file.type, size: file.size, objectVersionId: upload.headers.get("x-amz-version-id") ?? undefined }),
  });
  return true;
}

export function listDocuments(query = ""): Promise<DocumentSummary[]> { return apiRequest(`/documents${query ? `?${query}` : ""}`); }
