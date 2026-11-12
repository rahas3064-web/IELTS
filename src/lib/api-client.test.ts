import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, api, setApiHandlers } from "@/src/lib/api-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const errorBody = (code: string, extra: Record<string, unknown> = {}) => ({
  error: { code, message_fa: "پیام", message_en: "Message", ...extra },
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  setApiHandlers({});
  vi.unstubAllGlobals();
});

describe("api client requests", () => {
  it("sends same-origin credentials and a JSON body", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
    const result = await api.post<{ ok: boolean }>("/api/auth/otp/request", { phone: "09123456789" });
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("/api/auth/otp/request");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    expect(headers["content-type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ phone: "09123456789" }));
  });

  it("does not send a body or content type on GET", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ a: 1 }));
    await api.get("/api/me");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect(headers["content-type"]).toBeUndefined();
  });

  it("tolerates an empty 204 body", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(api.post("/api/auth/logout")).resolves.toBeNull();
  });
});

describe("api client errors", () => {
  it("parses the uniform error shape", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(errorBody("rate_limited", { details: { retryAfter: 42 } }), 429),
    );
    const error = await api.post("/api/auth/otp/request", {}).catch((e) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "rate_limited",
      message_fa: "پیام",
      message_en: "Message",
      status: 429,
      details: { retryAfter: 42 },
    });
  });

  it("wraps unparsable failures as a generic error", async () => {
    fetchMock.mockResolvedValue(new Response("<html>bad gateway</html>", { status: 502 }));
    const error = await api.get("/api/frame").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error as ApiClientError).toMatchObject({ code: "internal", status: 502 });
  });

  it("reports network failures with code network_error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await api.get("/api/frame").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error as ApiClientError).toMatchObject({ code: "network_error", status: 0 });
  });

  it("never retries a failing mutating call", async () => {
    fetchMock.mockResolvedValue(jsonResponse(errorBody("internal"), 500));
    await api.put("/api/onboarding", { step: 1 }).catch(() => undefined);
    await api.post("/api/auth/logout").catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("central 401 handling", () => {
  it("triggers the session-replaced callback", async () => {
    const onSessionReplaced = vi.fn();
    const onUnauthenticated = vi.fn();
    setApiHandlers({ onSessionReplaced, onUnauthenticated });
    fetchMock.mockResolvedValue(jsonResponse(errorBody("session_replaced"), 401));
    await api.get("/api/frame").catch(() => undefined);
    expect(onSessionReplaced).toHaveBeenCalledTimes(1);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("triggers the redirect callback for other 401s", async () => {
    const onSessionReplaced = vi.fn();
    const onUnauthenticated = vi.fn();
    setApiHandlers({ onSessionReplaced, onUnauthenticated });
    fetchMock.mockResolvedValue(jsonResponse(errorBody("unauthenticated"), 401));
    await api.get("/api/notifications").catch(() => undefined);
    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
    expect(onSessionReplaced).not.toHaveBeenCalled();
  });

  it("leaves auth endpoints and opted-out calls to their callers", async () => {
    const onUnauthenticated = vi.fn();
    setApiHandlers({ onUnauthenticated });
    fetchMock.mockResolvedValue(jsonResponse(errorBody("unauthenticated"), 401));
    await api.post("/api/auth/password/login", {}).catch(() => undefined);
    await api.get("/api/me", { handleAuth: false }).catch(() => undefined);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it("does not fire callbacks for non-401 errors", async () => {
    const onUnauthenticated = vi.fn();
    setApiHandlers({ onUnauthenticated });
    fetchMock.mockResolvedValue(jsonResponse(errorBody("forbidden"), 403));
    await api.get("/api/frame").catch(() => undefined);
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });
});
