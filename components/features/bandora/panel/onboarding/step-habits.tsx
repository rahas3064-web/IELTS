import { useT } from "@/src/i18n";
import { PLACEMENT_TIMES, type PlacementMode } from "@/components/features/bandora/panel/onboarding/onboarding-rules";

const OPTIONS: readonly { value: PlacementMode; title: string; body: string }[] = [
  { value: "quick", title: "onboarding.mode.quick", body: "onboarding.mode.quickBody" },
  { value: "full", title: "onboarding.mode.full", body: "onboarding.mode.fullBody" },
];

/** Placement length. Replaces the old habits step. */
export function StepMode({ value, onChange }: { value: PlacementMode | null; onChange: (value: PlacementMode) => void }) {
  const { t } = useT();
  return (
    <fieldset className="bd-group">
      <legend className="bd-sr">{t("onboarding.mode.title")}</legend>
      <div className="bd-choices">
        {OPTIONS.map((option) => (
          <label key={option.value} className="bd-choice">
            <input
              type="radio"
              name="placement-mode"
              className="bd-sr"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="bd-choice__title">{t(option.title)}</span>
            <span className="bd-choice__body">{t(option.body, { n: PLACEMENT_TIMES[option.value].total })}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
