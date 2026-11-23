import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Link from "@/components/link";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useT } from "@/src/i18n";

type SkillName = "listening" | "reading" | "writing" | "speaking";
type Result = {
  overall: number | null;
  target: number | null;
  gap: number | null;
  examDate: string | null;
  daysLeft: number | null;
  skills: { skill: SkillName; band: number | null; note: "strength" | "weak" | "steady" | "missing" }[];
};

function bandText(band: number | null, digits: (value: string | number) => string) {
  return band == null ? "—" : digits(band.toFixed(1));
}

/** `/app/placement/result`: estimate only. Opening this page does not write the plan. */
export function PlacementResultPage() {
  const i18n = useT();
  const { t, digits, locale } = i18n;
  const navigate = useNavigate();
  const [result, setResult] = useState<Result | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void api.get<Result>("/api/placement/result").then(setResult).catch((caught) => {
      if (caught && typeof caught === "object" && "status" in caught && caught.status === 404) setMissing(true);
      else setError(errorText(caught, i18n));
    });
  }, [i18n]);

  async function updatePlan() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/placement/plan");
      navigate("/app/plan");
    } catch (caught) {
      setError(errorText(caught, i18n));
    } finally {
      setBusy(false);
    }
  }

  if (missing) return <p className="bd-test__meta">{t("result.empty")}</p>;
  if (!result) return error ? <p className="bd-error" role="alert">{error}</p> : null;

  const rest = result.gap == null || result.target == null
    ? t("result.gapUnknown")
    : result.gap <= 0
      ? t("result.gapMet")
      : result.gap === 1
        ? t("result.gapOne")
        : result.gap === 0.5
          ? t("result.gapHalf")
          : t("result.gapMore", { n: digits(result.gap.toFixed(1)) });
  const when = result.examDate
    ? new Intl.DateTimeFormat(locale === "fa" ? "fa-IR-u-ca-persian" : "en-GB", { timeZone: "Asia/Tehran", dateStyle: "medium" }).format(new Date(`${result.examDate}T12:00:00+03:30`))
    : t("result.dateUnknown");
  const left = result.daysLeft == null ? "" : result.daysLeft < 0 ? t("result.daysPast") : t("result.days", { n: digits(result.daysLeft) });
  const named = (note: Result["skills"][number]["note"]) => result.skills.filter((row) => row.note === note);

  return (
    <section className="bd-result">
      <p className="bd-result__badge">{t("result.badge")}</p>
      <p className="bd-result__overall">{bandText(result.overall, digits)}</p>
      <ul className="bd-result__skills">
        {result.skills.map((row) => (
          <li key={row.skill}>
            <span className="bd-result__name">{t(`placement.skill.${row.skill}`)} <span className="bd-result__en">{t(`result.skill.${row.skill}`)}</span></span>
            <span className="bd-result__band">{bandText(row.band, digits)}</span>
            <span className="bd-result__track"><i style={{ width: `${((row.band ?? 0) / 9) * 100}%` }} /></span>
            <span className="bd-result__note">{t(`result.note.${row.note}`)}</span>
          </li>
        ))}
      </ul>
      <p className="bd-result__gap">{result.target == null ? rest : t("result.gap", { target: digits(result.target.toFixed(1)), rest })}</p>
      <p className="bd-test__meta">{when}{left ? ` · ${left}` : ""}</p>
      <p className="bd-test__meta">{t("result.strengths")}: {named("strength").map((row) => t(`placement.skill.${row.skill}`)).join("، ") || "—"}</p>
      <p className="bd-test__meta">{t("result.weaknesses")}: {named("weak").map((row) => t(`placement.skill.${row.skill}`)).join("، ") || "—"}</p>
      <p className="bd-test__meta">{t("result.notes")}: {t("placement.skill.writing")} {bandText(result.skills.find((row) => row.skill === "writing")?.band ?? null, digits)} · {t("placement.skill.speaking")} {bandText(result.skills.find((row) => row.skill === "speaking")?.band ?? null, digits)}</p>
      {error ? <p className="bd-error" role="alert">{error}</p> : null}
      <button type="button" className="bd-btn bd-btn--solid bd-btn--block" disabled={busy} onClick={() => void updatePlan()}>{t("result.update")}</button>
      <Link href="/app" className="bd-btn bd-btn--outline bd-btn--block">{t("result.later")}</Link>
    </section>
  );
}
