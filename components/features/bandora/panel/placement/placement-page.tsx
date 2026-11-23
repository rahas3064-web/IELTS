import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Link from "@/components/link";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { formatClock, useT } from "@/src/i18n";
import { BdIcon } from "@/components/features/bandora/panel/icons/bd-icon";
import { useRecorder } from "@/components/features/bandora/panel/speaking/use-recorder";

type SkillName = "listening" | "reading" | "writing" | "speaking";
type Mode = "quick" | "full";
type Skill = {
  skill: SkillName;
  status: string;
  timeLimitSec: number;
  deadlineAt: string | null;
  audioStarted: boolean;
};
type Stem = { prompt?: string; promptEn?: string; script?: string; passage?: string; options?: string[]; cue?: string };
type Item = { id: string; stem: Stem; audioId: string | null; savedValue?: string };

const ORDER: SkillName[] = ["listening", "reading", "writing", "speaking"];
const WAVE = [8, 16, 22, 12, 26, 14, 20, 10, 18, 24, 12, 8];

function wordsIn(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function PlayOnce({
  src,
  script,
  locked,
  onPlay,
}: {
  src: string | null;
  script?: string;
  locked: boolean;
  onPlay: () => void;
}) {
  const { t } = useT();
  const audio = useRef<HTMLAudioElement>(null);
  const [open, setOpen] = useState(false);
  function play() {
    if (locked || open) return;
    setOpen(true);
    onPlay();
    void audio.current?.play().catch(() => undefined);
  }
  return (
    <div className="bd-player">
      <div className="bd-wave" aria-hidden="true">
        {WAVE.map((height, index) => <i key={index} style={{ height }} />)}
      </div>
      {src ? <audio ref={audio} src={src} preload="auto" /> : null}
      {open && !src && script ? <p className="bd-test__en">{script}</p> : null}
      <button type="button" className="bd-btn bd-btn--solid bd-btn--block" disabled={locked || open} onClick={play}>
        <BdIcon name="play-once" size={22} />
        {locked || open ? t("placement.played") : t("placement.playOnce")}
      </button>
    </div>
  );
}

function SpeakBox({
  mode,
  cue,
  onRecorded,
}: {
  mode: Mode | null;
  cue?: string;
  onRecorded: () => void;
}) {
  const { t, n } = useT();
  const full = mode !== "quick";
  const [prep, setPrep] = useState(full ? 60 : 0);
  const recorder = useRecorder(full ? 2 : 1);
  const sent = useRef(false);
  useEffect(() => {
    if (prep <= 0) return undefined;
    const id = window.setTimeout(() => setPrep((left) => left - 1), 1000);
    return () => window.clearTimeout(id);
  }, [prep]);
  useEffect(() => {
    if (recorder.phase === "ready" && !sent.current) {
      sent.current = true;
      onRecorded();
    }
  }, [recorder.phase, onRecorded]);
  return (
    <div className="bd-stack">
      {full && cue ? <p className="bd-cue">{cue}</p> : null}
      <p className="bd-test__meta">{full ? (prep > 0 ? t("placement.cuePrep") : t("placement.cueTalk")) : t("placement.quickSpeak")}</p>
      {prep > 0 ? <p className="bd-test__clock">{n(prep)}</p> : null}
      {prep === 0 ? (
        <button type="button" className="bd-btn bd-btn--solid bd-mic" onClick={() => void (recorder.phase === "recording" ? recorder.stop() : recorder.start())}>
          <BdIcon name="mic" size={22} />
        </button>
      ) : null}
    </div>
  );
}

/** `/app/placement`: one skill at a time, Quick or Full clocks, play-once listening. */
export function PlacementPage() {
  const i18n = useT();
  const { t, digits } = i18n;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const requested = params.get("mode") === "quick" || params.get("mode") === "full" ? params.get("mode") as Mode : null;
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(requested);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [active, setActive] = useState<SkillName | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [played, setPlayed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const booted = useRef(false);

  async function refresh(id: string) {
    const body = await api.get<{ skills: Skill[]; mode: Mode | null }>(`/api/placement/attempts/${id}`);
    setSkills(body.skills);
    if (body.mode) setMode(body.mode);
    return body.skills;
  }

  async function openSkill(id: string, skill: SkillName, known?: Skill) {
    const started = await api.post<{ deadlineAt: string }>(`/api/placement/attempts/${id}/skills/${skill}/start`);
    const body = await api.get<{ items: Item[] }>(`/api/placement/attempts/${id}/skills/${skill}`);
    setActive(skill);
    setItems(body.items);
    setPlayed(Boolean(known?.audioStarted));
    setValues(Object.fromEntries(body.items.map((item) => [item.id, item.savedValue ?? ""])));
    setDeadline(new Date(known?.deadlineAt ?? started.deadlineAt).getTime());
  }

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    void (async () => {
      try {
        const current = await api.get<{ attempt: { id: string } | null }>("/api/placement/current");
        const created = current.attempt
          ? { attemptId: current.attempt.id }
          : await api.post<{ attemptId: string }>("/api/placement/attempts", requested ? { mode: requested } : {});
        setAttemptId(created.attemptId);
        const rows = await refresh(created.attemptId);
        const open = rows.find((row) => row.status === "in_progress");
        const next = open ?? rows.find((row) => row.status !== "completed");
        if (next) await openSkill(created.attemptId, next.skill, next.status === "in_progress" ? next : undefined);
      } catch (caught) {
        setError(errorText(caught, i18n));
      }
    })();
  }, [i18n, requested]);

  useEffect(() => {
    if (!deadline) return undefined;
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  async function save(itemId: string, value: string) {
    if (!attemptId || !active) return;
    setValues((current) => ({ ...current, [itemId]: value }));
    await api.put(`/api/placement/attempts/${attemptId}/skills/${active}/answers`, { itemId, value });
  }

  async function playAudio() {
    if (!attemptId || played) return;
    setPlayed(true);
    await api.post(`/api/placement/attempts/${attemptId}/listening/audio`);
  }

  async function complete() {
    if (!attemptId || !active) return;
    setError(null);
    try {
      await api.post(`/api/placement/attempts/${attemptId}/skills/${active}/complete`);
      const rows = await refresh(attemptId);
      const next = ORDER.map((skill) => rows.find((row) => row.skill === skill)).find((row) => row && row.status !== "completed");
      if (!next) {
        setActive(null);
        setItems([]);
        return;
      }
      await openSkill(attemptId, next.skill);
    } catch (caught) {
      setError(errorText(caught, i18n));
    }
  }

  const index = Math.max(0, ORDER.indexOf(active ?? "listening"));
  const done = skills.filter((row) => row.status === "completed").length;
  const clip = items.find((row) => row.audioId) ?? items[0];

  return (
    <section className="bd-test">
      <header className="bd-test__bar">
        <button type="button" className="bd-test__close" aria-label={t("placement.close")} onClick={() => navigate("/app")}>
          <BdIcon name="close" />
        </button>
        <h1 className="bd-test__skill">{active ? t(`placement.skill.${active}`) : t("placementIntro.title")}</h1>
        <p className="bd-test__clock">{formatClock(left, i18n.locale)}</p>
      </header>
      <div className="bd-test__track" role="progressbar" aria-valuemin={0} aria-valuemax={ORDER.length} aria-valuenow={done}>
        <div className="bd-test__fill" style={{ width: `${((done + (active ? 1 : 0)) / ORDER.length) * 100}%` }} />
      </div>
      <p className="bd-test__meta">{t("placement.progress", { n: index + 1, total: ORDER.length })}</p>
      {error ? <p className="bd-error" role="alert">{error}</p> : null}
      {active === "listening" && items.length ? (
        <article className="bd-card bd-test__card">
          <PlayOnce src={clip?.audioId ? `/api/media/${clip.audioId}` : null} script={items.find((row) => row.stem.script)?.stem.script} locked={played} onPlay={() => void playAudio()} />
        </article>
      ) : null}
      {items.map((item) => (
        <article key={item.id} className="bd-card bd-test__card">
          {item.stem.passage ? <p>{item.stem.passage}</p> : null}
          {item.stem.promptEn ? <p className="bd-test__en" dir="ltr">{item.stem.promptEn}</p> : item.stem.prompt ? <p>{item.stem.prompt}</p> : null}
          {active === "writing" ? <p className="bd-test__meta">{mode === "quick" ? t("placement.writingQuick") : t("placement.writingFull")}</p> : null}
          {item.stem.options ? (
            <div className="bd-choices">
              {item.stem.options.map((option) => (
                <label key={option} className="bd-choice">
                  <input type="radio" className="bd-sr" name={item.id} checked={values[item.id] === option} onChange={() => void save(item.id, option)} />
                  <span className="bd-choice__title" dir="ltr">{option}</span>
                </label>
              ))}
            </div>
          ) : null}
          {active === "writing" ? (
            <>
              <textarea className="bd-input" dir="ltr" value={values[item.id] ?? ""} onChange={(event) => void save(item.id, event.target.value)} />
              <p className="bd-test__meta">{t("placement.words", { n: digits(wordsIn(values[item.id] ?? "")) })}</p>
            </>
          ) : null}
          {active === "speaking" ? <SpeakBox mode={mode} cue={item.stem.cue} onRecorded={() => void save(item.id, "recorded")} /> : null}
        </article>
      ))}
      {!active && attemptId ? <Link href="/app/placement/result" className="bd-btn bd-btn--solid bd-btn--block">{t("placement.seeResult")}</Link> : null}
      {active ? (
        <button type="button" className="bd-btn bd-btn--solid bd-btn--block" onClick={() => void complete()}>
          {t("placement.finishSkill")}
        </button>
      ) : null}
    </section>
  );
}
