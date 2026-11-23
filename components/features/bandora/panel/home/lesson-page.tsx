import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Link from "@/components/link";
import { BdIcon } from "@/components/features/bandora/panel/icons/bd-icon";
import { countWords } from "@/components/features/bandora/panel/assistant/assistant-model";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useT } from "@/src/i18n";
import { CardSkeleton } from "@/components/features/bandora/panel/ui/states";

const STAGES = ["learn", "practice", "apply", "review"] as const;
type Stage = (typeof STAGES)[number];
type Lesson = {
  skill: string;
  titleFa: string;
  minuteMin: number;
  minuteMax: number;
  stage: Stage;
  practice: "topic" | "example" | null;
  applyText: string;
  words: number;
  estimate: "short" | "in_range" | "long";
  result: "correct" | "almost" | null;
  answer: "topic" | "example" | null;
  example: { topic: string; support: string; example: string };
  choices: { id: "topic" | "example"; text: string }[];
  applyMin: number;
  applyMax: number;
};

function CreamTick() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
      <path d="M2.2 6.2 4.7 8.6 9.8 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Four-stage lesson. The done screen after review is only a stub. */
export function LessonStubPage() {
  const { nodeId = "" } = useParams();
  const navigate = useNavigate();
  const i18n = useT();
  const { t, digits } = i18n;
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    api.get<Lesson>(`/api/lessons/${nodeId}`).then((body) => {
      if (!live) return;
      setLesson(body);
      setDraft(body.applyText);
    }).catch((caught) => { if (live) setError(errorText(caught, i18n)); });
    return () => { live = false; };
  }, [nodeId]);

  if (error && !lesson) {
    return (
      <section className="bd-card bd-stack">
        <p className="bd-error" role="alert">{error}</p>
        <Link href="/app" className="bd-btn bd-btn--outline">{t("sheet.back")}</Link>
      </section>
    );
  }
  if (!lesson) return <CardSkeleton />;

  const index = STAGES.indexOf(lesson.stage);
  const words = countWords(draft);
  const estimate = words < lesson.applyMin ? "short" : words > lesson.applyMax ? "long" : "in_range";
  const started = lesson.stage !== "learn" || Boolean(lesson.practice) || draft.trim().length > 0;

  async function save(next: Pick<Lesson, "stage" | "practice" | "applyText">) {
    setBusy(true);
    setError(null);
    try {
      const body = await api.put<Lesson>(`/api/lessons/${nodeId}`, next);
      setLesson(body);
      setDraft(body.applyText);
    } catch (caught) {
      setError(errorText(caught, i18n));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (started) setLeave(true);
    else navigate("/app");
  }

  return (
    <article className="bd-lesson">
      <header className="bd-lesson__bar">
        <button type="button" className="bd-lesson__close" aria-label={t("lesson.close")} onClick={close}>
          <BdIcon name="close" size={18} />
        </button>
        <ol className="bd-steps">
          {STAGES.map((stage, step) => {
            const state = step < index ? "done" : step === index ? "current" : "upcoming";
            return (
              <li key={stage} data-state={state} data-prev={step > 0 && step - 1 < index ? "done" : undefined}>
                <span className="bd-steps__dot">{state === "done" ? <CreamTick /> : digits(step + 1)}</span>
                <span className="bd-steps__label">{t(`lesson.stage.${stage}`)}</span>
              </li>
            );
          })}
        </ol>
      </header>
      <section className="bd-card bd-lesson__card">
        <p className="bd-lesson__skill">{t(`placement.skill.${lesson.skill}`)}</p>
        <h1>{lesson.titleFa}</h1>
        <p className="bd-sub">{t("sheet.duration", { min: digits(lesson.minuteMin), max: digits(lesson.minuteMax) })}</p>
        {lesson.stage === "learn" ? <Learn lesson={lesson} /> : null}
        {lesson.stage === "practice" ? <Practice lesson={lesson} busy={busy} onPick={(practice) => void save({ stage: "practice", practice, applyText: draft })} /> : null}
        {lesson.stage === "apply" ? <Apply value={draft} words={words} estimate={estimate} min={lesson.applyMin} max={lesson.applyMax} onChange={setDraft} /> : null}
        {lesson.stage === "review" ? <p>{t("lesson.review")}</p> : null}
        {error ? <p className="bd-error" role="alert">{error}</p> : null}
      </section>
      <div className="bd-lesson__foot">
        <button
          type="button"
          className="bd-btn bd-btn--solid bd-btn--block"
          disabled={busy || (lesson.stage === "practice" && !lesson.practice)}
          onClick={() => {
            if (lesson.stage === "learn") void save({ stage: "practice", practice: null, applyText: draft });
            else if (lesson.stage === "practice" && lesson.practice) void save({ stage: "apply", practice: lesson.practice, applyText: draft });
            else if (lesson.stage === "apply") void save({ stage: "review", practice: lesson.practice, applyText: draft });
            else navigate(`/app/lessons/${nodeId}/done`);
          }}
        >{t(lesson.stage === "review" ? "lesson.finish" : "lesson.next")}</button>
      </div>
      {leave ? (
        <div className="bd-lesson__leave">
          <section role="alertdialog" aria-labelledby="leave-title">
            <h2 id="leave-title">{t("lesson.leaveTitle")}</h2>
            <p>{t("lesson.leaveBody")}</p>
            <button type="button" className="bd-btn bd-btn--solid" onClick={() => setLeave(false)}>{t("lesson.stay")}</button>
            <button type="button" className="bd-btn bd-btn--outline" onClick={() => navigate("/app")}>{t("lesson.leave")}</button>
          </section>
        </div>
      ) : null}
    </article>
  );
}

