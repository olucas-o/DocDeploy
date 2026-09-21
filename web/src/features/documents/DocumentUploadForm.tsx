import { useState, type FormEvent } from "react";

import type { CreateDocumentInput } from "../../services/documents-api";

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg";

export function DocumentUploadForm({ onSubmit }: { onSubmit: (input: CreateDocumentInput, file: File) => Promise<void> }) {
  const [file, setFile] = useState<File>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) { setError("Selecione um arquivo PDF, PNG ou JPEG."); return; }
    const data = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      await onSubmit({
        name: String(data.get("name")), type: String(data.get("type")), origin: String(data.get("origin")),
        receivedAt: new Date(String(data.get("receivedAt"))).toISOString(), responsibleId: String(data.get("responsibleId")),
        fileName: file.name, contentType: file.type, size: file.size,
      }, file);
      event.currentTarget.reset(); setFile(undefined);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível registrar o documento."); }
    finally { setPending(false); }
  }

  return <form onSubmit={submit}>
    <label>Nome<input name="name" required maxLength={255} /></label>
    <label>Tipo<select name="type" required><option value="contract">Contrato</option><option value="invoice">Nota</option><option value="certificate">Certificado</option><option value="report">Relatório</option><option value="registration">Cadastro</option></select></label>
    <label>Origem<input name="origin" required maxLength={255} /></label>
    <label>Recebido em<input name="receivedAt" type="datetime-local" required /></label>
    <label>Responsável<input name="responsibleId" required /></label>
    <label>Arquivo<input aria-label="Arquivo" name="file" type="file" accept={ACCEPT} required onChange={(event) => {
      const selected = event.target.files?.[0];
      if (!selected) return;
      if (selected.size > MAX_BYTES) { setFile(undefined); setError("O arquivo deve ter no máximo 25 MB."); return; }
      if (!ACCEPT.split(",").includes(selected.type)) { setFile(undefined); setError("Envie um arquivo PDF, PNG ou JPEG."); return; }
      setFile(selected); setError("");
    }} /></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={pending} type="submit">{pending ? "Enviando…" : "Registrar documento"}</button>
  </form>;
}
