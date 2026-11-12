import type { ReactNode } from "react";
import { useDocumentLocale, useT } from "@/src/i18n";
import "@/components/features/bandora/panel/panel.css";

// The same font stylesheets the landing page loads (landing-page.tsx).
const FONTS =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Vazirmatn:wght@300;400;500;600;700&display=swap";
const ESTEDAD = "https://cdn.jsdelivr.net/npm/@fontsource/estedad@5/index.css";

/** Root of every login, onboarding and panel screen: tokens, fonts, `lang` and `dir` from the user's locale. */
export function AppFrame({ children }: { children: ReactNode }) {
  const { locale, dir } = useT();
  useDocumentLocale(locale);
  return (
    <div className="bd-app" data-locale={locale} dir={dir} lang={locale}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={FONTS} />
      <link rel="stylesheet" href={ESTEDAD} />
      {children}
    </div>
  );
}
