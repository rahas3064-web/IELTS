"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageIntro, Field, inputClass, Callout } from "@/components/product/bits";
import { Button } from "@/components/ui/button";
import { formatBand } from "@/lib/format";
import { emptyBands, suggestOverall } from "@/lib/model";
import { REASONS } from "@/lib/signals";
import { useApp } from "@/lib/store";
import type { ExamTiming, ExamType, Profile, Reason, SkillBands } from "@/lib/types";
import { SKILLS } from "@/lib/types";
import { cn } from "cn";

const DRAFT = "ielts-onboarding-draft";

type Draft = {
  step: number;
  examType: ExamType;
  reason: Reason;
  reasonNote: string;
  mode: "previous" | "self";
  previous: string;
  self: string;
  targetOverall: string;
  targets: SkillBands;
  timingKind: ExamTiming["kind"];
  date: string;
  months: string;
  dailyMinutes: string;
  daysPerWeek: string;
};

const initial: Draft = {
  step: 0,
  examType: "academic",
  reason: "university",
  reasonNote: "",
  mode: "self",
  previous: "",
  self: "5.5",
  targetOverall: "",
  targets: emptyBands(6),
  timingKind: "unknown",
  date: "",
  months: "4",
  dailyMinutes: "60",
  daysPerWeek: "5",
};

