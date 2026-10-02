import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiRequest, setAccessToken } from "../services/api-client";

describe("API session regression protection", () => {
  const transport = vi.fn<typeof fetch>();

  beforeEach(() => {
    transport.mockReset();
    vi.stubGlobal("fetch", transport);
    setAccessToken(null);
  });

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
  });

  it("sends session credentials and preserves the caller's request body", async () => {
    setAccessToken("active-token");
    transport.mockResolvedValueOnce(Response.json({ id: "doc-1" }));

    await expect(apiRequest("/documents", { method: "POST", body: '{"name":"Invoice"}' }))
      .resolves.toEqual({ id: "doc-1" });
    expect(transport).toHaveBeenCalledWith(expect.stringContaining("/documents"), expect.objectContaining({
      method: "POST", body: '{"name":"Invoice"}', credentials: "include",
      headers: { "content-type": "application/json", authorization: "Bearer active-token" },
    }));
  });

  it("shares one refresh between concurrent unauthorized requests and retries both with the new token", async () => {
    setAccessToken("expired-token");
    let completeRefresh!: (response: Response) => void;
    const refresh = new Promise<Response>((resolve) => { completeRefresh = resolve; });
    transport.mockImplementation(async (url, init) => {
      if (String(url).endsWith("/auth/refresh")) return refresh;
      const token = new Headers(init?.headers).get("authorization");
      return token === "Bearer renewed-token"
        ? Response.json({ id: String(url).endsWith("/documents/one") ? "one" : "two" })
        : Response.json({ code: "EXPIRED" }, { status: 401 });
    });

    const pending = Promise.all([apiRequest("/documents/one"), apiRequest("/documents/two")]);
    await vi.waitFor(() => expect(transport).toHaveBeenCalledTimes(3));
    completeRefresh(Response.json({ accessToken: "renewed-token" }));

    await expect(pending).resolves.toEqual([{ id: "one" }, { id: "two" }]);
    expect(transport).toHaveBeenCalledTimes(5);
    expect(transport.mock.calls.filter(([url]) => String(url).endsWith("/auth/refresh"))).toHaveLength(1);
  });

  it("does not loop when a retried request is still unauthorized", async () => {
    transport.mockResolvedValueOnce(Response.json({ code: "EXPIRED" }, { status: 401 }))
      .mockResolvedValueOnce(Response.json({ accessToken: "renewed-token" }))
      .mockResolvedValueOnce(Response.json({ code: "REVOKED", message: "Revoked" }, { status: 401 }));

    await expect(apiRequest("/documents")).rejects.toMatchObject({ status: 401, code: "REVOKED" });
    expect(transport).toHaveBeenCalledTimes(3);
  });

  it.each(["rejected", "network", "malformed"])("clears a stale token after a %s refresh failure", async (failure) => {
    setAccessToken("expired-token");
    transport.mockResolvedValueOnce(Response.json({ code: "EXPIRED" }, { status: 401 }));
    if (failure === "network") transport.mockRejectedValueOnce(new TypeError("offline"));
    else transport.mockResolvedValueOnce(failure === "rejected"
      ? Response.json({}, { status: 401 }) : Response.json({ accessToken: 123 }));

    await expect(apiRequest("/documents")).rejects.toMatchObject({ status: 401, code: "EXPIRED" });
    expect(transport).toHaveBeenCalledTimes(2);
    transport.mockResolvedValueOnce(Response.json([]));
    await apiRequest("/documents");
    expect(new Headers(transport.mock.calls[2]?.[1]?.headers).has("authorization")).toBe(false);
  });

  it("does not attach a bearer token or attempt refresh for login failures", async () => {
    setAccessToken("old-token");
    transport.mockResolvedValueOnce(Response.json({ code: "INVALID_CREDENTIALS" }, { status: 401 }));

    await expect(apiRequest("/auth/login", { method: "POST" })).rejects.toBeInstanceOf(ApiError);
    expect(transport).toHaveBeenCalledTimes(1);
    expect(new Headers(transport.mock.calls[0]?.[1]?.headers).has("authorization")).toBe(false);
  });

  it("returns no content for successful 204 responses", async () => {
    transport.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiRequest("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("preserves structured errors and correlation IDs for troubleshooting", async () => {
    transport.mockResolvedValueOnce(Response.json({ code: "FORBIDDEN", message: "Denied", correlationId: "trace-42" }, { status: 403 }));
    await expect(apiRequest("/documents")).rejects.toMatchObject({ status: 403, code: "FORBIDDEN", message: "Denied", correlationId: "trace-42" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("converts non-JSON server errors into an API error", async () => {
    transport.mockResolvedValueOnce(new Response("Bad gateway", { status: 502 }));
    await expect(apiRequest("/documents")).rejects.toMatchObject({ status: 502, code: "HTTP_ERROR" });
  });
});
