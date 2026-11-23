import { useEffect, useState } from "react";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useT } from "@/src/i18n";

type SkillName = "listening" | "reading" | "writing" | "speaking";
type Plan = {
  chapterFrom: number | null;
  chapterTo: number | null;
  lessons: number;
  minuteMin: number;
  minuteMax: number;
  days: number;
  activeDays: number[];
  priority: SkillName[];
};

/** `/app/plan`: reads the saved plan. It does not write one. */
export function PlanPage() {
  const i18n = useT();
  const { t, digits } = i18n;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.get<{ plan: Plan | null }>("/api/plan").then((body) => setPlan(body.plan)).catch((caught) => setError(errorText(caught, i18n))).finally(() => setReady(true));
  }, [i18n]);

  const band = (value: number | null) => (value == null ? "" : digits(value.toFixed(1)));
  return (
    <section className="bd-planpage">
      <h1>{t("nav.plan")}</h1>
      <p className="bd-planpage__lead">{t("plan.lead")}</p>
      {error ? <p className="bd-error" role="alert">{error}</p> : null}
      {ready && !plan ? <p className="bd-test__meta">{t("plan.empty")}</p> : null}
      {plan ? (
        <>
          <article className="bd-card bd-planpage__chapter">
            {plan.chapterFrom == null || plan.chapterTo == null
              ? t("plan.chapterOpen")
              : t("plan.chapter", { from: band(plan.chapterFrom), to: band(plan.chapterTo) })}
          </article>
          <div className="bd-planpage__stats">
            <p><strong>{digits(plan.lessons)}</strong><span>{t("plan.lessons")}</span></p>
            <p><strong>{digits(plan.minuteMin)}–{digits(plan.minuteMax)}</strong><span>{t("plan.minutes")}</span></p>
            <p><strong>{digits(plan.days)}</strong><span>{t("plan.days")}</span></p>
          </div>
          <ol className="bd-planpage__week">
            {[0, 1, 2, 3, 4, 5, 6].map((day) => (
              <li key={day} data-on={plan.activeDays.includes(day) ? "true" : "false"}>{t(`plan.day.${day}`)}</li>
            ))}
          </ol>
          <ol className="bd-planpage__priority">
            {plan.priority.map((skill) => <li key={skill}>{t(`placement.skill.${skill}`)}</li>)}
          </ol>
        </>
      ) : null}
      <p className="bd-planpage__mock">{t("plan.mock")}</p>
    </section>
  );
}
