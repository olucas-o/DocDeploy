import { useEffect, useState } from "react";

export interface ReviewField {
  id: string;
  key: string;
  value: string;
  source: string;
  confidence: number | null;
  reviewState: string;
}

export interface ReviewTaskSummary {
  id: string;
  title: string;
  state: string;
}

export interface ReviewCommentSummary { id: string; message: string; authorId: string; createdAt: string; }

interface ReviewPanelProps {
  fields: ReviewField[];
  tasks: ReviewTaskSummary[];
  comments?: ReviewCommentSummary[];
  onCorrect: (fieldId: string, value: string, justification: string) => Promise<void>;
  onCreateTask: (title: string) => Promise<void>;
  onResolveTask: (taskId: string, resolution: string) => Promise<void>;
  onComment?: (message: string) => Promise<void>;
  onDecide: (decision: "APPROVED" | "REJECTED" | "RETURNED_FOR_COMPLEMENT", justification?: string) => Promise<void>;
}

export function ReviewPanel({ fields, tasks, comments = [], onCorrect, onCreateTask, onResolveTask, onComment, onDecide }: ReviewPanelProps) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field.id, field.value])));
  const [correctionReason, setCorrectionReason] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [resolution, setResolution] = useState("");
  const [comment, setComment] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setValues(Object.fromEntries(fields.map((field) => [field.id, field.value]))), [fields]);

  async function run(action: () => Promise<void>) {
    setError("");
    setMessage("");
    try {
      await action();
      setMessage("Alterações salvas.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar as alterações.");
    }
  }

  return <section aria-labelledby="review-title">
    <h2 id="review-title">Revisão</h2>
    {fields.map((field) => <fieldset key={field.id}>
      <legend>{field.key}</legend>
      <p>Origem: {field.source}{field.confidence === null ? "" : ` · confiança ${Math.round(field.confidence * 100)}%`}</p>
      <label>Valor {field.key}<input value={values[field.id] ?? ""} onChange={(event) => setValues({ ...values, [field.id]: event.target.value })} /></label>
      <p>Estado: {field.reviewState}</p>
      <label>Justificativa da correção<input required value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} /></label>
      <button type="button" disabled={!correctionReason.trim()} onClick={() => void run(async () => { await onCorrect(field.id, values[field.id] ?? "", correctionReason); setCorrectionReason(""); })}>Salvar correção</button>
    </fieldset>)}
    <h3>Pendências</h3>
    <ul>{tasks.map((task) => <li key={task.id}>{task.title} — {task.state}{task.state === "OPEN" && <><label>Resolução de {task.title}<input value={resolution} onChange={(event) => setResolution(event.target.value)} /></label><button type="button" disabled={!resolution.trim()} onClick={() => void run(async () => { await onResolveTask(task.id, resolution); setResolution(""); })}>Resolver</button></>}</li>)}</ul>
    <label>Nova pendência<input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} /></label>
    <button type="button" disabled={!taskTitle.trim()} onClick={() => void run(async () => { await onCreateTask(taskTitle.trim()); setTaskTitle(""); })}>Criar pendência</button>
    <h3>Comentários</h3><ul>{comments.map((entry) => <li key={entry.id}>{entry.message} <small>{entry.authorId} · {new Date(entry.createdAt).toLocaleString("pt-BR")}</small></li>)}</ul>
    {onComment && <><label>Novo comentário<textarea value={comment} onChange={(event) => setComment(event.target.value)} /></label><button type="button" disabled={!comment.trim()} onClick={() => void run(async () => { await onComment(comment.trim()); setComment(""); })}>Comentar</button></>}
    <label>Justificativa da decisão<input value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} /></label>
    <div>
      <button type="button" onClick={() => void run(() => onDecide("APPROVED"))}>Aprovar</button>
      <button type="button" disabled={!decisionReason.trim()} onClick={() => void run(() => onDecide("REJECTED", decisionReason))}>Rejeitar</button>
      <button type="button" disabled={!decisionReason.trim()} onClick={() => void run(() => onDecide("RETURNED_FOR_COMPLEMENT", decisionReason))}>Devolver para complemento</button>
    </div>
    {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
