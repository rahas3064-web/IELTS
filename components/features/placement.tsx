"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Callout, PageIntro, SkillBoard, ReadinessFigure, TrendChart, skillLabel } from "@/components/product/bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBand, formatClock, formatNumber, wordCount } from "@/lib/format";
import { PATH_WORD, SKILL_WORD } from "@/lib/signals";
import { evidenceLines, gradeItems } from "@/lib/model";
import { CHART_HOURS, PASSAGES, PLACEMENT_IDS, bankItem } from "@/lib/questions";
import { useApp } from "@/lib/store";
import type { Skill } from "@/lib/types";
import { SKILLS } from "@/lib/types";
import { cn } from "cn";

const DEMO_SECONDS: Record<Skill, number> = {
  listening: 7 * 60,
  reading: 8 * 60,
  writing: 12 * 60,
  speaking: 6 * 60,
};

const FULL_LABEL: Record<Skill, { fa: string; en: string }> = {
  listening: { fa: "آزمون کامل حدود ۳۰ دقیقه", en: "A full paper is about 30 minutes" },
  reading: { fa: "آزمون کامل حدود ۶۰ دقیقه", en: "A full paper is about 60 minutes" },
  writing: { fa: "آزمون کامل حدود ۶۰ دقیقه", en: "A full paper is about 60 minutes" },
  speaking: { fa: "آزمون کامل حدود ۱۱ تا ۱۴ دقیقه", en: "A full paper is about 11–14 minutes" },
};

