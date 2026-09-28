import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiRequest, setAccessToken } from "../../services/api-client";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await apiRequest<{ accessToken: string }>("/auth/session", {
        method: "POST", body: JSON.stringify({ email, password, ...(organizationId ? { organizationId } : {}) }),
      });
      setAccessToken(result.accessToken);
      navigate("/documents", { replace: true });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível iniciar a sessão."); }
    finally { setBusy(false); }
  }
  return <main><h1>Entrar no DocDeploy</h1><form onSubmit={(event) => void submit(event)}>
    <label>E-mail<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.currentTarget.value)} /></label>
    <label>Senha<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.currentTarget.value)} /></label>
    <label>Organização (opcional)<input value={organizationId} onChange={(event) => setOrganizationId(event.currentTarget.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
  </form><p><Link to="/">Início</Link></p></main>;
}
