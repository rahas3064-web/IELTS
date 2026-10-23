import type { Locale } from "@/lib/types";

export function formatNumber(value: number, locale: Locale, digits = 0) {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatBand(value: number, locale: Locale) {
  return formatNumber(value, locale, 1);
}

export function formatDate(iso: string, locale: Locale) {
  const date = new Date(iso.includes("T") ? iso : `${iso}T12:00:00`);
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en-GB", {
    dateStyle: "medium",
  }).format(date);
}

export function formatClock(totalSeconds: number, locale: Locale) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  const text = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return locale === "fa" ? text.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]) : text;
}

export function todayIso(now = new Date()) {
  const copy = new Date(now);
  copy.setHours(12, 0, 0, 0);
  return copy.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string) {
  const from = new Date(`${fromIso}T12:00:00`).getTime();
  const to = new Date(`${toIso}T12:00:00`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function wordCount(text: string) {
  const words = text.trim().match(/[A-Za-z0-9''-]+/g);
  return words?.length ?? 0;
}

export function biText(locale: Locale, fa: string, en: string) {
  return locale === "fa" ? fa : en;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
