import { AI_FEEDBACK, CHECK_PATH, CTA, HERO, SKILLS, TASKS } from "@/components/features/bandora/content";
import { SignupLink, estedad, playfair } from "@/components/features/bandora/bits";

export function BandoraHero() {
  return (
    <section id="top" data-screen-label="02 Hero" style={{ padding: "88px 24px 96px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: 64, alignItems: "center" }}>
        <div data-reveal="1">
          <div style={{ fontFamily: playfair, fontStyle: "italic", color: "#7A5C1E", fontSize: 17, letterSpacing: ".04em", marginBottom: 20, direction: "ltr", textAlign: "right" }}>{HERO.kicker}</div>
          <h1 style={{ fontFamily: estedad, fontWeight: 800, fontSize: "clamp(34px,4.6vw,56px)", lineHeight: 1.4, margin: "0 0 24px", color: "#1F2E54", textWrap: "balance" }}>{HERO.title}</h1>
          <p style={{ margin: "0 0 36px", maxWidth: 520, color: "#3F465C", textWrap: "pretty" }}>{HERO.body}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <SignupLink className="bd-solid-lift" style={{ borderRadius: 4, padding: "13px 30px" }}>شروع رایگان</SignupLink>
            <a href={CTA.philosophy} className="bd-outline-lift" style={{ borderRadius: 4, padding: "13px 28px" }}>بیشتر با Bandora آشنا شو</a>
          </div>
        </div>
        <div data-reveal="1" style={{ direction: "ltr", border: "1px solid #CBBF9F", borderRadius: 8, background: "#FBF8F1", overflow: "hidden", boxShadow: "0 18px 50px -28px rgba(31,46,84,.35)", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 14px", borderBottom: "1px solid #E1D8C2", background: "#EFE8D8" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#CBBF9F" }} />
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#CBBF9F" }} />
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#CBBF9F" }} />
            <div style={{ marginLeft: 14, flex: 1, maxWidth: 260, height: 22, border: "1px solid #E1D8C2", borderRadius: 4, background: "#FBF8F1", font: "11px/20px 'Playfair Display',serif", color: "#7C7664", padding: "0 10px" }}>bandora / dashboard</div>
          </div>
          <div style={{ padding: 18, display: "grid", gap: 14, fontSize: 13, lineHeight: 1.5, textAlign: "left" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              <LevelCard />
              <PlanCard />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 14 }}>
              <SkillsCard />
              <FeedbackCard />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LevelCard() {
  return (
    <div style={{ border: "1px solid #E1D8C2", borderRadius: 6, padding: 14, background: "#FBF8F1" }}>
      <div style={{ font: "italic 12px 'Playfair Display',serif", color: "#7A5C1E" }}>Your Level</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
        <div>
          <div style={{ font: "500 11px 'Vazirmatn'", color: "#6B6757" }}>Current Level</div>
          <div style={{ font: "600 30px/1.1 'Playfair Display',serif", color: "#1F2E54" }}>B1</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ font: "500 11px 'Vazirmatn'", color: "#6B6757" }}>Target Band</div>
          <div style={{ font: "600 30px/1.1 'Playfair Display',serif", color: "#7A5C1E" }}>7.0</div>
        </div>
      </div>
      <div style={{ marginTop: 12, height: 5, background: "#E7DFCD", borderRadius: 3 }}>
        <div style={{ width: "46%", height: "100%", background: "#1F2E54", borderRadius: 3 }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#6B6757" }}>Band 5.0 → 7.0</div>
    </div>
  );
}

function PlanCard() {
  return (
    <div style={{ border: "1px solid #E1D8C2", borderRadius: 6, padding: 14, background: "#FBF8F1" }}>
      <div style={{ font: "italic 12px 'Playfair Display',serif", color: "#7A5C1E", marginBottom: 8 }}>Today's Study Plan</div>
      {TASKS.map((task) => (
        <div key={task.label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", borderTop: "1px solid #EFE8D8" }}>
          <span style={{ width: 17, height: 17, borderRadius: "50%", display: "grid", placeItems: "center", flex: "none", border: `1px solid ${task.bc}`, background: task.bg, color: "#fff" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" style={{ width: 10, height: 10, fill: "none", stroke: task.ic, strokeWidth: 3.2, strokeLinecap: "round", strokeLinejoin: "round" }}>
              <path d={CHECK_PATH} />
            </svg>
          </span>
          <span style={{ fontSize: 12, color: task.fg, textDecoration: task.td }}>{task.label}</span>
        </div>
      ))}
    </div>
  );
}

function SkillsCard() {
  return (
    <div style={{ border: "1px solid #E1D8C2", borderRadius: 6, padding: 14, background: "#FBF8F1" }}>
      <div style={{ font: "italic 12px 'Playfair Display',serif", color: "#7A5C1E", marginBottom: 10 }}>Skills Progress</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10 }}>
        {SKILLS.map((skill) => (
          <div key={skill.name} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <svg width="46" height="46" viewBox="0 0 52 52" style={{ width: 46, height: 46, flex: "none" }}>
              <circle cx="26" cy="26" r="22" style={{ fill: "none", stroke: "#E7DFCD", strokeWidth: 4 }} />
              <circle cx="26" cy="26" r="22" style={{ fill: "none", stroke: "#4E7B62", strokeWidth: 4, strokeLinecap: "round", strokeDasharray: skill.dash, transform: "rotate(-90deg)", transformOrigin: "center" }} />
              <text x="26" y="30" style={{ textAnchor: "middle", font: "600 12px 'Playfair Display',serif", fill: "#1F2E54" }}>{skill.band}</text>
            </svg>
            <span style={{ fontSize: 11, lineHeight: 1.3, color: "#3F465C" }}>{skill.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackCard() {
  return (
    <div style={{ border: "1px solid #CBBF9F", borderRadius: 6, padding: 14, background: "#F3EBD8" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, font: "italic 12px 'Playfair Display',serif", color: "#7A5C1E" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5" />
        </svg>
        AI Feedback
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "#2B3248", direction: "rtl", textAlign: "right" }}>{AI_FEEDBACK}</div>
    </div>
  );
}
