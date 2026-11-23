import { useId } from "react";
import { useT } from "@/src/i18n";
import { TARGET_BANDS, minExactDate, type DatePrecision, type GoalDraft, type GoalErrors } from "@/components/features/bandora/panel/onboarding/onboarding-rules";

const PRECISIONS: readonly DatePrecision[] = ["exact", "unknown"];

function Problem({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="bd-error" role="alert">
      <span>{message}</span>
    </p>
  );
}

export function StepTarget({
  draft,
  errors,
  today,
  onChange,
}: {
  draft: GoalDraft;
  errors: GoalErrors;
  today: string;
  onChange: (next: GoalDraft) => void;
}) {
  const { t, digits } = useT();
  const dateId = useId();
  const patch = (partial: Partial<GoalDraft>) => onChange({ ...draft, ...partial });
  const dateError = errors.examDate ? `${dateId}-error` : undefined;

  return (
    <>
      <fieldset className="bd-group">
        <legend className="bd-legend">{t("onboarding.target.title")}</legend>
        <div className="bd-chips">
          {TARGET_BANDS.map((band) => (
            <button
              key={band}
              type="button"
              className="bd-chip bd-chip--pick"
              aria-pressed={draft.target === band}
              onClick={() => patch({ target: band })}
            >
              <span className="bd-num">{digits(band.toFixed(1))}</span>
            </button>
          ))}
        </div>
        <Problem id={`${dateId}-target`} message={errors.target} />
      </fieldset>
      <fieldset className="bd-group">
        <legend className="bd-legend">{t("onboarding.date.title")}</legend>
        <div className="bd-choices">
          {PRECISIONS.map((precision) => (
            <label key={precision} className="bd-choice">
              <input
                type="radio"
                name="exam-date-precision"
                className="bd-sr"
                checked={draft.precision === precision}
                onChange={() => patch({ precision, date: precision === "exact" ? draft.date : "" })}
              />
              <span className="bd-choice__title">{t(`onboarding.date.${precision}`)}</span>
            </label>
          ))}
        </div>
        <Problem id={`${dateId}-precision`} message={errors.precision} />
        {draft.precision === "exact" ? (
          <div className="bd-field bd-field--inline">
            <label htmlFor={dateId}>{t("onboarding.date.exactLabel")}</label>
            <input
              id={dateId}
              className="bd-input bd-input--ltr"
              dir="ltr"
              type="date"
              min={minExactDate(today)}
              value={draft.date}
              aria-invalid={errors.examDate ? true : undefined}
              aria-describedby={dateError}
              onChange={(event) => patch({ date: event.target.value })}
            />
            <Problem id={`${dateId}-error`} message={errors.examDate} />
          </div>
        ) : null}
      </fieldset>
    </>
  );
}
