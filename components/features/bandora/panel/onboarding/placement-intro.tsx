import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Link from "@/components/link";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useAuth } from "@/src/auth/auth-provider";
import type { Me } from "@/src/auth/types";
import { useT } from "@/src/i18n";
import { BdIcon, type BdIconName } from "@/components/features/bandora/panel/icons/bd-icon";
import { IntakeBar } from "@/components/features/bandora/panel/onboarding/progress-dots";
import { PLACEMENT_TIMES, placementStep, type PlacementMode } from "@/components/features/bandora/panel/onboarding/onboarding-rules";

const SKILLS: readonly { id: keyof typeof PLACEMENT_TIMES.full; icon: BdIconName; label: string }[] = [
  { id: "listening", icon: "skill-listening", label: "placementIntro.skill.listening" },
  { id: "reading", icon: "skill-reading", label: "placementIntro.skill.reading" },
  { id: "writing", icon: "skill-writing", label: "placementIntro.skill.writing" },
  { id: "speaking", icon: "skill-speaking", label: "placementIntro.skill.speaking" },
];

/** `/app/placement/intro`: skill order and Bandora times, then the existing placement route. */
export function PlacementIntro() {
  const i18n = useT();
  const { t, digits } = i18n;
  const { me, setMe } = useAuth();
  const navigate = useNavigate();
  const saved = me?.profile?.placementMode ?? null;
  const [mode, setMode] = useState<PlacementMode | null>(saved);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chosen = saved ?? mode;
  const times = chosen ? PLACEMENT_TIMES[chosen] : null;
  const exam = me?.profile?.examType === "general" ? t("onboarding.exam.general") : t("onboarding.exam.academic");
  const target = me?.profile?.targetBand;

  async function start() {
    if (!chosen || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (saved !== chosen) setMe(await api.put<Me>("/api/onboarding", placementStep(chosen)));
      navigate(`/app/placement?mode=${chosen}`);
    } catch (failure) {
      setError(errorText(failure, i18n));
      setBusy(false);
    }
  }

  return (
    <main className="bd-intake">
      <IntakeBar title={t("placementIntro.title")} onBack={() => navigate("/app")} />
      <p className="bd-intake__lead">{t("placementIntro.lead", { n: times?.total ?? PLACEMENT_TIMES.full.total })}</p>
      <div className="bd-tags">
        <span className="bd-tag">{exam}</span>
        {target != null ? <span className="bd-tag">{t("placementIntro.tag.target", { n: digits(target.toFixed(1)) })}</span> : null}
        {chosen ? <span className="bd-tag">{t(chosen === "quick" ? "onboarding.mode.quick" : "onboarding.mode.full")}</span> : null}
      </div>
      {saved ? null : (
        <section className="bd-card bd-intake__card">
          <div className="bd-choices">
            {(["quick", "full"] as const).map((option) => (
              <label key={option} className="bd-choice">
                <input type="radio" name="intro-mode" className="bd-sr" checked={mode === option} onChange={() => setMode(option)} />
                <span className="bd-choice__title">{t(option === "quick" ? "onboarding.mode.quick" : "onboarding.mode.full")}</span>
                <span className="bd-choice__body">{t(option === "quick" ? "onboarding.mode.quickBody" : "onboarding.mode.fullBody", { n: PLACEMENT_TIMES[option].total })}</span>
              </label>
            ))}
          </div>
        </section>
      )}
      {times ? (
        <ol className="bd-skills">
          {SKILLS.map((skill) => (
            <li key={skill.id} className="bd-skill">
              <BdIcon name={skill.icon} size={22} />
              <span>{t(skill.label)}</span>
              <b>{t("placementIntro.minutes", { n: times[skill.id] })}</b>
            </li>
          ))}
        </ol>
      ) : null}
      <p className="bd-intake__lead">{t("placementIntro.estimate")}</p>
      <p className="bd-intake__lead">{t("placementIntro.headphones")}</p>
      {error ? <p className="bd-alert" role="alert">{error}</p> : null}
      <button type="button" className="bd-btn bd-btn--solid bd-btn--block" disabled={!chosen || busy} onClick={() => void start()}>
        {busy ? t("common.saving") : t("placementIntro.start")}
      </button>
      <Link href="/app" className="bd-intake__skip">{t("onboarding.skip")}</Link>
    </main>
  );
}
