import { useT } from "@/src/i18n";
import { TARGET_BANDS } from "@/components/features/bandora/panel/onboarding/onboarding-rules";

type TargetValue = number | null | undefined;

/** `undefined` = nothing chosen yet; `null` = "I don't know" (stored as null on the server). */
export function StepTarget({ value, onChange }: { value: TargetValue; onChange: (value: number | null) => void }) {
  const { t, digits } = useT();
  return (
    <fieldset className="bd-group">
      <legend className="bd-sr">{t("onboarding.target.title")}</legend>
      <div className="bd-chips">
        {TARGET_BANDS.map((band) => (
          <button
            key={band}
            type="button"
            className="bd-chip"
            aria-pressed={value === band}
            onClick={() => onChange(band)}
          >
            <span className="bd-num">{digits(band)}</span>
          </button>
        ))}
        <button type="button" className="bd-chip" aria-pressed={value === null} onClick={() => onChange(null)}>
          {t("onboarding.target.unknown")}
        </button>
      </div>
    </fieldset>
  );
}
