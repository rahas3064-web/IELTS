import { useEffect, useRef, useState } from "react";
import { api } from "@/src/lib/api-client";
import { errorText, fieldErrorText } from "@/src/lib/error-message";
import { useAuth } from "@/src/auth/auth-provider";
import type { Me } from "@/src/auth/types";
import { useT } from "@/src/i18n";
import { IntakeBar, ProgressDots } from "@/components/features/bandora/panel/onboarding/progress-dots";
import { StepExamType } from "@/components/features/bandora/panel/onboarding/step-exam-type";
import { StepTarget } from "@/components/features/bandora/panel/onboarding/step-target";
import { StepMode } from "@/components/features/bandora/panel/onboarding/step-habits";
import {
  emptyGoal,
  placementStep,
  tehranToday,
  validateGoal,
  type ExamType,
  type GoalDraft,
  type GoalErrors,
  type PlacementMode,
} from "@/components/features/bandora/panel/onboarding/onboarding-rules";

type StepNumber = 1 | 2 | 3;
const TOTAL = 3;
const TITLES: Record<StepNumber, string> = {
  1: "onboarding.exam.title",
  2: "onboarding.goal.title",
  3: "onboarding.mode.title",
};
const LEADS: Record<StepNumber, string> = {
  1: "onboarding.exam.lead",
  2: "onboarding.goal.lead",
  3: "onboarding.mode.lead",
};

function goalFrom(me: Me): GoalDraft {
  const profile = me.profile;
  const precision = profile?.examDatePrecision === "exact" || profile?.examDatePrecision === "unknown" ? profile.examDatePrecision : null;
  return {
    target: profile?.targetBand ?? null,
    precision,
    date: precision === "exact" ? profile?.examDate ?? "" : "",
  };
}

/** `/app/onboarding`: exam type, target and date, then placement length. Skip finishes without a mode. */
export function OnboardingPage() {
  const i18n = useT();
  const { t } = i18n;
  const { me, setMe } = useAuth();
  const start = (me?.onboarding.step ?? 1) as StepNumber;
  const [step, setStep] = useState<StepNumber>(start);
  const [examType, setExamType] = useState<ExamType | null>(me?.profile?.examType ?? null);
  const [goal, setGoal] = useState<GoalDraft>(() => (me ? goalFrom(me) : emptyGoal()));
  const [goalErrors, setGoalErrors] = useState<GoalErrors>({});
  const [mode, setMode] = useState<PlacementMode | null>(me?.profile?.placementMode ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const today = tehranToday(new Date());

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
      if (dateProblem) setGoalErrors({ examDate: dateProblem });
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
    } else if (step === 2) {
      const result = validateGoal(goal, today);
      if (!result.ok) {
        setGoalErrors(Object.fromEntries(Object.entries(result.errors).map(([field, key]) => [field, t(key)])));
        return;
      }
      setGoalErrors({});
      if (await save(result.payload)) setStep(3);
    } else if (step === 3 && mode) {
      await save(placementStep(mode));
    }
  }

  async function skip() {
    if (busy || step !== 3) return;
    await save(placementStep(null));
  }

  const ready = step === 1 ? examType !== null : step === 2 ? true : mode !== null;

  return (
    <main className="bd-intake">
      <IntakeBar title={t(TITLES[step])} headingRef={heading} onBack={step > 1 ? () => setStep((step - 1) as StepNumber) : undefined} />
      <ProgressDots current={step} total={TOTAL} />
      <p className="bd-intake__lead">{t(LEADS[step])}</p>
      <section className="bd-card bd-intake__card">
        {error ? <p className="bd-alert" role="alert">{error}</p> : null}
        {step === 1 ? <StepExamType value={examType} onChange={setExamType} /> : null}
        {step === 2 ? <StepTarget draft={goal} errors={goalErrors} today={today} onChange={setGoal} /> : null}
        {step === 3 ? <StepMode value={mode} onChange={setMode} /> : null}
      </section>
      <button type="button" className="bd-btn bd-btn--solid bd-btn--block" disabled={busy || !ready} onClick={() => void next()}>
        {busy ? t("common.saving") : step === TOTAL ? t("onboarding.continue") : t("common.next")}
      </button>
      {step === 3 ? (
        <button type="button" className="bd-intake__skip" disabled={busy} onClick={() => void skip()}>
          {t("onboarding.skip")}
        </button>
      ) : null}
    </main>
  );
}
