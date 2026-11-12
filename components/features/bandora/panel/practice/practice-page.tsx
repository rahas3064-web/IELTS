import { useEffect, useState } from "react";
import Link from "@/components/link";
import { api, ApiClientError } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useT } from "@/src/i18n";

type SetCard = { id: string; skill: string; title: string; partNo: number | null; isFree: boolean; locked: boolean; estMinutes: number };
type Item = { id: string; stem: { prompt: string; options?: string[] } };

/** `/app/practice`: published sets only. Paid sets stay locked. */
export function PracticePage() {
  const i18n = useT();
  const { t } = i18n;
  const [sets, setSets] = useState<SetCard[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [maxPart, setMaxPart] = useState<number | null>(null);

  function fail(caught: unknown) {
    setError(errorText(caught, i18n));
    setUpgrade(caught instanceof ApiClientError && (caught.status === 402 || caught.details?.upgrade === "/app/subscription"));
  }

  useEffect(() => {
    api.get<{ sets: SetCard[]; maxPart: number | null }>("/api/practice/sets")
      .then((body) => {
        setSets(body.sets);
        setMaxPart(body.maxPart ?? null);
      })
      .catch((caught) => setError(errorText(caught, i18n)));
  }, [i18n]);

  async function start(id: string) {
    setError(null);
    setUpgrade(false);
    setResult(null);
    try {
      const body = await api.post<{ attemptId: string; items?: Item[] }>(`/api/practice/sets/${id}/attempts`);
      setAttemptId(body.attemptId);
      setItems(body.items ?? []);
    } catch (caught) {
      fail(caught);
    }
  }

  async function submit() {
    if (!attemptId || !items) return;
    setError(null);
    setUpgrade(false);
    try {
      const body = await api.post<{ status: string; band: number | null; raw: number | null; max: number | null; label: string | null }>(
        `/api/practice/attempts/${attemptId}/submit`,
        { answers: items.map((item) => ({ itemId: item.id, value: values[item.id] ?? "" })) },
      );
      if (body.status !== "scored" || body.band == null) setResult(t("practice.noScore"));
      else setResult(`${t("practice.estimate")}: ${body.band}${body.raw != null ? ` (${body.raw}/${body.max})` : ""}. ${body.label ?? ""}`);
    } catch (caught) {
      fail(caught);
    }
  }

  return (
    <section className="bd-card bd-stack">
      <h2 className="bd-title">{t("nav.practice")}</h2>
      {maxPart != null ? (
        <p className="bd-alert bd-alert--info">
          {t("practice.freeNote", { n: maxPart })}{" "}
          <Link href="/app/subscription">{t("practice.upgrade")}</Link>
        </p>
      ) : null}
      {error ? (
        <p className="bd-error" role="alert">
          <span>{error}</span>
          {upgrade ? <Link href="/app/subscription">{t("practice.upgrade")}</Link> : null}
        </p>
      ) : null}
      {result ? <p>{result}</p> : null}
      {!items ? (sets ?? []).map((set) => (
        <article key={set.id} className="bd-stack">
          <p>{set.title}{set.partNo ? ` · ${t("practice.part", { n: set.partNo })}` : ""}</p>
          {set.locked ? <p className="bd-hint">{t("practice.locked")}</p> : null}
          {set.locked ? (
            <Link href="/app/subscription" className="bd-btn bd-btn--outline">{t("practice.upgrade")}</Link>
          ) : (
            <button type="button" className="bd-btn bd-btn--solid" onClick={() => start(set.id)}>{t("practice.start")}</button>
          )}
        </article>
      )) : null}
      {items?.map((item) => (
        <label key={item.id} className="bd-field">
          <span>{item.stem.prompt}</span>
          {item.stem.options ? (
            <select className="bd-input" value={values[item.id] ?? ""} onChange={(event) => setValues({ ...values, [item.id]: event.target.value })}>
              <option value="" />
              {item.stem.options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : (
            <textarea className="bd-input" value={values[item.id] ?? ""} onChange={(event) => setValues({ ...values, [item.id]: event.target.value })} />
          )}
        </label>
      ))}
      {items ? <button type="button" className="bd-btn bd-btn--solid" onClick={submit}>{t("practice.submit")}</button> : null}
    </section>
  );
}
