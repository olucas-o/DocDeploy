import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { apiRequest } from "../../services/api-client";
import { ReviewPanel } from "../reviews/ReviewPanel";
import { addReviewComment, correctField, createReviewTask, decideReview, getReview, resolveReviewTask, type ReviewData } from "../reviews/review-api";

interface DocumentDetail { id: string; name: string; type: string; origin: string; status: string; currentVersionId: string | null; }
interface VersionDetail { id: string; number: number; state: string; objectUrl: string | null; fields: Array<{ id: string; key: string; value: string; source: string; confidence: number | null; page: number | null; reviewState: string }>; processingRuns: Array<{ state: string; stage: string; progress: number; sanitizedError: unknown }> }

export function DocumentDetailPage() {
  const { id = "" } = useParams();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [version, setVersion] = useState<VersionDetail | null>(null);
  const [review, setReview] = useState<ReviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    void Promise.all([
      apiRequest<DocumentDetail>(`/documents/${encodeURIComponent(id)}`),
    ]).then(async ([found]) => {
      setDocument(found);
      const versions = await apiRequest<Array<{ id: string }>>(`/documents/${encodeURIComponent(found.id)}/versions`);
      const versionId = found.currentVersionId ?? versions.at(-1)?.id;
      if (!versionId) return;
      const current = await apiRequest<VersionDetail>(`/document-versions/${encodeURIComponent(versionId)}`);
      setVersion(current);
      setReview(found.currentVersionId === current.id ? await getReview(current.id).catch(() => null) : null);
    }).catch((caught: Error) => setError(caught.message));
  }, [id]);

  async function reloadReview() { if (version) setReview(await getReview(version.id)); }
  if (error) return <main><p role="alert">{error}</p><Link to="/documents">Voltar</Link></main>;
  if (!document) return <main><p role="status">Carregando documento…</p></main>;
  if (!version) return <main><Link to="/documents">Documentos</Link><h1>{document.name}</h1><p>{document.type} · {document.origin} · {document.status}</p><p role="status">Aguardando confirmação e processamento da primeira versão.</p></main>;
  return <main>
    <Link to="/documents">Documentos</Link> · <Link to={`/documents/${encodeURIComponent(id)}/versions`}>Histórico de versões</Link><h1>{document.name}</h1>
    <p>{document.type} · {document.origin} · {document.status}</p>
    <h2>Versão {version.number}{document.currentVersionId === version.id ? " (vigente)" : ""}</h2>
    <p>Estado: {version.state}</p>
    <ol aria-label="Progresso do processamento">{version.processingRuns.map((run, index) => <li key={`${run.stage}-${index}`}>{run.stage}: {run.state} ({run.progress}%)</li>)}</ol>
    {version.objectUrl && <p><a href={version.objectUrl} rel="noreferrer" target="_blank">Abrir original verificado</a></p>}
    <h2>Informações extraídas</h2>
    <dl>{version.fields.map((field) => <div key={field.id}><dt>{field.key}</dt><dd>{field.value || "Pendente"} · {field.source}{field.page ? ` · página ${field.page}` : ""}{field.confidence === null ? "" : ` · confiança ${Math.round(field.confidence * 100)}%`}</dd></div>)}</dl>
    {review?.review && <ReviewPanel fields={review.fields.map((field) => ({ ...field, value: String(field.value ?? "") }))} tasks={review.tasks} comments={review.comments} onCorrect={async (...args) => { await correctField(...args); await reloadReview(); }} onCreateTask={async (title) => { await createReviewTask(review.review!.id, title); await reloadReview(); }} onResolveTask={async (...args) => { await resolveReviewTask(...args); await reloadReview(); }} onComment={async (message) => { await addReviewComment(review.review!.id, message); await reloadReview(); }} onDecide={async (...args) => { await decideReview(review.review!.id, ...args); await reloadReview(); }} />}
  </main>;
}
