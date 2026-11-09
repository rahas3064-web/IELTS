import { CTA, FEATURES, FEATURES_HEAD, HOW_HEAD, PHILOSOPHY, stepViews, trustViews, type Timeline } from "@/components/features/bandora/content";
import { estedad, playfair } from "@/components/features/bandora/bits";

export function BandoraTrust({ mobile }: { mobile: boolean }) {
  return (
    <section data-screen-label="03 Trust Bar" style={{ borderTop: "1px solid #D9CFBB", borderBottom: "1px solid #D9CFBB" }}>
      <div data-reveal="1" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))" }}>
        {trustViews(mobile).map((item) => (
          <div key={item.title} style={{ padding: "36px 32px", display: "flex", gap: 18, alignItems: "flex-start", borderTop: item.bt, borderInlineStart: item.bs }}>
            <svg width="30" height="30" viewBox="0 0 24 24" style={{ width: 30, height: 30, flex: "none", color: "#B08D4A", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d={item.d} />
            </svg>
            <div>
              <div style={{ fontFamily: estedad, fontWeight: 700, fontSize: 19, color: "#1F2E54", lineHeight: 1.6 }}>{item.title}</div>
              <div style={{ color: "#4A5168", fontSize: 15 }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function BandoraPhilosophy() {
  return (
    <section id="philosophy" data-screen-label="04 Philosophy" style={{ padding: "112px 24px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 72, alignItems: "center" }}>
        <div data-reveal="1">
          <div style={{ fontFamily: playfair, fontStyle: "italic", color: "#7A5C1E", marginBottom: 16, direction: "ltr", textAlign: "right" }}>{PHILOSOPHY.kicker}</div>
          <h2 style={{ fontFamily: estedad, fontWeight: 800, fontSize: "clamp(28px,3.4vw,40px)", lineHeight: 1.5, margin: "0 0 24px", color: "#1F2E54", textWrap: "balance" }}>{PHILOSOPHY.title}</h2>
          <p style={{ margin: "0 0 32px", maxWidth: 520, color: "#3F465C", textWrap: "pretty" }}>{PHILOSOPHY.body}</p>
          <a href={CTA.how} className="bd-outline-lift" style={{ display: "inline-block", borderRadius: 4, padding: "12px 28px" }}>با روش Bandora آشنا شو</a>
        </div>
        <div data-reveal="1" style={{ direction: "ltr", border: "1px solid #D9CFBB", borderRadius: 6, padding: "28px 24px 20px", background: "#FBF8F1", minWidth: 0 }}>
          <div style={{ font: "600 13px 'Playfair Display',serif", letterSpacing: ".14em", textTransform: "uppercase", color: "#7A5C1E", marginBottom: 12 }}>Progress Path</div>
          <ProgressPath />
        </div>
      </div>
    </section>
  );
}

function ProgressPath() {
  return (
    <svg viewBox="0 0 580 380" style={{ width: "100%", height: "auto", display: "block" }}>
      <g style={{ stroke: "#D9CFBB", strokeWidth: 1, strokeDasharray: "3 5" }}>
        <line x1="490" y1="330" x2="490" y2="362" />
        <line x1="390" y1="270" x2="390" y2="362" />
        <line x1="290" y1="210" x2="290" y2="362" />
        <line x1="190" y1="150" x2="190" y2="362" />
        <line x1="90" y1="90" x2="90" y2="362" />
      </g>
      <line x1="20" y1="362" x2="560" y2="362" style={{ stroke: "#CBBF9F", strokeWidth: 1 }} />
      <path d="M560 330 H440 V270 H340 V210 H240 V150 H140 V90 H20" style={{ fill: "none", stroke: "#1F2E54", strokeWidth: 2.2, strokeLinejoin: "round" }} />
      <g style={{ fill: "#FBF8F1", stroke: "#B08D4A", strokeWidth: 2 }}>
        <circle cx="490" cy="330" r="8" />
        <circle cx="390" cy="270" r="8" />
        <circle cx="290" cy="210" r="8" />
        <circle cx="190" cy="150" r="8" />
      </g>
      <circle cx="90" cy="90" r="9" style={{ fill: "#B08D4A", stroke: "#B08D4A" }} />
      <g style={{ font: "500 15px 'Cormorant Garamond',serif", fill: "#1F2E54", textAnchor: "middle", fontStyle: "italic" }}>
        <text x="490" y="308">Placement</text>
        <text x="390" y="248">Study Plan</text>
        <text x="290" y="188">Practice</text>
        <text x="190" y="128">AI Feedback</text>
        <text x="90" y="64" style={{ fill: "#7A5C1E", fontWeight: 600 }}>Target Band</text>
      </g>
    </svg>
  );
}

export function BandoraFeatures() {
  return (
    <section id="features" data-screen-label="05 Core Features" style={{ padding: "112px 24px", borderTop: "1px solid #D9CFBB" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div data-reveal="1" style={{ maxWidth: 760, margin: "0 auto 64px", textAlign: "center" }}>
          <div style={{ fontFamily: playfair, fontStyle: "italic", color: "#7A5C1E", marginBottom: 16 }}>{FEATURES_HEAD.kicker}</div>
          <h2 style={{ fontFamily: estedad, fontWeight: 800, fontSize: "clamp(26px,3.2vw,38px)", lineHeight: 1.6, margin: 0, color: "#1F2E54", textWrap: "balance" }}>{FEATURES_HEAD.title}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: 24 }}>
          {FEATURES.map((feature) => (
            <article key={feature.en} data-reveal="1" className="bd-feature">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                <svg width="34" height="34" viewBox="0 0 24 24" style={{ width: 34, height: 34, color: "#1F2E54", fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" }}>
                  <path d={feature.d} />
                </svg>
                <span style={{ fontFamily: playfair, fontSize: 15, color: "#B08D4A", letterSpacing: ".1em" }}>{feature.n}</span>
              </div>
              <div style={{ fontFamily: playfair, fontStyle: "italic", fontSize: 19, color: "#7A5C1E", direction: "ltr", textAlign: "right", marginBottom: 6 }}>{feature.en}</div>
              <h3 style={{ fontFamily: estedad, fontWeight: 700, fontSize: 22, lineHeight: 1.6, margin: "0 0 12px", color: "#1F2E54" }}>{feature.title}</h3>
              <p style={{ margin: 0, color: "#3F465C", fontSize: 16, textWrap: "pretty" }}>{feature.desc}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BandoraHow({ mobile, timeline }: { mobile: boolean; timeline: Timeline | null }) {
  return (
    <section id="how-it-works" data-screen-label="06 How It Works" style={{ padding: "112px 24px", borderTop: "1px solid #D9CFBB" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: 72, alignItems: "start" }}>
        <div data-reveal="1" style={{ position: mobile ? "static" : "sticky", top: 112 }}>
          <div style={{ fontFamily: playfair, fontStyle: "italic", color: "#7A5C1E", marginBottom: 16, direction: "ltr", textAlign: "right" }}>{HOW_HEAD.kicker}</div>
          <h2 style={{ fontFamily: estedad, fontWeight: 800, fontSize: "clamp(26px,3.2vw,38px)", lineHeight: 1.6, margin: 0, color: "#1F2E54", textWrap: "balance" }}>{HOW_HEAD.title}</h2>
        </div>
        <div>
          {stepViews(timeline).map((step) => (
            <div key={step.en} data-reveal="1" style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 24, position: "relative", paddingBottom: step.pb }}>
              <div style={{ position: "relative" }}>
                <div data-stepdot="1" style={{ width: 44, height: 44, borderRadius: "50%", border: "1px solid #B08D4A", background: step.bg, color: step.fg, display: "grid", placeItems: "center", font: "600 18px 'Playfair Display',serif", position: "relative", zIndex: 1, transition: "background .5s ease,color .5s ease,transform .5s ease", transform: step.sc }}>{step.n}</div>
                <div style={{ position: "absolute", top: 44, bottom: -4, left: 21.5, width: 1, background: step.line, overflow: "hidden" }}>
                  <div style={{ width: "100%", height: step.fill, background: "#B08D4A" }} />
                </div>
              </div>
              <div style={{ paddingTop: 2, opacity: step.op, transition: "opacity .5s ease" }}>
                <div style={{ fontFamily: playfair, fontStyle: "italic", color: "#7A5C1E", fontSize: 16, direction: "ltr", textAlign: "right" }}>{step.en}</div>
                <h3 style={{ fontFamily: estedad, fontWeight: 700, fontSize: 21, lineHeight: 1.6, margin: "2px 0 6px", color: "#1F2E54" }}>{step.title}</h3>
                <p style={{ margin: 0, color: "#3F465C", fontSize: 16, textWrap: "pretty" }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
