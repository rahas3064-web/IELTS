import { useCallback, useRef, useState, type CSSProperties } from "react";
import { nextFaq, type Lang, type Timeline } from "@/components/features/bandora/content";
import { BandoraHeader, BandoraFooter } from "@/components/features/bandora/header";
import { BandoraHero } from "@/components/features/bandora/hero";
import { BandoraFeatures, BandoraHow, BandoraPhilosophy, BandoraTrust } from "@/components/features/bandora/story";
import { BandoraFaq, BandoraFinalCta, BandoraPricing } from "@/components/features/bandora/plans";
import { useBandoraMotion, useMobileWidth } from "@/components/features/bandora/use-bandora-motion";
import "@/components/features/bandora/landing.css";

const page: CSSProperties = {
  fontFamily: "'Vazirmatn',sans-serif",
  color: "#1A2238",
  background: "#F6F1E7",
  fontSize: 17,
  lineHeight: 1.9,
  overflowX: "hidden",
};

const fonts = "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Vazirmatn:wght@300;400;500;600;700&display=swap";
const estedad = "https://cdn.jsdelivr.net/npm/@fontsource/estedad@5/index.css";

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const mobile = useMobileWidth();
  const [menu, setMenu] = useState(false);
  const [lang, setLang] = useState<Lang>("FA");
  const [open, setOpen] = useState(0);
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const setTimelineState = useCallback((next: Timeline) => setTimeline(next), []);
  useBandoraMotion(rootRef, setTimelineState);

  return (
    <div ref={rootRef} className="bandora-landing" dir="rtl" lang="fa" style={page}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={fonts} />
      <link rel="stylesheet" href={estedad} />
      <BandoraHeader
        mobile={mobile}
        menu={menu}
        lang={lang}
        onToggleMenu={() => setMenu((current) => !current)}
        onCloseMenu={() => setMenu(false)}
        onLang={setLang}
      />
      <BandoraHero />
      <BandoraTrust mobile={mobile} />
      <BandoraPhilosophy />
      <BandoraFeatures />
      <BandoraHow mobile={mobile} timeline={timeline} />
      <BandoraPricing />
      <BandoraFaq open={open} onToggle={(index) => setOpen((current) => nextFaq(current, index))} />
      <BandoraFinalCta />
      <BandoraFooter />
    </div>
  );
}
