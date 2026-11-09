import type { CSSProperties } from "react";
import Link from "@/components/link";
import { CTA, langColors, type Lang } from "@/components/features/bandora/content";

export const playfair = "'Playfair Display',serif";
export const estedad = "'Estedad','Vazirmatn',sans-serif";

export function Logo({ style }: { style?: CSSProperties }) {
  return (
    <a href="#top" style={{ fontFamily: playfair, fontSize: 28, fontWeight: 600, color: "#1F2E54", lineHeight: 1, direction: "ltr", ...style }}>
      bandora<span style={{ color: "#B08D4A" }}>.</span>
    </a>
  );
}

export function LangToggle({ lang, onChange, menu }: { lang: Lang; onChange: (lang: Lang) => void; menu?: boolean }) {
  const colors = langColors(lang);
  const button = (background: string, color: string): CSSProperties => ({
    border: 0,
    cursor: "pointer",
    padding: menu ? "6px 16px" : "3px 12px",
    font: "inherit",
    background,
    color,
  });
  return (
    <div style={{ display: "flex", border: "1px solid #D9CFBB", borderRadius: 4, overflow: "hidden", fontSize: menu ? 14 : 13, direction: "ltr", fontFamily: playfair }}>
      <button type="button" onClick={() => onChange("FA")} style={button(colors.faBg, colors.faFg)}>FA</button>
      <button type="button" onClick={() => onChange("EN")} style={button(colors.enBg, colors.enFg)}>EN</button>
    </div>
  );
}

export function SignupLink({ className, style, children, onClick }: { className?: string; style?: CSSProperties; children: string; onClick?: () => void }) {
  return (
    <Link href={CTA.signup} className={className} style={style} onClick={onClick}>
      {children}
    </Link>
  );
}

export function LoginLink({ style, onClick }: { style?: CSSProperties; onClick?: () => void }) {
  return (
    <Link href={CTA.login} onClick={onClick} style={{ color: "#1A2238", ...style }}>
      ورود
    </Link>
  );
}
