import type { ComponentProps, CSSProperties } from "react";
import { FOOTER_TAG, NAV, menuIcon, type Lang } from "@/components/features/bandora/content";
import { LangToggle, LoginLink, Logo, SignupLink } from "@/components/features/bandora/bits";

const ENAMAD_HREF = "https://trustseal.enamad.ir/?id=8815501&Code=2Tsc6O5b6CL8gxvGp4hsJDH0N6wCTRgn";
const ENAMAD_SRC = "https://trustseal.enamad.ir/logo.aspx?id=8815501&Code=2Tsc6O5b6CL8gxvGp4hsJDH0N6wCTRgn";
const ENAMAD_CODE = "2Tsc6O5b6CL8gxvGp4hsJDH0N6wCTRgn";

type EnamadImageProps = ComponentProps<"img"> & { code: string };

const enamadImage: EnamadImageProps = {
  referrerPolicy: "origin",
  src: ENAMAD_SRC,
  alt: "نماد اعتماد الکترونیکی",
  code: ENAMAD_CODE,
  style: { cursor: "pointer", height: 80, width: "auto", maxWidth: "100%" },
};

function EnamadSeal() {
  return (
    <a referrerPolicy="origin" target="_blank" href={ENAMAD_HREF} style={{ display: "inline-block", lineHeight: 0 }}>
      <img {...enamadImage} />
    </a>
  );
}

const row: CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: "0 24px",
  height: 68,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 24,
};

export function BandoraHeader({
  mobile,
  menu,
  lang,
  onToggleMenu,
  onCloseMenu,
  onLang,
  onOpenLogin,
  onOpenSignup,
}: {
  mobile: boolean;
  menu: boolean;
  lang: Lang;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onLang: (lang: Lang) => void;
  onOpenLogin: () => void;
  onOpenSignup: () => void;
}) {
  return (
    <header data-screen-label="01 Header" style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(246,241,231,.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #D9CFBB" }}>
      <div style={row}>
        <Logo />
        {mobile ? (
          <button type="button" onClick={onToggleMenu} aria-label="منو" style={{ background: "none", border: "1px solid #D9CFBB", borderRadius: 4, width: 44, height: 44, display: "grid", placeItems: "center", cursor: "pointer", color: "#1F2E54" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }}>
              <path d={menuIcon(menu)} />
            </svg>
          </button>
        ) : (
          <>
            <nav style={{ display: "flex", gap: 36, fontSize: 15 }}>
              {NAV.map((item) => (
                <a key={item.href} href={item.href} className="bd-nav">{item.label}</a>
              ))}
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <LoginLink style={{ fontSize: 15 }} onOpen={onOpenLogin} />
              <LangToggle lang={lang} onChange={onLang} />
              <SignupLink className="bd-solid" style={{ borderRadius: 4, padding: "8px 20px", fontSize: 15 }} onOpen={onOpenSignup}>شروع رایگان</SignupLink>
            </div>
          </>
        )}
      </div>
      {mobile && menu ? (
        <div style={{ borderTop: "1px solid #D9CFBB", background: "#F6F1E7", padding: "12px 24px 24px", display: "grid", gap: 4 }}>
          {NAV.map((item) => (
            <a key={item.href} href={item.href} onClick={onCloseMenu} style={{ color: "#1A2238", padding: "12px 0", borderBottom: "1px solid #E7DFCD", minHeight: 44 }}>{item.label}</a>
          ))}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0" }}>
            <LoginLink onClick={onCloseMenu} onOpen={onOpenLogin} />
            <LangToggle lang={lang} onChange={onLang} menu />
          </div>
          <SignupLink onClick={onCloseMenu} onOpen={onOpenSignup} style={{ background: "#1F2E54", color: "#F6F1E7", borderRadius: 4, padding: "12px 20px", textAlign: "center" }}>شروع رایگان</SignupLink>
        </div>
      ) : null}
    </header>
  );
}

export function BandoraFooter() {
  return (
    <footer data-screen-label="10 Footer" style={{ padding: "72px 24px 32px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 48, paddingBottom: 48 }}>
          <div>
            <Logo style={{ display: "inline-block" }} />
            <p style={{ margin: "14px 0 0", color: "#4A5168", fontSize: 15 }}>{FOOTER_TAG}</p>
          </div>
          <div>
            <div style={{ fontFamily: "'Estedad','Vazirmatn',sans-serif", fontWeight: 700, color: "#1F2E54", marginBottom: 12 }}>دسترسی سریع</div>
            <div style={{ display: "grid", gap: 4, fontSize: 15 }}>
              {NAV.map((item) => (
                <a key={item.href} href={item.href} className="bd-footer-link">{item.label}</a>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: "'Estedad','Vazirmatn',sans-serif", fontWeight: 700, color: "#1F2E54", marginBottom: 12 }}>ارتباط با ما</div>
            <div style={{ display: "grid", gap: 4, fontSize: 15, color: "#4A5168" }}>
              <div>ایمیل پشتیبانی: [ایمیل پشتیبانی]</div>
              <div>اینستاگرام: [آیدی اینستاگرام]</div>
              <div>تماس با ما: [شماره تماس]</div>
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid #D9CFBB", paddingTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <EnamadSeal />
          <div style={{ textAlign: "center", font: "14px 'Playfair Display',serif", color: "#6B6757", direction: "ltr" }}>© 2026 Bandora. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
}
