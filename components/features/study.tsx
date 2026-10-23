"use client";

import Link from "@/components/link";
import { useMemo, useState } from "react";
import { useRouter } from "@/lib/navigation";
import { Callout, EmptyBlock, PageIntro, skillLabel } from "@/components/product/bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { answerIsCorrect, overallBand } from "@/lib/model";
import { BANK, MOCKS, PRACTICE_IDS, bankItem } from "@/lib/questions";
import { SKILL_WORD } from "@/lib/signals";
import { useApp } from "@/lib/store";
import type { Skill, SkillBands } from "@/lib/types";
import { SKILLS } from "@/lib/types";
import { formatBand, formatDate, formatNumber } from "@/lib/format";
import { cn } from "cn";

export function PracticeScreen() {
  const { bi, state, track } = useApp();
  const [skill, setSkill] = useState<Skill | "all">("all");
  const [level, setLevel] = useState("all");
  const [kind, setKind] = useState("all");
  const items = PRACTICE_IDS.map((id) => bankItem(id)).filter((item) => {
    if (skill !== "all" && item.skill !== skill) return false;
    if (level !== "all" && item.level !== level) return false;
    if (kind !== "all" && item.kind !== kind) return false;
    return true;
  });
  const recommended = viewSkill(state.dataSource);
  return (
    <div>
      <PageIntro title={bi("مرکز تمرین", "Practice")} lede={bi("یک مسیر پیشنهادی و یک کتابخانه آزاد. سؤال‌ها آموزشی و غیررسمی‌اند.", "A suggested path and an open library. Items are educational and unofficial.")} />
      <section className="mb-5 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">{bi("پیشنهاد امروز", "Today's suggestion")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{bi(`تمرکز روی ${SKILL_WORD[recommended][state.locale]}، چون در داده فعلی عقب‌تر یا در برنامه اولویت دارد.`, `${SKILL_WORD[recommended].en} is the focus, because it is behind or prioritised in the current data.`)}</p>
        <Link href={`/practice/${recommended === "listening" ? "P-L1" : recommended === "reading" ? "P-R1" : recommended === "writing" ? "P-W1" : "P-S1"}`} className={cn(buttonVariants(), "mt-3")} onClick={() => track("exercise_started", { skill: recommended, exerciseId: "suggested" })}>
          {bi("شروع تمرین پیشنهادی", "Start the suggested exercise")}
        </Link>
      </section>
      <div className="mb-4 flex flex-wrap gap-2">
        <Filter label={bi("مهارت", "Skill")} value={skill} onChange={(value) => setSkill(value as Skill | "all")} options={[["all", bi("همه", "All")], ...SKILLS.map((item) => [item, bi(SKILL_WORD[item].fa, SKILL_WORD[item].en)] as [string, string])]} />
        <Filter label={bi("سطح", "Level")} value={level} onChange={setLevel} options={[["all", bi("همه", "All")], ["foundation", bi("پایه", "Foundation")], ["intermediate", bi("میانی", "Intermediate")], ["advanced", bi("پیشرفته", "Advanced")]]} />
        <Filter label={bi("نوع", "Type")} value={kind} onChange={setKind} options={[["all", bi("همه", "All")], ["mcq", "MCQ"], ["tfng", "T/F/NG"], ["writing", "Writing"], ["speaking", "Speaking"]]} />
      </div>
      {items.length === 0 ? (
        <EmptyBlock title={bi("تمرینی با این فیلتر نیست", "No exercise matches these filters")} body={bi("یکی از فیلترها را بردارید.", "Remove a filter.")} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const attempts = state.exerciseAttempts.filter((attempt) => attempt.exerciseId === item.id);
            const last = attempts.at(-1);
            return (
              <li key={item.id} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{bi(SKILL_WORD[item.skill].fa, SKILL_WORD[item.skill].en)} · {item.level} · {formatNumber(item.minutes, state.locale)} {bi("دقیقه", "min")}</p>
                <h2 className="mt-1 font-medium" dir="ltr">{item.prompt.slice(0, 110)}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{last ? bi(`آخرین نتیجه ${last.correct} از ${last.total}`, `Last result ${last.correct} of ${last.total}`) : bi("هنوز انجام نشده", "Not done yet")}</p>
                <Link href={`/practice/${item.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>{attempts.length ? bi("دوباره", "Again") : bi("شروع", "Start")}</Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function viewSkill(source: string): Skill {
  if (source === "A") return "reading";
  if (source === "C") return "writing";
  return "writing";
}

function Filter({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: [string, string][] }) {
  return (
    <label className="text-sm">
      <span className="me-2 text-muted-foreground">{label}</span>
      <select className="h-9 rounded-md border bg-card px-2" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map(([key, text]) => <option key={key} value={key}>{text}</option>)}
      </select>
    </label>
  );
}

export function ExerciseScreen({ id }: { id: string }) {
  const item = BANK.find((entry) => entry.id === id);
  const { bi, state, completeExercise, waitForConnection, track } = useApp();
  const [answer, setAnswer] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const past = state.exerciseAttempts.filter((attempt) => attempt.exerciseId === id);
  if (!item) return <p>{bi("این تمرین در بانک نیست.", "That exercise is not in the bank.")}</p>;
  const finish = async () => {
    const connection = await waitForConnection();
    if (connection === "offline") {
      setError(bi("اتصال قطع است. پاسخ روی صفحه مانده و ثبت نشده.", "You are offline. The answer is still on the page and was not saved."));
      return;
    }
    const correct = item.kind === "writing" || item.kind === "speaking" ? (text.trim().length > 40 ? 1 : 0) : answerIsCorrect(item.id, answer) ? 1 : 0;
    completeExercise(item.id, item.skill, correct, 1);
    setResult(correct ? bi("با قاعده نمونه درست شمرده شد.", "The sample rule counted this as correct.") : bi("با قاعده نمونه نادرست یا ناقص شمرده شد.", "The sample rule counted this as incorrect or incomplete."));
    setError("");
  };
  return (
    <div className="grid gap-4">
      <PageIntro eyebrow={bi(SKILL_WORD[item.skill].fa, SKILL_WORD[item.skill].en)} title={bi("تمرین", "Exercise")} lede={item.instruction} />
      <article className="rounded-xl border bg-card p-4" dir="ltr" lang="en">
        <p>{item.prompt}</p>
        {item.options ? (
          <div className="mt-4 grid gap-2">
            {item.options.map((option) => (
              <label key={option} className="flex gap-2 rounded-lg border px-3 py-2 text-sm">
                <input type="radio" name="answer" checked={answer === option} onChange={() => setAnswer(option)} />
                {option}
              </label>
            ))}
          </div>
        ) : (
          <textarea className="mt-4 min-h-36 w-full rounded-lg border p-3 text-sm" value={item.kind === "writing" || item.kind === "speaking" ? text : answer} onChange={(event) => (item.kind === "writing" || item.kind === "speaking" ? setText(event.target.value) : setAnswer(event.target.value))} />
        )}
      </article>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {result ? (
        <Callout tone="success" title={bi("نتیجه نمونه", "Sample result")}>
          <p>{result}</p>
          <p className="mt-1">{item.explanation}</p>
          {past.length > 1 ? <p className="mt-1">{bi(`دفعات قبلی: ${past.length - 1}`, `Earlier attempts: ${past.length - 1}`)}</p> : null}
        </Callout>
      ) : (
        <Button onClick={() => { track("exercise_started", { skill: item.skill, exerciseId: item.id }); finish(); }}>{bi("ثبت نتیجه", "Save the result")}</Button>
      )}
      <Link href="/practice" className="text-sm text-primary underline-offset-4 hover:underline">{bi("بازگشت به کتابخانه", "Back to the library")}</Link>
    </div>
  );
}

export function MocksScreen() {
  const { bi, state } = useApp();
  return (
    <div>
      <PageIntro title={bi("آزمون‌های آزمایشی", "Mock tests")} lede={bi("نسخه کامل و تک‌مهارتی هر دو این‌جا هستند. محدودیتی برای تکرار گذاشته نشده. زمان پیشنهادی بعدی فقط یک توصیه است.", "Both a full mini-mock and single-skill papers are here. There is no forced wait. The next suggested time is only advice.")} />
      <ul className="grid gap-3">
        {MOCKS.map((mock) => (
          <li key={mock.id} className="rounded-xl border bg-card p-4">
            <h2 className="font-semibold">{bi(mock.title.fa, mock.title.en)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{bi(mock.blurb.fa, mock.blurb.en)}</p>
            <p className="mt-1 text-sm">{formatNumber(mock.minutes, state.locale)} {bi("دقیقه نمایشی", "demo minutes")}</p>
            <Link href={`/mocks/${mock.id}`} className={cn(buttonVariants({ variant: "outline" }), "mt-3")}>{bi("شروع", "Start")}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MockRunner({ id }: { id: string }) {
  const mock = MOCKS.find((item) => item.id === id);
  const { bi, state, saveMock, waitForConnection, view } = useApp();
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const items = useMemo(() => mock?.itemIds.map((itemId) => bankItem(itemId)) ?? [], [mock]);
  if (!mock) return <p>{bi("این آزمونک نیست.", "That mock does not exist.")}</p>;

  const submit = async () => {
    const connection = await waitForConnection();
    if (connection === "offline") {
      setError(bi("اتصال قطع است. پاسخ‌ها روی صفحه مانده‌اند.", "You are offline. Answers are still on the page."));
      return;
    }
    const objective = items.filter((item) => item.kind !== "writing" && item.kind !== "speaking");
    const correct = objective.filter((item) => answerIsCorrect(item.id, answers[item.id])).length;
    const ratio = objective.length ? correct / objective.length : 0.5;
    const base = view?.source.bands ?? { listening: 5.5, reading: 5.5, writing: 5.5, speaking: 5.5 };
    const bands: SkillBands = { ...base };
    if (mock.scope === "full" || mock.scope === "listening") bands.listening = Math.min(8, Math.max(3, base.listening + (ratio - 0.5)));
    if (mock.scope === "full" || mock.scope === "reading") bands.reading = Math.min(8, Math.max(3, base.reading + (ratio - 0.5)));
    saveMock(mock.id, {
      listening: Math.round(bands.listening * 2) / 2,
      reading: Math.round(bands.reading * 2) / 2,
      writing: bands.writing,
      speaking: bands.speaking,
    }, correct, objective.length, answers);
    setDone(true);
    setError("");
  };

  const attempt = state.mockAttempts.filter((item) => item.mockId === id).at(-1);
  return (
    <div className="grid gap-4">
      <PageIntro title={bi(mock.title.fa, mock.title.en)} lede={bi(mock.blurb.fa, mock.blurb.en)} />
      {items.map((item) => (
        <fieldset key={item.id} className="rounded-xl border bg-card p-4" dir="ltr">
          <legend className="text-sm font-medium">{item.prompt}</legend>
          {item.options ? item.options.map((option) => (
            <label key={option} className="mt-2 flex gap-2 text-sm">
              <input type="radio" name={item.id} checked={answers[item.id] === option} onChange={() => setAnswers((current) => ({ ...current, [item.id]: option }))} />
              {option}
            </label>
          )) : <textarea className="mt-2 min-h-24 w-full rounded-lg border p-2 text-sm" value={answers[item.id] ?? ""} onChange={(event) => setAnswers((current) => ({ ...current, [item.id]: event.target.value }))} />}
          {done ? <p className="mt-2 text-sm">{item.explanation} {item.answer ? `(${item.answer})` : ""}</p> : null}
        </fieldset>
      ))}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {!done ? <Button onClick={submit}>{bi("ارسال و دیدن گزارش نمونه", "Submit and see the sample report")}</Button> : null}
      {done && attempt ? (
        <Callout tone="success" title={bi("گزارش نمونه آزمونک", "Sample mock report")}>
          <p>{bi(`پاسخ عینی ${attempt.correct} از ${attempt.total}.`, `Objective answers: ${attempt.correct} of ${attempt.total}.`)}</p>
          <p>{bi("نمره مهارت‌های عینی کمی نسبت به برآورد فعلی جابه‌جا شد. نوشتن و صحبت کردن از روی این آزمونک کوتاه دوباره نمره نگرفتند.", "Objective skills moved slightly against the current estimate. Writing and speaking were not re-marked from this short paper.")}</p>
          <p>{bi(`کلی تقریبی ${formatBand(overallBand(attempt.bands), state.locale)}.`, `Approximate overall ${formatBand(overallBand(attempt.bands), state.locale)}.`)}</p>
          {view ? <p>{bi(`فاصله نوشتن تا حداقل هدف: ${formatBand(Math.max(0, view.source.targetSkills.writing - attempt.bands.writing), state.locale)}.`, `Writing gap to its minimum: ${formatBand(Math.max(0, view.source.targetSkills.writing - attempt.bands.writing), state.locale)}.`)}</p> : null}
          <p className="mt-2">{bi("پیشنهاد: فعالیت بازبینی خطا را در برنامه بالا ببرید. این توصیه قطعی نیست.", "Suggestion: move the error-review task up the plan. This advice is not certain.")}</p>
          <Button className="mt-3" variant="outline" onClick={() => router.push("/plan")}>{bi("رفتن به برنامه", "Go to the plan")}</Button>
        </Callout>
      ) : null}
    </div>
  );
}

export function ProgressScreen() {
  const { bi, state, view } = useApp();
  const [skill, setSkill] = useState<Skill | "all">("all");
  const attempts = state.exerciseAttempts.filter((item) => skill === "all" || item.skill === skill);
  const todayCount = attempts.filter((item) => item.at.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  return (
    <div className="grid gap-5">
      <PageIntro title={bi("پیگیری و تاریخچه", "Progress and history")} lede={bi("مقایسه دوره‌ها از نقاط نمودار می‌آید. اگر فقط یک نقطه باشد، مقایسه‌ای وجود ندارد.", "Period comparison uses the chart points. One point means there is nothing to compare.")} />
      {view ? (
        <section className="rounded-xl border bg-card p-4 text-sm leading-6">
          <h2 className="font-semibold">{bi("گزارش پایان امروز", "End-of-day note")}</h2>
          <p>{bi(`تمرین ثبت‌شده امروز: ${formatNumber(todayCount, state.locale)}.`, `Exercises saved today: ${formatNumber(todayCount, state.locale)}.`)}</p>
          <p>{bi(`پایبندی برنامه: ${formatNumber(view.source.adherence, state.locale)} درصد.`, `Plan adherence: ${formatNumber(view.source.adherence, state.locale)} percent.`)}</p>
          <p>{view.bottleneck ? bi(`اولویت فردا: ${view.bottleneck.title.fa}`, `Tomorrow's priority: ${view.bottleneck.title.en}`) : bi("اولویت فردا: نگه داشتن هر چهار مهارت.", "Tomorrow's priority: keep all four skills warm.")}</p>
          {view.timePressure === "short" ? <p>{bi("پیشنهاد تغییر برنامه: حجم را کم کنید، چون ساعت تا آزمون به کف برآورد نمی‌رسد.", "Plan suggestion: reduce volume, because hours before the exam miss the low estimate.")}</p> : null}
        </section>
      ) : <EmptyBlock title={bi("تاریخچه برآورد خالی است", "The estimate history is empty")} body={bi("بعد از تعیین سطح، نقطه اول این‌جا می‌آید.", "The first point appears here after the placement.")} />}
      <Filter label={bi("مهارت", "Skill")} value={skill} onChange={(value) => setSkill(value as Skill | "all")} options={[["all", bi("همه", "All")], ...SKILLS.map((item) => [item, skillLabel(item, state.locale)] as [string, string])]} />
      <ul className="grid gap-2 text-sm">
        {attempts.length === 0 ? <li className="text-muted-foreground">{bi("تمرین ذخیره‌شده‌ای در این فیلتر نیست.", "No saved exercise in this filter.")}</li> : attempts.map((item) => (
          <li key={item.id} className="rounded-lg border px-3 py-2">{formatDate(item.at, state.locale)} · {skillLabel(item.skill, state.locale)} · {item.correct}/{item.total}</li>
        ))}
      </ul>
      {view && view.source.history.length > 1 ? (
        <p className="text-sm">{bi(`مقایسه ابتدا و انتهای بازه نمونه: ${formatBand(view.source.history[0].overall, state.locale)} به ${formatBand(view.source.history.at(-1)!.overall, state.locale)}.`, `Sample window, start to end: ${formatBand(view.source.history[0].overall, state.locale)} to ${formatBand(view.source.history.at(-1)!.overall, state.locale)}.`)}</p>
      ) : null}
    </div>
  );
}

export function ArchiveScreen() {
  const { bi, state, view } = useApp();
  const [skill, setSkill] = useState<Skill | "all">("all");
  const attempts = [...state.exerciseAttempts, ...state.mockAttempts.map((item) => ({ id: item.id, skill: "listening" as Skill, at: item.at, correct: item.correct, total: item.total, exerciseId: item.mockId }))].filter((item) => skill === "all" || item.skill === skill);
  return (
    <div>
      <PageIntro title={bi("آرشیو پاسخ و خطا", "Answer and error archive")} lede={bi("پاسخ‌های ذخیره‌شده، بازخوردهای قاعده‌محور و خطاهای پرتکرار این مرورگر.", "Saved answers, rule-based feedback, and repeated errors from this browser.")} />
      <Filter label={bi("مهارت", "Skill")} value={skill} onChange={(value) => setSkill(value as Skill | "all")} options={[["all", bi("همه", "All")], ...SKILLS.map((item) => [item, skillLabel(item, state.locale)] as [string, string])]} />
      <div className="mt-4 grid gap-3">
        {view?.weaknesses.map((item) => (
          <article key={item.id} className="rounded-xl border p-4 text-sm">
            <h2 className="font-medium">{bi(item.title.fa, item.title.en)}</h2>
            <p className="text-muted-foreground">{bi("هنوز اصلاح‌شده علامت نخورده، مگر اینکه فعالیت مربوط را در برنامه انجام‌شده کنید.", "Not marked corrected unless you set the related plan task to done.")}</p>
          </article>
        ))}
        {attempts.length === 0 ? <EmptyBlock title={bi("آرشیو خالی است", "The archive is empty")} body={bi("اولین تمرین یا آزمونک این‌جا فهرست می‌شود.", "The first exercise or mock will be listed here.")} /> : attempts.map((item) => (
          <p key={item.id} className="rounded-lg border px-3 py-2 text-sm">{formatDate(item.at, state.locale)} · {item.exerciseId} · {item.correct}/{item.total}</p>
        ))}
      </div>
    </div>
  );
}
