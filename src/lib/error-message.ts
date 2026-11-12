import { ApiClientError } from "@/src/lib/api-client";
import type { I18nValue } from "@/src/i18n";

/** User-facing text for a failed call: the server's own message in the user's language, else a generic one. */
export function errorText(error: unknown, { locale, t }: Pick<I18nValue, "locale" | "t">): string {
  if (error instanceof ApiClientError) {
    if (error.code === "network_error") return t("error.network");
    const message = locale === "fa" ? error.message_fa : error.message_en;
    if (message) return message;
  }
  return t("error.generic");
}

/** The server's message for one field (`details.fields[field]`), if it sent one. */
export function fieldErrorText(error: unknown, field: string, { locale }: Pick<I18nValue, "locale">): string | null {
  if (!(error instanceof ApiClientError)) return null;
  const fields = error.details?.fields as Record<string, { message_fa?: string; message_en?: string }> | undefined;
  const entry = fields?.[field];
  const message = locale === "fa" ? entry?.message_fa : entry?.message_en;
  return message || null;
}
