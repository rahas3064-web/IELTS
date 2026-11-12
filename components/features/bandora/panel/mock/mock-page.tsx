import { useCallback, useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import Link from "@/components/link";
import { api, ApiClientError } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { formatClock, useT } from "@/src/i18n";
import { CardSkeleton } from "@/components/features/bandora/panel/ui/states";

type MockCard = { id: string; title: string; titleEn: string; sectionCount: number; locked: boolean; attempt: { id: string; status: string; overallBand: number | null } | null };
type MockList = { tier: "free" | "premium"; enabled: boolean; aiReady: boolean; quota: { limit: number; used: number; remaining: number }; mocks: MockCard[] };
type Section = { skill: string; status: string; band: number | null; rawScore: number | null; maxScore: number | null; timeLimitSec: number; deadlineAt: string | null; itemCount: number };
type Attempt = { id: string; title: string; status: string; overallBand: number | null; label: string; sections: Section[] };
type Item = {
  id: string; partNo: number; stem: { prompt: string; options?: string[] }; audioId: string | null;
  passage: { title: string; body: string } | null; answer: string; correct?: boolean | null; answerKey?: { correct?: string } | null;
};

const SKILL_KEYS: Record<string, string> = { listening: "mock.skill.listening", reading: "mock.skill.reading", writing: "mock.skill.writing", speaking: "mock.skill.speaking" };

/** `/app/mock`: full IELTS mock tests for premium; free learners see what Premium unlocks. */
export function MockPage() {
  const i18n = useT();
  const { t, n } = i18n;
  const [list, setList] = useState<MockList | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; upgrade: boolean } | null>(null);
  const timers = useRef<Record<string, number>>({});

  const fail = useCallback((caught: unknown) => {
    setError({
      text: errorText(caught, i18n),
      upgrade: caught instanceof ApiClientError && (caught.status === 402 || caught.details?.upgrade === "/app/subscription"),
    });
  }, [i18n]);

  const loadList = useCallback(() => {
    api.get<MockList>("/api/mocks").then(setList).catch(fail);
  }, [fail]);

  useEffect(loadList, [loadList]);

  useEffect(() => {
    if (!deadline) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  async function openAttempt(id: string) {
    setError(null);
    try {
      setAttempt(await api.get<Attempt>(`/api/mock-attempts/${id}`));
      setSkill(null);
    } catch (caught) {
      fail(caught);
    }
  }

  async function start(mockId: string) {
    setError(null);
    setBusy(true);
    try {
      const body = await api.post<{ attemptId: string }>(`/api/mocks/${mockId}/attempts`);
      await openAttempt(body.attemptId);
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }

  async function openSection(name: string) {
    if (!attempt) return;
    setError(null);
    try {
      const section = attempt.sections.find((s) => s.skill === name);
      if (section?.status === "not_started" || section?.status === "in_progress") {
        await api.post(`/api/mock-attempts/${attempt.id}/sections/${name}/start`);
      }
      const body = await api.get<{ items: Item[]; deadlineAt: string | null; status: string }>(`/api/mock-attempts/${attempt.id}/sections/${name}`);
      setItems(body.items);
      setValues(Object.fromEntries(body.items.map((item) => [item.id, item.answer ?? ""])));
      setDeadline(body.status === "in_progress" && body.deadlineAt ? new Date(body.deadlineAt).getTime() : null);
      setSkill(name);
      if (name === "listening" && body.status === "in_progress" && body.items.some((item) => item.audioId)) {
        await api.post(`/api/mock-attempts/${attempt.id}/listening/audio`);
      }
    } catch (caught) {
      fail(caught);
    }
  }

  function change(itemId: string, value: string, immediate: boolean) {
    if (!attempt || !skill) return;
    setValues((current) => ({ ...current, [itemId]: value }));
    window.clearTimeout(timers.current[itemId]);
    const save = () => api.put(`/api/mock-attempts/${attempt.id}/sections/${skill}/answers`, { itemId, value }).catch(fail);
    if (immediate) void save();
    else timers.current[itemId] = window.setTimeout(save, 800);
  }

  async function complete() {
    if (!attempt || !skill) return;
    setBusy(true);
    setError(null);
    try {
      // Flush pending saves so the last keystrokes are marked too.
      for (const [itemId, timer] of Object.entries(timers.current)) {
        window.clearTimeout(timer);
        await api.put(`/api/mock-attempts/${attempt.id}/sections/${skill}/answers`, { itemId, value: values[itemId] ?? "" }).catch(() => undefined);
      }
      timers.current = {};
      await api.post(`/api/mock-attempts/${attempt.id}/sections/${skill}/complete`);
      setSkill(null);
      setDeadline(null);
      await openAttempt(attempt.id);
      loadList();
    } catch (caught) {
      fail(caught);
    } finally {
      setBusy(false);
    }
  }

  if (!list && !error) return <CardSkeleton />;

  const errorBox = error ? (
    <p className="bd-error" role="alert">
      <span>{error.text}</span>
      {error.upgrade ? <Link href="/app/subscription">{t("mock.upgrade")}</Link> : null}
    </p>
  ) : null;

  if (attempt && skill) {
    const left = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : null;
    const done = attempt.sections.find((s) => s.skill === skill)?.status === "completed";
    let lastPassage = "";
    return (
      <section className="bd-card bd-stack bd-mock" aria-labelledby="mock-section-title">
        <p className="bd-kicker">{attempt.title}</p>
        <h2 id="mock-section-title" className="bd-title">{t(SKILL_KEYS[skill])}</h2>
        {left != null ? <p className={left < 300 ? "bd-error" : "bd-hint"} role="timer">{t("mock.timeLeft", { time: formatClock(left, i18n.locale) })}</p> : null}
        {left === 0 && !done ? <p className="bd-alert">{t("mock.timeUp")}</p> : null}
        {errorBox}
        {items.length === 0 ? <p className="bd-muted">{t("mock.noItems")}</p> : null}
        {items.map((item, index) => {
          const showPassage = item.passage && item.passage.body !== lastPassage;
          if (item.passage) lastPassage = item.passage.body;
          return (
            <div key={item.id} className="bd-stack">
              {showPassage && item.passage ? (
                <article className="bd-mock__passage" dir="ltr">
                  <h3>{item.passage.title}</h3>
                  <p>{item.passage.body}</p>
                </article>
              ) : null}
              <label className="bd-field">
                <span dir="auto"><span className="bd-num">{n(index + 1)}.</span> {item.stem.prompt}</span>
                {item.audioId && skill === "listening" ? (
                  <audio src={`/api/media/${item.audioId}`} controls controlsList="nodownload noplaybackrate" />
                ) : null}
                {item.stem.options ? (
                  <select className="bd-input" value={values[item.id] ?? ""} disabled={done} onChange={(event) => change(item.id, event.target.value, true)}>
                    <option value="" />
                    {item.stem.options.map((option) => <option key={option}>{option}</option>)}
                  </select>
                ) : (
                  <textarea
                    className="bd-input bd-input--ltr"
                    rows={skill === "writing" || skill === "speaking" ? 10 : 1}
                    value={values[item.id] ?? ""}
                    disabled={done}
                    onChange={(event) => change(item.id, event.target.value, false)}
                  />
                )}
                {done && item.answerKey?.correct ? (
                  <span className={item.correct ? "bd-hint" : "bd-error"}>{t("mock.key", { value: item.answerKey.correct })}</span>
                ) : null}
              </label>
            </div>
          );
        })}
        {done ? (
          <button type="button" className="bd-btn bd-btn--outline" onClick={() => setSkill(null)}>{t("mock.backToSections")}</button>
        ) : (
          <button type="button" className="bd-btn bd-btn--solid" disabled={busy} onClick={complete}>
            {busy ? t("mock.scoring") : t("mock.finishSection")}
          </button>
        )}
      </section>
    );
  }

  if (attempt) {
    return (
      <section className="bd-card bd-stack" aria-labelledby="mock-attempt-title">
        <p className="bd-kicker">{t("nav.mock")}</p>
        <h2 id="mock-attempt-title" className="bd-title">{attempt.title}</h2>
        {errorBox}
        {attempt.status === "completed" ? (
          <p className="bd-alert bd-alert--info">
            {attempt.overallBand != null ? t("mock.overall", { band: attempt.overallBand }) : t("mock.overallMissing")} {t("mock.estimate")}
          </p>
        ) : <p className="bd-sub">{t("mock.sectionsIntro")}</p>}
        <ul className="bd-mock__sections">
          {attempt.sections.map((section) => (
            <li key={section.skill}>
              <div>
                <strong>{t(SKILL_KEYS[section.skill])}</strong>
                <span className="bd-hint"> · {t("mock.minutes", { n: Math.round(section.timeLimitSec / 60) })} · {t("mock.questions", { n: section.itemCount })}</span>
                {section.status === "completed" ? (
                  <p className="bd-hint">
                    {section.band != null ? t("mock.band", { band: section.band }) : t("mock.notScored")}
                    {section.maxScore ? ` (${n(section.rawScore ?? 0)}/${n(section.maxScore)})` : ""}
                  </p>
                ) : null}
              </div>
              <button type="button" className={section.status === "completed" ? "bd-btn bd-btn--outline" : "bd-btn bd-btn--solid"} onClick={() => openSection(section.skill)}>
                {section.status === "completed" ? t("mock.review") : section.status === "in_progress" ? t("mock.continue") : t("mock.startSection")}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="bd-linkbtn" onClick={() => setAttempt(null)}>{t("mock.backToList")}</button>
      </section>
    );
  }

  const data = list!;
  return (
    <section className="bd-card bd-stack" aria-labelledby="mock-title">
      <p className="bd-kicker">{t("mock.kicker")}</p>
      <h2 id="mock-title" className="bd-title">{t("nav.mock")}</h2>
      <p className="bd-sub">{t("mock.body")}</p>
      {errorBox}
      {data && !data.enabled ? (
        <div className="bd-alert bd-alert--info bd-stack">
          <p className="bd-mock__lock"><Lock size={16} strokeWidth={1.6} aria-hidden /> <span>{t("mock.locked")}</span></p>
          <Link href="/app/subscription" className="bd-btn bd-btn--solid">{t("mock.upgrade")}</Link>
        </div>
      ) : null}
      {data && data.enabled ? <p className="bd-hint">{t("mock.quota", { remaining: data.quota.remaining, limit: data.quota.limit })}</p> : null}
      {data && data.enabled && !data.aiReady ? <p className="bd-alert">{t("mock.aiMissing")}</p> : null}
      {data && data.mocks.length === 0 ? <p className="bd-muted">{t("mock.none")}</p> : null}
      {data?.mocks.map((mock) => (
        <article key={mock.id} className="bd-mock__card">
          <div>
            <strong>{mock.title}</strong>
            <span className="bd-hint"> · {t("mock.sections", { n: mock.sectionCount })}</span>
            {mock.attempt?.status === "completed" && mock.attempt.overallBand != null ? (
              <p className="bd-hint">{t("mock.overall", { band: mock.attempt.overallBand })}</p>
            ) : null}
          </div>
          {mock.locked ? (
            <Link href="/app/subscription" className="bd-btn bd-btn--outline"><Lock size={15} strokeWidth={1.6} aria-hidden /> {t("mock.premiumOnly")}</Link>
          ) : mock.attempt ? (
            <button type="button" className="bd-btn bd-btn--outline" onClick={() => openAttempt(mock.attempt!.id)}>
              {mock.attempt.status === "completed" ? t("mock.viewResult") : t("mock.continue")}
            </button>
          ) : (
            <button type="button" className="bd-btn bd-btn--solid" disabled={busy || data.quota.remaining <= 0} onClick={() => start(mock.id)}>{t("mock.start")}</button>
          )}
        </article>
      ))}
    </section>
  );
}
