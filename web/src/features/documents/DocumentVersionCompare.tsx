import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { apiRequest } from "../../services/api-client";
import { uploadDocumentVersion } from "../../services/documents-api";

interface VersionRow { id: string; number: number; state: string; createdAt: string; replacementReason: string | null; isCurrent: boolean; fields: Array<{ key: string; value: unknown; source: string }> }

export function DocumentVersionCompare() {
  const { id = "" } = useParams();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [error, setError] = useState("");
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    const found = await apiRequest<VersionRow[]>(`/documents/${encodeURIComponent(id)}/versions`);
    setVersions(found);
    setLeftId((selected) => selected || found[0]?.id || "");
    setRightId(found.at(-1)?.id ?? "");
  }
  useEffect(() => { void reload().catch((caught: Error) => setError(caught.message)); }, [id]);
  const left = versions.find((version) => version.id === leftId);
  const right = versions.find((version) => version.id === rightId);
  const fieldKeys = [...new Set([...(left?.fields ?? []).map((field) => field.key), ...(right?.fields ?? []).map((field) => field.key)])].sort();
  async function submitVersion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !reason.trim()) return;
    setBusy(true); setError("");
    try { if (await uploadDocumentVersion(id, file, reason.trim())) { setFile(null); setReason(""); await reload(); } }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível criar a versão."); }
    finally { setBusy(false); }
  }
  return <main><h1>Histórico de versões</h1>{error && <p role="alert">{error}</p>}
    <form onSubmit={(event) => void submitVersion(event)}>
      <h2>Enviar nova versão</h2>
      <label>Arquivo <input type="file" accept="application/pdf,image/png,image/jpeg" required onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} /></label>
      <label>Motivo da substituição <input value={reason} required maxLength={1000} onChange={(event) => setReason(event.currentTarget.value)} /></label>
      <button disabled={busy || !file || !reason.trim()}>{busy ? "Enviando…" : "Enviar versão"}</button>
    </form>
    <table><caption>Histórico de versões do documento</caption><thead><tr><th>Versão</th><th>Estado</th><th>Criada em</th><th>Motivo</th></tr></thead><tbody>
      {versions.map((version) => <tr key={version.id}><td>{version.number}{version.isCurrent ? " — VIGENTE" : ""}</td><td>{version.state}</td><td>{new Date(version.createdAt).toLocaleString("pt-BR")}</td><td>{version.replacementReason ?? "—"}</td></tr>)}
    </tbody></table>
    <section aria-label="Comparação de versões"><h2>Comparar informações extraídas</h2>
      <label>Versão A <select value={leftId} onChange={(event) => setLeftId(event.currentTarget.value)}>{versions.map((version) => <option key={version.id} value={version.id}>Versão {version.number}</option>)}</select></label>
      <label>Versão B <select value={rightId} onChange={(event) => setRightId(event.currentTarget.value)}>{versions.map((version) => <option key={version.id} value={version.id}>Versão {version.number}</option>)}</select></label>
      {left && right && <table><caption>Comparação dos campos extraídos</caption><thead><tr><th>Campo</th><th>Versão {left.number}</th><th>Versão {right.number}</th></tr></thead><tbody>
        {fieldKeys.map((key) => {
          const a = left.fields.find((field) => field.key === key); const b = right.fields.find((field) => field.key === key);
          const format = (value: unknown) => value === undefined || value === null || value === "" ? "—" : typeof value === "string" ? value : JSON.stringify(value);
          return <tr key={key}><th>{key}</th><td>{format(a?.value)}{a && <small> · {a.source}</small>}</td><td>{format(b?.value)}{b && <small> · {b.source}</small>}</td></tr>;
        })}
      </tbody></table>}
    </section>
  </main>;
}
