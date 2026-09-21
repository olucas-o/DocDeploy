export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly correlationId?: string) { super(message); }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1"}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ code: "HTTP_ERROR", message: "Não foi possível concluir a solicitação." }));
    throw new ApiError(response.status, error.code ?? "HTTP_ERROR", error.message ?? "Não foi possível concluir a solicitação.", error.correlationId);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
