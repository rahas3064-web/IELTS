export type Locale = "fa" | "en";

export const LOCALES: readonly Locale[] = ["fa", "en"];

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Latin digits (and the Latin decimal point) to Persian digits. */
export function faDigits(value: string | number): string {
  return String(value)
    .replace(/\d/g, (digit) => FA_DIGITS[Number(digit)])
    .replace(/(?<=[۰-۹])\.(?=[۰-۹])/g, "٫");
}

/** A number in the locale's own digits, with thousands separators. */
export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(value);
}

/** `m:ss` countdown text, in Persian digits for `fa`. */
export function formatClock(totalSeconds: number, locale: Locale): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const text = `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
  return locale === "fa" ? faDigits(text) : text;
}

export type Vars = Record<string, string | number>;

/** Replace `{name}` placeholders; numbers get locale digits. Unknown placeholders stay visible. */
export function interpolate(template: string, vars: Vars | undefined, locale: Locale): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = vars[name];
    if (value === undefined) return whole;
    return typeof value === "number" ? formatNumber(value, locale) : value;
  });
}
