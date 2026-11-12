import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { api } from "@/src/lib/api-client";
import { errorText, fieldErrorText } from "@/src/lib/error-message";
import { useAuth } from "@/src/auth/auth-provider";
import type { Me } from "@/src/auth/types";
import { useT } from "@/src/i18n";
import { Logo } from "@/components/features/bandora/panel/ui/logo";
import { ProgressDots } from "@/components/features/bandora/panel/onboarding/progress-dots";
import { StepExamType } from "@/components/features/bandora/panel/onboarding/step-exam-type";
import { StepTarget } from "@/components/features/bandora/panel/onboarding/step-target";
import { StepHabits } from "@/components/features/bandora/panel/onboarding/step-habits";
import {
  emptyHabits,
  tehranToday,
  validateHabits,
  type ExamType,
  type HabitsDraft,
  type HabitsErrors,
} from "@/components/features/bandora/panel/onboarding/onboarding-rules";

type StepNumber = 1 | 2 | 3;
const TOTAL = 3;
const TITLES: Record<StepNumber, string> = { 1: "onboarding.exam.title", 2: "onboarding.target.title", 3: "onboarding.habits.title" };

function habitsFrom(me: Me): HabitsDraft {
  const profile = me.profile;
  const precision = profile?.examDatePrecision ?? null;
  const date = profile?.examDate ?? "";
  return {
    precision,
    date: precision === "approx" ? date.slice(0, 7) : precision === "exact" ? date : "",
    dailyMinutes: profile?.dailyMinutes ?? null,
    studyDays: profile?.studyDays ?? [],
  };
}

/** `/app/onboarding`: three steps, each saved to the server; resumes where the server says. */
export function OnboardingPage() {
  const i18n = useT();
  const { t } = i18n;
  const { me, setMe } = useAuth();
  const start = (me?.onboarding.step ?? 1) as StepNumber;
  const [step, setStep] = useState<StepNumber>(start);
  const [examType, setExamType] = useState<ExamType | null>(me?.profile?.examType ?? null);
  const [target, setTarget] = useState<number | null | undefined>(
    me?.profile?.targetBand ?? (start >= 3 ? null : undefined),
  );
  const [habits, setHabits] = useState<HabitsDraft>(() => (me ? habitsFrom(me) : emptyHabits()));
  const [habitErrors, setHabitErrors] = useState<HabitsErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) first.current = false;
    else heading.current?.focus();
  }, [step]);

  async function save(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      setMe(await api.put<Me>("/api/onboarding", payload));
      return true;
    } catch (failure) {
      const dateProblem = fieldErrorText(failure, "examDate", i18n);
      if (dateProblem) setHabitErrors({ examDate: dateProblem });
      else setError(errorText(failure, i18n));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (busy) return;
    if (step === 1 && examType) {
      if (await save({ step: 1, examType })) setStep(2);
    } else if (step === 2 && target !== undefined) {
      if (await save({ step: 2, targetBand: target })) setStep(3);
    } else if (step === 3) {
      const result = validateHabits(habits, tehranToday(new Date()));
      if (!result.ok) {
        setHabitErrors(Object.fromEntries(Object.entries(result.errors).map(([field, key]) => [field, t(key)])));
        return;
      }
      setHabitErrors({});
      // The guard on this route sends a freshly finished user on to the placement intro.
      await save(result.payload);
    }
  }

  const ready = step === 1 ? examType !== null : step === 2 ? target !== undefined : true;

  return (
    <main className="bd-auth bd-auth--wide">
      <Logo href="/" />
      <ProgressDots current={step} total={TOTAL} />
      <section className="bd-card bd-auth__card" aria-labelledby="onboarding-title">
        <p className="bd-kicker">{t("onboarding.progress", { current: step, total: TOTAL })}</p>
        <h1 id="onboarding-title" ref={heading} tabIndex={-1} className="bd-title">{t(TITLES[step])}</h1>
        {error ? (
          <p className="bd-alert" role="alert">
            <AlertCircle size={16} strokeWidth={1.6} aria-hidden /> {error}
          </p>
        ) : null}
        {step === 1 ? <StepExamType value={examType} onChange={setExamType} /> : null}
        {step === 2 ? <StepTarget value={target} onChange={setTarget} /> : null}
        {step === 3 ? (
          <StepHabits draft={habits} errors={habitErrors} today={tehranToday(new Date())} onChange={setHabits} />
        ) : null}
        <div className="bd-auth__actions">
          {step > 1 ? (
            <button type="button" className="bd-btn bd-btn--outline" disabled={busy} onClick={() => setStep((step - 1) as StepNumber)}>
              {t("common.back")}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="bd-btn bd-btn--solid" disabled={busy || !ready} onClick={() => void next()}>
            {busy ? t("common.saving") : step === TOTAL ? t("onboarding.finish") : t("common.next")}
          </button>
        </div>
      </section>
    </main>
  );
}
