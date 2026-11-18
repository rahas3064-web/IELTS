import type { ReactNode } from "react";
import Link from "@/components/link";
import { LEGAL_VERSION } from "@/lib/legal-version.js";
import { useT } from "@/src/i18n";

export { LEGAL_VERSION };
export const LEGAL_EMAIL = "rahas3064@gmail.com";

/** One public legal page. The version and date sit above the text. */
export function LegalDocument({ titleKey, children }: { titleKey: string; children: ReactNode }) {
  const { t, dir, locale } = useT();
  return (
    <main className="bd-legal">
      <article dir={dir} lang={locale} aria-labelledby="legal-title">
        <p className="bd-legal__meta">{t("legal.versionLabel", { version: LEGAL_VERSION })}</p>
        <p className="bd-legal__meta">{t("legal.date")}</p>
        <h1 id="legal-title">{t(titleKey)}</h1>
        {children}
        <p>
          {t("legal.operator")}
          {" "}
          <a className="bd-legal__email" href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
        </p>
      </article>
      <LegalLinks />
    </main>
  );
}

export function LegalParagraph({ textKey }: { textKey: string }) {
  const { t } = useT();
  return <p>{t(textKey)}</p>;
}

/** Links for the login page and the panel footer. Not used on the landing page. */
export function LegalLinks() {
  const { t } = useT();
  return (
    <nav className="bd-legal-links" aria-label={t("legal.nav")}>
      <Link href="/terms">{t("legal.terms.title")}</Link>
      <Link href="/privacy">{t("legal.privacy.title")}</Link>
      <Link href="/refund">{t("legal.refund.title")}</Link>
    </nav>
  );
}
