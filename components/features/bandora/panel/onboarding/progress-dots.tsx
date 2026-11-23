import type { Ref } from "react";
import { useT } from "@/src/i18n";
import { BdIcon } from "@/components/features/bandora/panel/icons/bd-icon";

export function ProgressDots({ current, total }: { current: number; total: number }) {
  const { t } = useT();
  return (
    <ol className="bd-dots" aria-label={t("onboarding.progress", { current, total })}>
      {Array.from({ length: total }, (_, index) => {
        const position = index + 1;
        const state = position < current ? "done" : position === current ? "current" : "todo";
        return (
          <li key={position} className="bd-dots__dot" data-state={state} aria-current={state === "current" ? "step" : undefined}>
            <span className="bd-sr">{t("onboarding.step", { n: position })}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Top bar for intake screens: a 36px back hit target and an Estedad title. */
export function IntakeBar({
  title,
  onBack,
  headingRef,
}: {
  title: string;
  onBack?: () => void;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { t } = useT();
  return (
    <header className="bd-intake__bar">
      {onBack ? (
        <button type="button" className="bd-intake__back" onClick={onBack} aria-label={t("common.back")}>
          <BdIcon name="back-rtl" size={22} />
        </button>
      ) : (
        <span className="bd-intake__back" aria-hidden="true" />
      )}
      <h1 ref={headingRef} tabIndex={-1} className="bd-intake__title">{title}</h1>
    </header>
  );
}
