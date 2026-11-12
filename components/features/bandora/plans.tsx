import { CHECK_PATH, CTA, FAQ_HEAD, FINAL_CTA, FREE_FEATURES, PREMIUM_FEATURES, PRICING_HEAD, faqView } from "@/components/features/bandora/content";
import { SignupLink, estedad, playfair } from "@/components/features/bandora/bits";

export function BandoraPricing() {
  return (
    <section id="pricing" data-screen-label="07 Pricing" style={{ padding: "112px 24px", borderTop: "1px solid #D9CFBB" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div data-reveal="1" style={{ maxWidth: 700, margin: "0 auto 64px", textAlign: "center" }}>
          <div style={{ fontFamily: playfair, fontStyle: "italic", color: "#7A5C1E", marginBottom: 16 }}>{PRICING_HEAD.kicker}</div>
          <h2 style={{ fontFamily: estedad, fontWeight: 800, fontSize: "clamp(26px,3.2vw,38px)", lineHeight: 1.6, margin: 0, color: "#1F2E54", textWrap: "balance" }}>{PRICING_HEAD.title}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,400px),1fr))", gap: 28, alignItems: "stretch" }}>
          <div data-reveal="1" style={{ border: "1px solid #D9CFBB", borderRadius: 6, background: "#FBF8F1", padding: "44px 40px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: playfair, fontSize: 30, color: "#1F2E54", fontWeight: 500 }}>Free</div>
            <div style={{ fontFamily: estedad, fontWeight: 800, fontSize: 34, color: "#1F2E54", margin: "6px 0 28px", lineHeight: 1.4 }}>رایگان</div>
            <div style={{ height: 1, background: "#D9CFBB", marginBottom: 24 }} />
            <ul style={{ listStyle: "none", margin: "0 0 36px", padding: 0, display: "grid", gap: 14, flex: 1 }}>
              {FREE_FEATURES.map((item) => (
                <li key={item} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 17, color: "#1A2238" }}>
                  <Check color="#4E7B62" />
                  {item}
                </li>
              ))}
            </ul>
            <SignupLink className="bd-outline" style={{ textAlign: "center", borderRadius: 4, padding: 13 }}>شروع رایگان</SignupLink>
          </div>
          <div data-reveal="1" style={{ position: "relative", border: "1px solid #B08D4A", borderRadius: 6, background: "#1F2E54", color: "#F6F1E7", padding: "44px 40px", display: "flex", flexDirection: "column", boxShadow: "inset 0 0 0 6px #1F2E54, inset 0 0 0 7px rgba(176,141,74,.45)" }}>
            <span style={{ position: "absolute", top: 22, left: 24, border: "1px solid #D6B87A", color: "#D6B87A", borderRadius: 3, padding: "0 12px", fontSize: 13, lineHeight: "26px" }}>پیشنهاد ما</span>
            <div style={{ fontFamily: playfair, fontSize: 30, color: "#F6F1E7", fontWeight: 500 }}>Premium</div>
            <div style={{ fontFamily: estedad, fontWeight: 800, fontSize: 34, color: "#D6B87A", margin: "6px 0 28px", lineHeight: 1.4 }}>
              ۹۹۸٬۰۰۰ تومان
              <div style={{ fontFamily: estedad, fontWeight: 600, fontSize: 16, color: "#D6B87A", lineHeight: 1.6, marginTop: 4 }}>سه‌ماهه ۱٬۸۹۷٬۰۰۰ تومان</div>
            </div>
            <div style={{ height: 1, background: "rgba(214,184,122,.35)", marginBottom: 24 }} />
            <ul style={{ listStyle: "none", margin: "0 0 36px", padding: 0, display: "grid", gap: 14, flex: 1 }}>
              {PREMIUM_FEATURES.map((item) => (
                <li key={item} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 17 }}>
                  <Check color="#D6B87A" />
                  {item}
                </li>
              ))}
            </ul>
            <a href={CTA.pricing} className="bd-cream" style={{ textAlign: "center", borderRadius: 4, padding: 13 }}>مشاهده پلن</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Check({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ width: 18, height: 18, flex: "none", color, fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }}>
      <path d={CHECK_PATH} />
    </svg>
  );
}

export function BandoraFaq({ open, onToggle }: { open: number; onToggle: (index: number) => void }) {
  return (
    <section id="faq" data-screen-label="08 FAQ" style={{ padding: "112px 24px", borderTop: "1px solid #D9CFBB" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <div data-reveal="1" style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ fontFamily: playfair, fontStyle: "italic", color: "#7A5C1E", marginBottom: 16 }}>{FAQ_HEAD.kicker}</div>
          <h2 style={{ fontFamily: estedad, fontWeight: 800, fontSize: "clamp(26px,3.2vw,38px)", lineHeight: 1.6, margin: 0, color: "#1F2E54" }}>{FAQ_HEAD.title}</h2>
        </div>
        <div style={{ borderTop: "1px solid #D9CFBB" }}>
          {faqView(open).map((item, index) => (
            <div key={item.q} style={{ borderBottom: "1px solid #D9CFBB" }}>
              <button type="button" onClick={() => onToggle(index)} aria-expanded={item.open} style={{ all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, padding: "24px 4px", fontFamily: estedad, fontWeight: 600, fontSize: 18, lineHeight: 1.7, color: "#1F2E54" }}>
                <span>{item.q}</span>
                <svg width="22" height="22" viewBox="0 0 24 24" style={{ width: 22, height: 22, flex: "none", color: "#B08D4A", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", transition: "transform .3s", transform: item.rot }}>
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              <div style={{ display: "grid", gridTemplateRows: item.rows, transition: "grid-template-rows .35s ease" }}>
                <div style={{ overflow: "hidden" }}>
                  <p style={{ margin: 0, padding: "0 4px 26px", color: "#3F465C", fontSize: 16, textWrap: "pretty" }}>{item.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BandoraFinalCta() {
  return (
    <section data-screen-label="09 Final CTA" style={{ background: "#1F2E54", color: "#F6F1E7", padding: "104px 24px", textAlign: "center" }}>
      <div data-reveal="1" style={{ maxWidth: 820, margin: "0 auto" }}>
        <div style={{ width: 56, height: 1, background: "#B08D4A", margin: "0 auto 32px" }} />
        <h2 style={{ fontFamily: estedad, fontWeight: 800, fontSize: "clamp(28px,3.8vw,44px)", lineHeight: 1.6, margin: "0 0 40px", textWrap: "balance" }}>{FINAL_CTA}</h2>
        <SignupLink className="bd-cream" style={{ display: "inline-block", borderRadius: 4, padding: "14px 38px" }}>شروع رایگان</SignupLink>
      </div>
    </section>
  );
}
