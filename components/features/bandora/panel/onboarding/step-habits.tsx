import { useId } from "react";
import { AlertCircle } from "lucide-react";
import { useT } from "@/src/i18n";
import {
  DAILY_MINUTES,
  WEEKDAY_IDS,
  minApproxMonth,
  minExactDate,
  toggleDay,
  type DatePrecision,
  type HabitsDraft,
  type HabitsErrors,
} from "@/components/features/bandora/panel/onboarding/onboarding-rules";

const PRECISIONS: readonly DatePrecision[] = ["exact", "approx", "unknown"];

function Problem({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="bd-error" role="alert">
      <AlertCircle size={16} strokeWidth={1.6} aria-hidden />
      <span>{message}</span>
    </p>
  );
}

type StepHabitsProps = {
  draft: HabitsDraft;
  errors: HabitsErrors;
  today: string;
  onChange: (next: HabitsDraft) => void;
};

export function StepHabits({ draft, errors, today, onChange }: StepHabitsProps) {
  const { t } = useT();
  const dateId = useId();
  const patch = (partial: Partial<HabitsDraft>) => onChange({ ...draft, ...partial });
  const dateError = errors.examDate ? `${dateId}-error` : undefined;

  return (
    <>
      <fieldset className="bd-group">
        <legend className="bd-legend">{t("onboarding.date.title")}</legend>
        <div className="bd-chips">
          {PRECISIONS.map((precision) => (
            <label key={precision} className="bd-chip bd-chip--radio" data-checked={draft.precision === precision}>
              <input
                type="radio"
                name="exam-date-precision"
                className="bd-sr"
                checked={draft.precision === precision}
                onChange={() => patch({ precision, date: precision === draft.precision ? draft.date : "" })}
              />
              {t(`onboarding.date.${precision}`)}
            </label>
          ))}
        </div>
        <Problem id={`${dateId}-precision`} message={errors.precision} />
        {draft.precision === "exact" || draft.precision === "approx" ? (
          <div className="bd-field bd-field--inline">
            <label htmlFor={dateId}>{t(draft.precision === "exact" ? "onboarding.date.exactLabel" : "onboarding.date.approxLabel")}</label>
            <input
              id={dateId}
              className="bd-input bd-input--ltr"
              dir="ltr"
              type={draft.precision === "exact" ? "date" : "month"}
              min={draft.precision === "exact" ? minExactDate(today) : minApproxMonth(today)}
              value={draft.date}
              aria-invalid={errors.examDate ? true : undefined}
              aria-describedby={dateError}
              onChange={(event) => patch({ date: event.target.value })}
            />
            <Problem id={`${dateId}-error`} message={errors.examDate} />
          </div>
        ) : null}
      </fieldset>

      <fieldset className="bd-group">
        <legend className="bd-legend">{t("onboarding.minutes.title")}</legend>
        <div className="bd-chips">
          {DAILY_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="bd-chip"
              aria-pressed={draft.dailyMinutes === minutes}
              onClick={() => patch({ dailyMinutes: minutes })}
            >
              {t("onboarding.minutes.chip", { n: minutes })}
            </button>
          ))}
        </div>
        <Problem id={`${dateId}-minutes`} message={errors.dailyMinutes} />
      </fieldset>

      <fieldset className="bd-group">
        <legend className="bd-legend">{t("onboarding.days.title")}</legend>
        <div className="bd-chips">
          {WEEKDAY_IDS.map((day) => (
            <button
              key={day}
              type="button"
              className="bd-chip"
              aria-pressed={draft.studyDays.includes(day)}
              onClick={() => patch({ studyDays: toggleDay(draft.studyDays, day) })}
            >
              {t(`onboarding.day.${day}`)}
            </button>
          ))}
        </div>
        <p className="bd-hint">{t("onboarding.days.count", { n: draft.studyDays.length })}</p>
        <Problem id={`${dateId}-days`} message={errors.studyDays} />
      </fieldset>
    </>
  );
}
