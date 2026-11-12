import { useSetLocale } from "@/src/auth/use-set-locale";
import { useT } from "@/src/i18n";

/** FA / EN switch (same look as the landing toggle). Writes `users.locale`; nothing is kept in the browser. */
export function LocaleSwitch() {
  const { t, locale } = useT();
  const setLocale = useSetLocale();
  return (
    <div className="bd-lang" role="group" aria-label={t("locale.label")} dir="ltr">
      <button type="button" lang="fa" aria-pressed={locale === "fa"} onClick={() => void setLocale("fa")}>FA</button>
      <button type="button" lang="en" aria-pressed={locale === "en"} onClick={() => void setLocale("en")}>EN</button>
    </div>
  );
}
