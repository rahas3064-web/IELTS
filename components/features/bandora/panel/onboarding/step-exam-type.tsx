import { useT } from "@/src/i18n";
import type { ExamType } from "@/components/features/bandora/panel/onboarding/onboarding-rules";

const OPTIONS: readonly { value: ExamType; title: string; body: string }[] = [
  { value: "academic", title: "onboarding.exam.academic", body: "onboarding.exam.academicBody" },
  { value: "general", title: "onboarding.exam.general", body: "onboarding.exam.generalBody" },
];

export function StepExamType({ value, onChange }: { value: ExamType | null; onChange: (value: ExamType) => void }) {
  const { t } = useT();
  return (
    <fieldset className="bd-group">
      <legend className="bd-sr">{t("onboarding.exam.title")}</legend>
      <div className="bd-choices">
        {OPTIONS.map((option) => (
          <label key={option.value} className="bd-choice">
            <input
              type="radio"
              name="exam-type"
              className="bd-sr"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="bd-choice__title">{t(option.title)}</span>
            <span className="bd-choice__body">{t(option.body)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