function Learn({ lesson }: { lesson: Lesson }) {
  const { t } = useT();
  return (
    <>
      <p>{t("lesson.teach")}</p>
      {(["topic", "support", "example"] as const).map((part) => (
        <div key={part} className="bd-lesson__line">
          <span className="bd-lesson__tag">{t(`lesson.tag.${part}`)}</span>
          <p className="bd-lesson__en">{lesson.example[part]}</p>
        </div>
      ))}
    </>
  );
}

function Practice({ lesson, busy, onPick }: { lesson: Lesson; busy: boolean; onPick: (id: Lesson["choices"][number]["id"]) => void }) {
  const { t } = useT();
  const answer = lesson.choices.find((choice) => choice.id === lesson.answer);
  return (
    <>
      <p>{t("lesson.practicePrompt")}</p>
      {lesson.choices.map((choice) => (
        <button key={choice.id} type="button" className="bd-lesson__choice bd-lesson__en" aria-pressed={lesson.practice === choice.id} disabled={busy} onClick={() => onPick(choice.id)}>{choice.text}</button>
      ))}
      {lesson.result === "correct" ? (
        <>
          <p className="bd-lesson__ok">{t("lesson.correct")}</p>
          <p className="bd-lesson__why">{t("lesson.correctWhy")}</p>
        </>
      ) : null}
      {lesson.result === "almost" ? (
        <p className="bd-lesson__almost">
          <strong>{t("lesson.almost")}</strong>
          <span>{t("lesson.almostLead")}</span>
          <span className="bd-lesson__en">{answer?.text}</span>
        </p>
      ) : null}
    </>
  );
}

function Apply({ value, words, estimate, min, max, onChange }: { value: string; words: number; estimate: Lesson["estimate"]; min: number; max: number; onChange: (value: string) => void }) {
  const { t, digits } = useT();
  return (
    <>
      <p>{t("lesson.apply", { min: digits(min), max: digits(max) })}</p>
      <textarea value={value} aria-label={t("lesson.applyLabel")} onChange={(event) => onChange(event.target.value)} />
      <p className="bd-lesson__count"><BdIcon name="word-count" size={16} /> {digits(words)} {t("lesson.words")}</p>
      <p className="bd-lesson__estimate">{t("lesson.estimateLabel")} {t(`lesson.estimate.${estimate}`)}</p>
    </>
  );
}

