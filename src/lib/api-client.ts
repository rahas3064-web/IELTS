// Fetch wrapper for the Bandora JSON API. Cookie session (`bd_session`) rides on
// same-origin credentials; the browser adds the Origin header the server checks.

export type ApiErrorDetails = Record<string, unknown> | undefined;

export class ApiClientError extends Error {
  readonly code: string;
  readonly message_fa: string;
  readonly message_en: string;
  readonly status: number;
  readonly details: ApiErrorDetails;

  constructor(init: { code: string; message_fa?: string; message_en?: string; status: number; details?: ApiErrorDetails }) {
    super(init.message_en ?? init.code);
    this.name = "ApiClientError";
    this.code = init.code;
    this.message_fa = init.message_fa ?? "";
    this.message_en = init.message_en ?? "";
    this.status = init.status;
    this.details = init.details;
  }

  /** Seconds the server asked us to wait (rate limits and OTP locks). */
  get retryAfter(): number | null {
    const value = this.details?.retryAfter;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
  }
}

export type ApiHandlers = {
  /** 401 `session_replaced`: another device signed in. */
  onSessionReplaced?: () => void;
  /** Any other 401 on a non-auth endpoint: send the visitor to /login. */
  onUnauthenticated?: () => void;
};

let handlers: ApiHandlers = {};

/** Register the global 401 callbacks. Returns a cleanup that only removes its own registration. */
export function setApiHandlers(next: ApiHandlers): () => void {
  handlers = next;
  return () => {
    if (handlers === next) handlers = {};
  };
}

export type RequestOptions = {
  signal?: AbortSignal;
  /** Set false to deal with 401s yourself (the initial /api/me probe). Default true. */
  handleAuth?: boolean;
};

type Method = "GET" | "POST" | "PUT" | "DELETE";

function isAuthEndpoint(path: string): boolean {
  return path.startsWith("/api/auth/") || path.startsWith("/api/admin/auth/");
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toError(status: number, body: unknown): ApiClientError {
  const error = (body as { error?: Record<string, unknown> } | null | undefined)?.error;
  if (error && typeof error.code === "string") {
    return new ApiClientError({
      code: error.code,
      message_fa: typeof error.message_fa === "string" ? error.message_fa : undefined,
      message_en: typeof error.message_en === "string" ? error.message_en : undefined,
      status,
      details: (error.details as ApiErrorDetails) ?? undefined,
    });
  }
  return new ApiClientError({ code: "internal", status });
}

function notifyAuth(path: string, error: ApiClientError, options: RequestOptions) {
  if (error.status !== 401 || options.handleAuth === false || isAuthEndpoint(path)) return;
  if (error.code === "session_replaced") handlers.onSessionReplaced?.();
  else handlers.onUnauthenticated?.();
}

async function request<T>(method: Method, path: string, body: unknown, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "same-origin",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiClientError({ code: "network_error", status: 0 });
  }
  const parsed = await readJson(response);
  if (!response.ok) {
    const error = toError(response.status, parsed);
    notifyAuth(path, error, options);
    throw error;
  }
  return (parsed ?? null) as T;
}

// Mutating calls are never retried: one request, one outcome.
export const api = {
  get: <T>(path: string, options: RequestOptions = {}) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options: RequestOptions = {}) => request<T>("POST", path, body ?? undefined, options),
  put: <T>(path: string, body?: unknown, options: RequestOptions = {}) => request<T>("PUT", path, body ?? undefined, options),
  delete: <T>(path: string, options: RequestOptions = {}) => request<T>("DELETE", path, undefined, options),
};