export function OnboardingScreen() {
  const { bi, state, saveProfile } = useApp();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState("");

  useEffect(() => {
    const raw = sessionStorage.getItem(DRAFT);
    if (raw) {
      try { setDraft({ ...initial, ...JSON.parse(raw) }); } catch { /* keep initial */ }
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem(DRAFT, JSON.stringify(draft));
  }, [draft]);

  const currentBand = draft.mode === "previous" && draft.previous ? Number(draft.previous) : Number(draft.self) || 5;
  const suggested = useMemo(() => {
    const bands = emptyBands(Number.isFinite(currentBand) ? currentBand : 5);
    const weekly = (Number(draft.dailyMinutes) / 60) * Number(draft.daysPerWeek);
    const weeks = draft.timingKind === "date" && draft.date
      ? Math.max(1, Math.round((new Date(draft.date).getTime() - Date.now()) / (7 * 86400000)))
      : draft.timingKind === "window" ? Number(draft.months) * 4 : null;
    return suggestOverall({ bands, reason: draft.reason, weeklyHours: weekly, weeks });
  }, [currentBand, draft.dailyMinutes, draft.daysPerWeek, draft.timingKind, draft.date, draft.months, draft.reason]);

  function patch(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setError("");
  }

  function next() {
    if (draft.step === 2) {
      const value = draft.mode === "previous" ? Number(draft.previous) : Number(draft.self);
      if (!Number.isFinite(value) || value < 1 || value > 9) {
        setError(bi("نمره را بین ۱ و ۹ بنویسید، یا این مرحله را با تخمین ۵٫۵ رد کنید.", "Enter a band between 1 and 9."));
        return;
      }
    }
    if (draft.step === 3) {
      const overall = Number(draft.targetOverall || suggested);
      if (!Number.isFinite(overall) || overall < 4 || overall > 9) {
        setError(bi("هدف کلی را بین ۴ و ۹ بگذارید.", "Set the overall target between 4 and 9."));
        return;
      }
    }
    if (draft.step === 4) {
      const minutes = Number(draft.dailyMinutes);
      const days = Number(draft.daysPerWeek);
      if (!Number.isFinite(minutes) || minutes < 15 || minutes > 240) {
        setError(bi("زمان روزانه بین ۱۵ تا ۲۴۰ دقیقه باشد.", "Daily time should be between 15 and 240 minutes."));
        return;
      }
      if (!Number.isFinite(days) || days < 1 || days > 7) {
        setError(bi("تعداد روز بین ۱ تا ۷ باشد.", "Days per week should be between 1 and 7."));
        return;
      }
      if (draft.timingKind === "date" && !draft.date) {
        setError(bi("تاریخ را انتخاب کنید یا بگویید هنوز معلوم نیست.", "Pick a date, or say it is still unknown."));
        return;
      }
    }
    patch({ step: Math.min(5, draft.step + 1), targetOverall: draft.targetOverall || String(suggested) });
  }

  function finish() {
    const timing: ExamTiming = draft.timingKind === "date"
      ? { kind: "date", date: draft.date }
      : draft.timingKind === "window"
        ? { kind: "window", months: Number(draft.months) }
        : { kind: "unknown" };
    const profile: Profile = {
      name: state.account?.name ?? "",
      email: state.account?.email ?? "",
      phone: state.account?.phone ?? "",
      age: state.account?.age ?? 18,
      examType: draft.examType,
      reason: draft.reason,
      reasonNote: draft.reasonNote,
      selfBand: draft.mode === "self" ? Number(draft.self) : null,
      previousOverall: draft.mode === "previous" ? Number(draft.previous) : null,
      targetOverall: Number(draft.targetOverall || suggested),
      targetSkills: draft.targets,
      timing,
      dailyMinutes: Number(draft.dailyMinutes),
      daysPerWeek: Number(draft.daysPerWeek),
      suggestedOverall: suggested,
    };
    saveProfile(profile);
    sessionStorage.removeItem(DRAFT);
    router.push("/placement");
  }

  const steps = [
    bi("نوع آزمون", "Exam type"),
    bi("دلیل", "Reason"),
    bi("سطح فعلی", "Current level"),
    bi("هدف", "Target"),
    bi("زمان", "Time"),
    bi("بازبینی", "Review"),
  ];

  return (
    <div>
      <PageIntro
        eyebrow={bi(`مرحله ${draft.step + 1} از ${steps.length}`, `Step ${draft.step + 1} of ${steps.length}`)}
        title={steps[draft.step]}
        lede={bi("فرم را کوتاه نگه داشته‌ایم. هر بخش را می‌شود بعداً در پروفایل عوض کرد.", "The form stays short. You can change every part later in the profile.")}
      />
      <ol className="mb-6 flex flex-wrap gap-2" aria-label={bi("مراحل", "Steps")}>
        {steps.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              className={cn("rounded-full border px-3 py-1 text-xs", index === draft.step ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}
              onClick={() => index < draft.step && patch({ step: index })}
              disabled={index > draft.step}
            >
              {label}
            </button>
          </li>
        ))}
      </ol>
      <div className="max-w-2xl rounded-2xl border bg-card p-5">
        {draft.step === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {(["academic", "general"] as ExamType[]).map((type) => (
              <button key={type} type="button" onClick={() => patch({ examType: type })} className={cn("rounded-xl border p-4 text-start", draft.examType === type && "border-primary bg-primary/8")}>
                <span className="block font-medium">{type === "academic" ? "Academic" : "General Training"}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {type === "academic" ? bi("تحصیل و اغلب پذیرش دانشگاه", "Study, and many university applications") : bi("کار، مهاجرت و نامه‌نویسی", "Work, migration, and letters")}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {draft.step === 1 ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              {(Object.keys(REASONS) as Reason[]).map((reason) => (
                <button key={reason} type="button" onClick={() => patch({ reason })} className={cn("rounded-lg border px-3 py-2 text-start text-sm", draft.reason === reason && "border-primary bg-primary/8")}>
                  {bi(REASONS[reason].fa, REASONS[reason].en)}
                </button>
              ))}
            </div>
            <Field label={bi("توضیح اختیاری", "Optional note")} htmlFor="note">
              <textarea id="note" className={cn(inputClass(), "h-24 py-2")} value={draft.reasonNote} onChange={(event) => patch({ reasonNote: event.target.value })} />
            </Field>
          </div>
        ) : null}
        {draft.step === 2 ? (
          <div className="grid gap-4">
            <Callout title={bi("این عدد مبنای نهایی نیست", "This number is not the final baseline")}>
              {bi("خوداظهاری یا نمره قبلی فقط برای پیشنهاد هدف است. تحلیل اصلی بعد از تعیین سطح چهارمهارتی ساخته می‌شود.", "Self-report or a past score only feeds the target suggestion. The main reading of your level comes after the four-skill placement.")}
            </Callout>
            <div className="flex gap-2">
              <Button type="button" variant={draft.mode === "self" ? "default" : "outline"} onClick={() => patch({ mode: "self" })}>{bi("خودارزیابی", "Self-estimate")}</Button>
              <Button type="button" variant={draft.mode === "previous" ? "default" : "outline"} onClick={() => patch({ mode: "previous" })}>{bi("نمره قبلی", "Past score")}</Button>
            </div>
            {draft.mode === "self" ? (
              <Field label={bi("حدس شما از نمره کلی", "Your guess of the overall")} htmlFor="self">
                <input id="self" className={inputClass()} value={draft.self} onChange={(event) => patch({ self: event.target.value })} inputMode="decimal" />
              </Field>
            ) : (
              <Field label={bi("نمره کلی آزمون قبلی", "Overall from a past test")} htmlFor="previous">
                <input id="previous" className={inputClass()} value={draft.previous} onChange={(event) => patch({ previous: event.target.value })} inputMode="decimal" />
              </Field>
            )}
          </div>
        ) : null}
        {draft.step === 3 ? (
          <div className="grid gap-4">
            <Callout tone="info" title={bi(`پیشنهاد سیستم: ${formatBand(suggested, state.locale)}`, `System suggestion: ${formatBand(suggested, state.locale)}`)}>
              {bi("پیشنهاد از دلیل آزمون، سطح اعلام‌شده و زمان مطالعه می‌آید. می‌توانید آن را عوض کنید. قبول شدنش تضمین نتیجه نیست.", "The suggestion uses your reason, the level you reported, and study time. You can change it. Accepting it does not guarantee a result.")}
            </Callout>
            <Button type="button" variant="outline" onClick={() => patch({ targetOverall: String(suggested), targets: emptyBands(suggested) })}>
              {bi("استفاده از پیشنهاد", "Use the suggestion")}
            </Button>
            <Field label={bi("هدف کلی", "Overall target")} htmlFor="overall">
              <input id="overall" className={inputClass()} value={draft.targetOverall || String(suggested)} onChange={(event) => patch({ targetOverall: event.target.value })} inputMode="decimal" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {SKILLS.map((skill) => (
                <Field key={skill} label={skill} htmlFor={skill}>
                  <input id={skill} className={inputClass()} value={String(draft.targets[skill])} onChange={(event) => patch({ targets: { ...draft.targets, [skill]: Number(event.target.value) } })} inputMode="decimal" />
                </Field>
              ))}
            </div>
          </div>
        ) : null}
        {draft.step === 4 ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              {(["date", "window", "unknown"] as const).map((kind) => (
                <Button key={kind} type="button" variant={draft.timingKind === kind ? "default" : "outline"} onClick={() => patch({ timingKind: kind })}>
                  {kind === "date" ? bi("تاریخ دقیق", "Exact date") : kind === "window" ? bi("بازه تقریبی", "Rough window") : bi("هنوز معلوم نیست", "Not decided")}
                </Button>
              ))}
            </div>
            {draft.timingKind === "date" ? (
              <Field label={bi("تاریخ آزمون", "Exam date")} htmlFor="date">
                <input id="date" type="date" className={inputClass()} value={draft.date} onChange={(event) => patch({ date: event.target.value })} />
              </Field>
            ) : null}
            {draft.timingKind === "window" ? (
              <Field label={bi("چند ماه دیگر", "Months from now")} htmlFor="months">
                <input id="months" className={inputClass()} value={draft.months} onChange={(event) => patch({ months: event.target.value })} inputMode="numeric" />
              </Field>
            ) : null}
            <Field label={bi("دقیقه در روز", "Minutes per day")} htmlFor="minutes">
              <input id="minutes" className={inputClass()} value={draft.dailyMinutes} onChange={(event) => patch({ dailyMinutes: event.target.value })} inputMode="numeric" />
            </Field>
            <Field label={bi("روز در هفته", "Days per week")} htmlFor="days">
              <input id="days" className={inputClass()} value={draft.daysPerWeek} onChange={(event) => patch({ daysPerWeek: event.target.value })} inputMode="numeric" />
            </Field>
          </div>
        ) : null}
        {draft.step === 5 ? (
          <div className="grid gap-2 text-sm leading-6">
            <p>{draft.examType === "academic" ? "Academic" : "General Training"} · {bi(REASONS[draft.reason].fa, REASONS[draft.reason].en)}</p>
            <p>{bi("هدف کلی", "Overall target")}: {draft.targetOverall || suggested} · {bi("پیشنهاد سیستم", "System suggestion")}: {formatBand(suggested, state.locale)}</p>
            <p>{bi("مطالعه", "Study")}: {draft.dailyMinutes} × {draft.daysPerWeek}</p>
            <p className="text-muted-foreground">{bi("گام بعد تعیین سطح است. تا تمام شدن هر چهار مهارت گزارشی ساخته نمی‌شود.", "Next is the placement. No report is built until all four skills are finished.")}</p>
          </div>
        ) : null}
        {error ? <p className="mt-4 text-sm text-destructive" role="alert">{error}</p> : null}
        <div className="mt-6 flex gap-2">
          {draft.step > 0 ? <Button type="button" variant="outline" onClick={() => patch({ step: draft.step - 1 })}>{bi("قبلی", "Back")}</Button> : null}
          {draft.step < 5 ? <Button type="button" onClick={next}>{bi("بعدی", "Next")}</Button> : <Button type="button" onClick={finish}>{bi("ذخیره و رفتن به تعیین سطح", "Save and open the placement")}</Button>}
        </div>
      </div>
    </div>
  );
}
