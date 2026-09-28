export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly correlationId?: string) { super(message); }
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void { accessToken = token; }

async function renewAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1"}/auth/refresh`, {
      method: "POST", credentials: "include",
    }).then(async (response) => {
      if (!response.ok) return null;
      const payload = await response.json() as { accessToken?: string };
      return typeof payload.accessToken === "string" ? payload.accessToken : null;
    }).catch(() => null).then((token) => { accessToken = token; return token; }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1"}${path}`;
  const send = () => fetch(url, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(accessToken && !path.startsWith("/auth/") ? { authorization: `Bearer ${accessToken}` } : {}), ...init.headers },
  });
  let response = await send();
  if (response.status === 401 && !path.startsWith("/auth/")) {
    if (await renewAccessToken()) response = await send();
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({ code: "HTTP_ERROR", message: "Não foi possível concluir a solicitação." }));
    throw new ApiError(response.status, error.code ?? "HTTP_ERROR", error.message ?? "Não foi possível concluir a solicitação.", error.correlationId);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