export function PlacementHub() {
  const { bi, state, view } = useApp();
  const done = SKILLS.filter((skill) => state.placement.done[skill]).length;
  return (
    <div>
      <PageIntro
        eyebrow={bi("تعیین سطح نمایشی", "Demo placement")}
        title={bi("چهار مهارت، یک گزارش", "Four skills, one report")}
        lede={bi("زمان هر بخش در نسخه نمایشی کوتاه شده است. نتیجه فقط بعد از هر چهار مهارت باز می‌شود و رسمی نیست.", "Each section is shortened for the demo. The result opens only after all four skills, and it is not official.")}
      />
      <Callout title={bi("اگر اتصال قطع شود", "If the connection drops")}>
        {bi("زمان ادامه پیدا می‌کند. پاسخ‌ها در همین مرورگر می‌مانند. دکمه ارسال تا آنلاین شدن غیرفعال است.", "The clock keeps running. Answers stay in this browser. Submit stays disabled until you are online.")}
      </Callout>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {SKILLS.map((skill) => {
          const finished = Boolean(state.placement.done[skill]);
          return (
            <article key={skill} className="rounded-xl border bg-card p-4">
              <h2 className="text-lg font-semibold">{skillLabel(skill, state.locale)} <span className="text-sm font-normal text-muted-foreground">({SKILL_WORD[skill].en})</span></h2>
              <p className="mt-1 text-sm text-muted-foreground">{bi(FULL_LABEL[skill].fa, FULL_LABEL[skill].en)}</p>
              <p className="mt-1 text-sm">{bi("زمان این نسخه", "This version")}: {formatClock(DEMO_SECONDS[skill], state.locale)}</p>
              <p className="mt-2 text-sm">{finished ? bi("ارسال شده", "Submitted") : bi("هنوز ارسال نشده", "Not submitted yet")}</p>
              <Link href={`/placement/${skill}`} className={cn(buttonVariants({ size: "lg" }), "mt-4 h-10")}>
                {finished ? bi("بازبینی", "Review") : bi("شروع", "Start")}
              </Link>
            </article>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <p className="text-sm">{bi(`${done} از ۴ مهارت`, `${done} of 4 skills`)}</p>
        {done === 4 ? (
          <Link href="/placement/report" className={cn(buttonVariants({ size: "lg" }), "h-10")}>{bi("دیدن گزارش", "Open the report")}</Link>
        ) : (
          <p className="text-sm text-muted-foreground">{bi("گزارش تا تکمیل هر چهار مهارت قفل است.", "The report stays locked until all four skills are done.")}</p>
        )}
      </div>
      {view?.source.fictional ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {bi("داشبورد تا پایان این آزمون، سناریوی نمونه را نشان می‌دهد.", "Until you finish this test, the dashboard keeps showing the sample scenario.")}
        </p>
      ) : null}
    </div>
  );
}

function useTicker(active: boolean, seconds: number) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => { setLeft(seconds); }, [seconds]);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return left;
}

export function SkillRunner({ skill }: { skill: string }) {
  const known = (SKILLS as readonly string[]).includes(skill);
  const typed = skill as Skill;
  const { bi, state, setAnswer, patchPlacement, setSpeaking, completeSkill, waitForConnection } = useApp();
  const router = useRouter();
  const ids = known ? PLACEMENT_IDS[typed] : [];
  const [index, setIndex] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeakingOn] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const locked = known ? Boolean(state.placement.done[typed]) : false;
  const left = useTicker(!locked, known ? DEMO_SECONDS[typed] : 0);
  const item = ids[index] ? bankItem(ids[index]) : null;
  const passage = item?.passageId ? PASSAGES.find((entry) => entry.id === item.passageId) : undefined;

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setRecordSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const unanswered = useMemo(() => {
    if (!known) return 0;
    if (typed === "writing") return Number(!state.placement.writing2.trim()) + Number(!state.placement.writing1.trim());
    if (typed === "speaking") return ids.filter((id) => !state.placement.speaking[id]?.trim()).length;
    return gradeItems(ids, state.placement.answers).unanswered;
  }, [known, typed, ids, state.placement]);

  if (!known || !item) {
    return <p>{bi("این بخش وجود ندارد.", "That section does not exist.")}</p>;
  }

  function playScript() {
    const script = passage?.audioScript;
    if (!script || !window.speechSynthesis) {
      setError(bi("گفتار مصنوعی در این مرورگر در دسترس نیست. رونوشت را باز کنید.", "Synthetic speech is unavailable. Open the transcript."));
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.lang = "en-GB";
    utterance.rate = 0.92;
    utterance.onend = () => setSpeakingOn(false);
    utterance.onerror = () => {
      setSpeakingOn(false);
      setError(bi("پخش مصنوعی ناموفق بود.", "Synthetic playback failed."));
    };
    setSpeakingOn(true);
    window.speechSynthesis.speak(utterance);
  }

  async function submit() {
    setError("");
    const connection = await waitForConnection();
    if (connection === "offline") {
      setError(bi("اتصال قطع است. پاسخ‌ها مانده‌اند و زمان ادامه دارد. دوباره تلاش کنید.", "You are offline. Answers are kept and the clock continues. Try again."));
      setConfirm(false);
      return;
    }
    completeSkill(typed);
    const remaining = SKILLS.filter((entry) => entry !== typed && !state.placement.done[entry]).length;
    router.push(remaining === 0 ? "/placement/report" : "/placement");
  }

  const expired = left === 0 && !locked;

  return (
    <div>
      <PageIntro
        eyebrow={bi("نسخه کوتاه‌شده", "Shortened version")}
        title={skillLabel(typed, state.locale)}
        lede={bi(FULL_LABEL[typed].fa, FULL_LABEL[typed].en)}
        actions={<span className="rounded-full border px-3 py-1 text-sm tabular-nums" aria-live="polite">{formatClock(left, state.locale)}</span>}
      />
      {expired ? <div className="mb-4"><Callout tone="warning" title={bi("زمان این بخش تمام شد", "This section's time is up")}>{bi("در نسخه نمایشی هنوز می‌توانید ارسال کنید. در آزمون رسمی وقت اضافه به همین شکل داده نمی‌شود.", "In the demo you can still submit. An official test does not offer extra time this way.")}</Callout></div> : null}
      <div className="mb-4 flex flex-wrap gap-2" aria-label={bi("سؤال‌ها", "Questions")}>
        {ids.map((id, itemIndex) => {
          const filled = typed === "writing"
            ? (id === "W1" ? state.placement.writing1.trim() : state.placement.writing2.trim())
            : typed === "speaking" ? state.placement.speaking[id]?.trim() : state.placement.answers[id]?.trim();
          return (
            <button key={id} type="button" className={cn("size-8 rounded-full border text-xs", index === itemIndex && "border-primary bg-primary text-primary-foreground", !filled && index !== itemIndex && "border-dashed")} onClick={() => setIndex(itemIndex)} aria-current={index === itemIndex ? "true" : undefined}>
              {itemIndex + 1}
              <span className="sr-only">{filled ? bi("پاسخ دارد", "answered") : bi("بی‌پاسخ", "unanswered")}</span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-xl border bg-card p-4" dir="ltr" lang="en">
          {typed === "listening" && passage?.audioScript ? (
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Synthetic audio · not an official recording</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" variant="outline" onClick={playScript}>{speaking ? "Stop after this sentence" : "Play browser voice"}</Button>
                {speaking ? <Button type="button" variant="ghost" onClick={() => { window.speechSynthesis.cancel(); setSpeakingOn(false); }}>Stop</Button> : null}
              </div>
              <details className="mt-3 text-sm">
                <summary>Demo transcript, if audio is unavailable</summary>
                <p className="mt-2 leading-6">{passage.audioScript}</p>
              </details>
            </div>
          ) : null}
          {typed === "reading" && passage ? (
            <article>
              <h2 className="exam-serif text-xl">{passage.title}</h2>
              <p className="exam-serif mt-3 whitespace-pre-wrap text-sm leading-7">{passage.body}</p>
            </article>
          ) : null}
          {item.id === "W1" ? (
            <div>
              <h2 className="text-lg font-semibold">Study hours in one fictional week</h2>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-1 text-start">Learner</th>
                    {SKILLS.map((entry) => <th key={entry} className="py-1 text-end">{entry}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {CHART_HOURS.map((row) => (
                    <tr key={row.name} className="border-t">
                      <td className="py-1">{row.name}</td>
                      {SKILLS.map((entry) => <td key={entry} className="py-1 text-end tabular-nums">{row[entry]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {item.id === "S3" ? (
            <div className="rounded-xl border border-dashed p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Cue card</p>
              <p className="mt-2 font-medium">{item.prompt}</p>
            </div>
          ) : null}
          <p className="mt-4 text-xs text-muted-foreground">{item.section}</p>
          <p className="mt-1 text-sm">{item.instruction}</p>
        </section>
        <section className="rounded-xl border bg-card p-4">
          <p className="text-sm font-medium" dir="ltr" lang="en">{item.id === "S3" ? "Record or type your long turn" : item.prompt}</p>
          <div className="mt-4">
            {item.kind === "mcq" || item.kind === "tfng" ? (
              <div className="grid gap-2" role="radiogroup" aria-label={item.prompt}>
                {item.options?.map((option) => (
                  <label key={option} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm" dir="ltr">
                    <input type="radio" name={item.id} checked={state.placement.answers[item.id] === option} onChange={() => setAnswer(item.id, option)} disabled={locked || expired} />
                    {option}
                  </label>
                ))}
              </div>
            ) : null}
            {item.kind === "short" ? (
              <input className="h-11 w-full rounded-lg border px-3" dir="ltr" value={state.placement.answers[item.id] ?? ""} onChange={(event) => setAnswer(item.id, event.target.value)} disabled={locked || expired} aria-label={item.prompt} />
            ) : null}
            {item.kind === "writing" ? (
              <div>
                <textarea
                  className="min-h-56 w-full rounded-lg border p-3 text-sm leading-6"
                  dir="ltr"
                  lang="en"
                  value={item.id === "W1" ? state.placement.writing1 : state.placement.writing2}
                  onChange={(event) => patchPlacement(item.id === "W1" ? { writing1: event.target.value } : { writing2: event.target.value })}
                  disabled={locked || expired}
                  aria-label={item.prompt}
                />
                <p className="mt-2 text-sm tabular-nums">{bi("کلمه", "Words")}: {formatNumber(wordCount(item.id === "W1" ? state.placement.writing1 : state.placement.writing2), state.locale)} / {item.id === "W1" ? 150 : 250}</p>
              </div>
            ) : null}
            {item.kind === "speaking" ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant={recording ? "destructive" : "outline"} onClick={() => {
                    if (recording) {
                      setRecording(false);
                      setSpeaking(item.id, state.placement.speaking[item.id] ?? "", recordSeconds);
                    } else {
                      setRecordSeconds(0);
                      setRecording(true);
                    }
                  }} disabled={locked || expired}>
                    {recording ? bi("پایان ضبط نمایشی", "Stop demo recording") : bi("شروع ضبط نمایشی", "Start demo recording")}
                  </Button>
                  <span className="self-center text-sm tabular-nums">{formatClock(recordSeconds, state.locale)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{bi("فایل صوتی به سرور نمی‌رود. مدت ضبط فقط در همین مرورگر می‌ماند و تلفظ نمره نمی‌گیرد.", "Audio is not uploaded. Only the duration stays in this browser, and pronunciation is not scored.")}</p>
                <textarea className="min-h-32 w-full rounded-lg border p-3 text-sm" dir="ltr" lang="en" value={state.placement.speaking[item.id] ?? ""} onChange={(event) => setSpeaking(item.id, event.target.value)} disabled={locked || expired} aria-label={item.prompt} />
              </div>
            ) : null}
          </div>
          {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>{bi("قبلی", "Previous")}</Button>
            {index < ids.length - 1 ? (
              <Button type="button" onClick={() => setIndex((value) => value + 1)}>{bi("بعدی", "Next")}</Button>
            ) : (
              <Button type="button" onClick={() => setConfirm(true)} disabled={locked}>{bi("بازبینی و ارسال", "Review and submit")}</Button>
            )}
          </div>
        </section>
      </div>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bi("ارسال این مهارت", "Submit this skill")}</DialogTitle>
            <DialogDescription>
              {unanswered > 0
                ? bi(`${unanswered} مورد هنوز خالی است. می‌توانید برگردید یا با همین وضعیت ارسال کنید.`, `${unanswered} items are still empty. You can go back, or submit as they are.`)
                : bi("پاسخ‌ها در همین مرورگر ذخیره شده‌اند.", "Answers are stored in this browser.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>{bi("بازگشت", "Go back")}</Button>
            <Button onClick={submit}>{bi("ارسال", "Submit")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ReportScreen() {
  const { bi, state, view } = useApp();
  const done = SKILLS.every((skill) => state.placement.done[skill]);
  if (!done && !view) {
    return <Callout title={bi("گزارش هنوز ساخته نمی‌شود", "The report is not ready")}><Link href="/placement">{bi("بازگشت به تعیین سطح", "Back to the placement")}</Link></Callout>;
  }
  if (!done && view?.source.fictional) {
    return (
      <div>
        <PageIntro title={bi("گزارش سناریوی نمونه", "Sample scenario report")} lede={bi("این صفحه تا وقتی تعیین سطح خودتان تمام نشده، داده خیالی سناریو را نشان می‌دهد.", "Until your own placement is finished, this page shows the fictional scenario.")} />
        <ReportBody />
      </div>
    );
  }
  if (!done || !view) {
    return (
      <div>
        <PageIntro title={bi("گزارش قفل است", "The report is locked")} lede={bi("هر چهار مهارت باید ارسال شوند.", "All four skills have to be submitted.")} />
        <Link href="/placement" className={buttonVariants({ size: "lg" })}>{bi("ادامه تعیین سطح", "Continue the placement")}</Link>
      </div>
    );
  }
  return (
    <div>
      <PageIntro
        eyebrow={bi("تخمین غیررسمی و شبیه‌سازی‌شده", "Unofficial simulated estimate")}
        title={bi("گزارش تعیین سطح", "Placement report")}
        lede={bi("یک آزمون کوتاه معادل آزمون رسمی نیست. نمره آینده تضمین نمی‌شود.", "A short test is not the official exam. A future score is not guaranteed.")}
      />
      <ReportBody />
    </div>
  );
}

function ReportBody() {
  const { bi, state, view } = useApp();
  if (!view) return null;
  const locale = state.locale;
  const lines = evidenceLines(view);
  return (
    <div className="grid gap-5">
      <Callout tone="warning" title={bi("تخمین غیررسمی و شبیه‌سازی‌شده", "Unofficial simulated estimate")}>
        {bi("بازه نمره به‌خاطر کمبود شواهد است، نه به‌خاطر یک خطای رسمی آیلتس.", "The score range exists because the evidence is thin, not because of an official IELTS error margin.")}
      </Callout>
      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-xl border bg-card p-5">
          <p className="text-sm text-muted-foreground">{bi("نمره کلی", "Overall")}</p>
          <p className="text-5xl font-semibold tabular-nums">{formatBand(view.overall, locale)}</p>
          <p className="mt-2 text-sm">{bi("بازه احتمالی", "Probable range")}: {formatBand(view.range.low, locale)} – {formatBand(view.range.high, locale)}</p>
          <p className="mt-1 text-sm">{bi("اطمینان تخمین", "Estimate confidence")}: {formatNumber(view.source.confidence, locale)} / ۱۰۰</p>
          <p className="mt-1 text-sm">{bi("هدف", "Target")}: {formatBand(view.source.targetOverall, locale)}</p>
          {view.source.targetOverall !== view.source.suggestedOverall ? (
            <p className="mt-2 text-sm text-muted-foreground">{bi(`پیشنهاد سیستم ${formatBand(view.source.suggestedOverall, locale)} بود.`, `The system suggestion was ${formatBand(view.source.suggestedOverall, locale)}.`)}</p>
          ) : null}
        </div>
        <ReadinessFigure view={view} />
      </section>
      <SkillBoard view={view} />
      <TrendChart points={view.source.history} />
      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{bi("شواهد", "Evidence")}</h2>
          <ul className="mt-2 grid gap-2 text-sm leading-6">
            {lines.map((line) => <li key={line.en}>{bi(line.fa, line.en)}</li>)}
          </ul>
        </article>
        <article className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{bi("اولویت‌ها", "Priorities")}</h2>
          <ul className="mt-2 grid gap-3 text-sm">
            {view.weaknesses.map((item) => (
              <li key={item.id}>
                <p className="font-medium">{bi(item.title.fa, item.title.en)}</p>
                <p className="text-muted-foreground">{bi(item.evidence.fa, item.evidence.en)}</p>
              </li>
            ))}
            {!view.weaknesses.length ? <li>{bi("شکاف بزرگی نسبت به حداقل مهارت‌ها دیده نمی‌شود.", "No large gap against the skill minimums is visible.")}</li> : null}
          </ul>
        </article>
      </section>
      <section className="rounded-xl border bg-card p-4">
        <h2 className="font-semibold">{bi("زمان، با فرض‌های روشن", "Time, with the assumptions in the open")}</h2>
        <p className="mt-2 text-sm leading-6">
          {bi(
            `برآورد ${formatNumber(view.hours.lowHours, locale)} تا ${formatNumber(view.hours.highHours, locale)} ساعت است. هر نیم‌نمره زیر ۵ حدود ۵۵ ساعت، بین ۵ و ۶ حدود ۴۲ ساعت، بین ۶ و ۷ حدود ۴۸ ساعت و بالاتر حدود ۶۰ ساعت فرض شده، بعد ۱۰ درصد هم‌پوشانی کم شده است.`,
            `The estimate is ${formatNumber(view.hours.lowHours, locale)} to ${formatNumber(view.hours.highHours, locale)} hours. Each half band under 5 is about 55 hours, 42 between 5 and 6, 48 between 6 and 7, and 60 above that, then 10 percent is removed for overlap.`,
          )}
        </p>
        <p className="mt-2 text-sm">
          {view.weeksLeft == null
            ? bi("تاریخ آزمون معلوم نیست، پس فشار زمانی حساب نمی‌شود.", "The exam date is unknown, so time pressure is not calculated.")
            : bi(`حدود ${formatNumber(view.weeksLeft, locale)} هفته مانده و مطالعه هفتگی ${formatNumber(view.hours.weeklyHours, locale)} ساعت است.`, `About ${formatNumber(view.weeksLeft, locale)} weeks remain, with ${formatNumber(view.hours.weeklyHours, locale)} study hours a week.`)}
        </p>
        {view.timePressure === "short" ? <p className="mt-2 text-sm text-warning">{bi("ساعت‌های موجود از کف برآورد کمتر است. هدف را دیرتر کنید یا حجم را واقع‌بینانه کم کنید.", "Available hours are below the low estimate. Move the target later, or reduce the volume honestly.")}</p> : null}
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        {(["balanced", "bottleneck", "sprint"] as const).map((path) => (
          <article key={path} className={cn("rounded-xl border p-4", view.plan.path === path && "border-primary")}>
            <h3 className="font-medium">{bi(PATH_WORD[path].fa, PATH_WORD[path].en)}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {path === "balanced" && bi("زمان بین مهارت‌ها پخش می‌شود.", "Time is spread across skills.")}
              {path === "bottleneck" && bi("بیشترین وقت برای مهارت عقب می‌ماند.", "Most time stays on the trailing skill.")}
              {path === "sprint" && bi("درس پایه کنار می‌رود و بازبینی خطا جلو می‌آید.", "Foundation lessons drop away and error review comes forward.")}
            </p>
            {view.plan.path === path ? <p className="mt-2 text-xs text-primary">{bi("مسیر فعلی برنامه", "Current plan path")}</p> : null}
          </article>
        ))}
      </section>
      {view.source.objective ? (
        <section className="rounded-xl border bg-card p-4">
          <h2 className="font-semibold">{bi("معیارهای نوشتن و صحبت کردن", "Writing and speaking criteria")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{bi("قاعده نمایشی، نه داور و نه مدل زبانی.", "Demo rules, not a rater and not a language model.")}</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            {[view.source.objective.writing, view.source.objective.speaking].map((block) => (
              <ul key={block.criteria[0]?.id} className="grid gap-2 text-sm">
                {block.criteria.map((criterion) => (
                  <li key={criterion.id}>
                    <span className="font-medium">{bi(criterion.label.fa, criterion.label.en)}: </span>
                    {criterion.score == null ? bi("ارزیابی نشده", "Not assessed") : formatBand(criterion.score, locale)}
                    <span className="mt-0.5 block text-muted-foreground">{bi(criterion.note.fa, criterion.note.en)}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>
      ) : null}
      <Link href="/plan" className={cn(buttonVariants({ size: "lg" }), "h-11 w-fit")}>{bi("دیدن برنامه یادگیری", "Open the learning plan")}</Link>
    </div>
  );
}
