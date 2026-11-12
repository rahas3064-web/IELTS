import { useEffect, useState } from "react";
import Link from "@/components/link";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useT } from "@/src/i18n";

type Skill = { skill: string; status: string; band: number | null; timeLimitSec: number; audioStarted: boolean };
type Item = { id: string; stem: { prompt: string; options?: string[] }; audioId: string | null };

const ORDER = ["listening", "reading", "writing", "speaking"];

/** `/app/placement`: published placement only, one skill at a time. */
export function PlacementPage() {
  const i18n = useT();
  const { t } = i18n;
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh(id: string) {
    const body = await api.get<{ skills: Skill[]; overallBand: number | null; label: string | null }>(`/api/placement/attempts/${id}`);
    setSkills(body.skills);
    if (body.overallBand != null) setMessage(`${t("placement.estimate")}: ${body.overallBand}. ${body.label ?? ""}`);
  }

  async function begin() {
    setError(null);
    try {
      const body = await api.post<{ attemptId: string }>("/api/placement/attempts");
      setAttemptId(body.attemptId);
      await refresh(body.attemptId);
    } catch (caught) {
      setError(errorText(caught, i18n));
    }
  }

  useEffect(() => {
    api.get<{ attempt: { id: string } | null }>("/api/placement/current")
      .then(async (body) => {
        if (!body.attempt) return;
        setAttemptId(body.attempt.id);
        await refresh(body.attempt.id);
      })
      .catch((caught) => setError(errorText(caught, i18n)));
  }, [i18n]);

  async function startSkill(skill: string) {
    if (!attemptId) return;
    setError(null);
    try {
      await api.post(`/api/placement/attempts/${attemptId}/skills/${skill}/start`);
      const body = await api.get<{ items: Item[] }>(`/api/placement/attempts/${attemptId}/skills/${skill}`);
      setActive(skill);
      setItems(body.items);
      if (skill === "listening") await api.post(`/api/placement/attempts/${attemptId}/listening/audio`);
    } catch (caught) {
      setError(errorText(caught, i18n));
    }
  }

  async function save(itemId: string, value: string) {
    if (!attemptId || !active) return;
    setValues({ ...values, [itemId]: value });
    await api.put(`/api/placement/attempts/${attemptId}/skills/${active}/answers`, { itemId, value });
  }

  async function complete() {
    if (!attemptId || !active) return;
    setError(null);
    try {
      const body = await api.post<{ band: number | null }>(`/api/placement/attempts/${attemptId}/skills/${active}/complete`);
      setItems([]);
      setActive(null);
      if (body.band == null) setMessage(t("practice.noScore"));
      await refresh(attemptId);
    } catch (caught) {
      setError(errorText(caught, i18n));
    }
  }

  const next = ORDER.find((skill) => skills.find((row) => row.skill === skill)?.status !== "completed");

  return (
    <section className="bd-card bd-stack">
      <h2 className="bd-title">{t("nav.placement")}</h2>
      <p className="bd-sub">{t("placement.note")}</p>
      {error ? <p className="bd-error" role="alert">{error}</p> : null}
      {message ? <p>{message}</p> : null}
      {!attemptId ? <button type="button" className="bd-btn bd-btn--solid" onClick={begin}>{t("placement.start")}</button> : null}
      {attemptId && !active && next ? (
        <button type="button" className="bd-btn bd-btn--solid" onClick={() => startSkill(next)}>{t("placement.next", { skill: next })}</button>
      ) : null}
      {items.map((item) => (
        <label key={item.id} className="bd-field">
          <span>{item.stem.prompt}</span>
          {item.audioId && active === "listening" ? (
            <audio src={`/api/media/${item.audioId}`} controls controlsList="nodownload noplaybackrate" />
          ) : null}
          {item.stem.options ? (
            <select className="bd-input" value={values[item.id] ?? ""} onChange={(event) => save(item.id, event.target.value)}>
              <option value="" />
              {item.stem.options.map((option) => <option key={option}>{option}</option>)}
            </select>
          ) : (
            <textarea className="bd-input" value={values[item.id] ?? ""} onChange={(event) => save(item.id, event.target.value)} />
          )}
        </label>
      ))}
      {active ? <button type="button" className="bd-btn bd-btn--solid" onClick={complete}>{t("placement.finishSkill")}</button> : null}
      <Link href="/app/placement/intro" className="bd-linkbtn">{t("section.back")}</Link>
    </section>
  );
}
