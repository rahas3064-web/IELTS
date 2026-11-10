import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { panelCopy, type PanelLocale } from "@/components/features/bandora/panel/model";

const STORAGE_KEY = "bandora-panel-locale";

type PanelLocaleValue = {
  locale: PanelLocale;
  setLocale: (locale: PanelLocale) => void;
  copy: ReturnType<typeof panelCopy>;
};

const PanelLocaleContext = createContext<PanelLocaleValue | null>(null);

function storedLocale(): PanelLocale {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "fa";
  } catch {
    return "fa";
  }
}

export function PanelLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<PanelLocale>(storedLocale);
  const setLocale = useCallback((next: PanelLocale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* Sample preference only; the page still switches for this visit. */
    }
  }, []);
  const value = useMemo(() => ({ locale, setLocale, copy: panelCopy(locale) }), [locale]);
  return <PanelLocaleContext.Provider value={value}>{children}</PanelLocaleContext.Provider>;
}

export function usePanelLocale() {
  const value = useContext(PanelLocaleContext);
  if (!value) throw new Error("usePanelLocale must be used inside the Bandora panel");
  return value;
}
