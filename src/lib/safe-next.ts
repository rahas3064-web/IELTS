const FALLBACK = "/app";

/** Accept only same-origin app paths for `?next=`; anything else becomes `/app`. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return FALLBACK;
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login#")) return FALLBACK;
  if (value !== "/app" && !value.startsWith("/app/") && !value.startsWith("/app?") && !value.startsWith("/app#")) return FALLBACK;
  return value;
}

/** `/login`, with `?next=` when the visitor was heading somewhere inside the app. */
export function loginHref(next: string | null | undefined): string {
  if (!next || !next.startsWith("/app")) return "/login";
  return `/login?next=${encodeURIComponent(next)}`;
}
