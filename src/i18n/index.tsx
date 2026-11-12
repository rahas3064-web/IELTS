import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import fa from "@/src/i18n/fa.json";
import en from "@/src/i18n/en.json";
import { faDigits, formatNumber, interpolate, type Locale, type Vars } from "@/src/i18n/format";

export { faDigits, formatClock, formatNumber, LOCALES, type Locale } from "@/src/i18n/format";

export type Dictionary = Record<string, string>;
export type TFunction = (key: string, vars?: Vars) => string;

export const dictionaries: Record<Locale, Dictionary> = { fa, en };

export function directionOf(locale: Locale): "rtl" | "ltr" {
  return locale === "fa" ? "rtl" : "ltr";
}

/** Look a key up; a missing key shows the key itself so gaps are visible, never blank. */
export function translate(locale: Locale, key: string, vars?: Vars): string {
  return interpolate(dictionaries[locale][key] ?? key, vars, locale);
}

export type I18nValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  t: TFunction;
  /** A number in this locale's digits. */
  n: (value: number) => string;
  /** Latin digits inside already-built text become Persian in `fa`. */
  digits: (value: string | number) => string;
};

function build(locale: Locale): I18nValue {
  return {
    locale,
    dir: directionOf(locale),
    t: (key, vars) => translate(locale, key, vars),
    n: (value) => formatNumber(value, locale),
    digits: (value) => (locale === "fa" ? faDigits(value) : String(value)),
  };
}

const I18nContext = createContext<I18nValue>(build("fa"));

/** The locale comes from the caller (`users.locale`, or `fa` before login); it is never stored in the browser. */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo(() => build(locale), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nValue {
  return useContext(I18nContext);
}

/** Mirror the locale onto <html lang dir> while mounted; restore the previous values on unmount. */
export function useDocumentLocale(locale: Locale) {
  useEffect(() => {
    const root = document.documentElement;
    const previous = { lang: root.lang, dir: root.dir };
    root.lang = locale;
    root.dir = directionOf(locale);
    return () => {
      root.lang = previous.lang;
      root.dir = previous.dir;
    };
  }, [locale]);
}
