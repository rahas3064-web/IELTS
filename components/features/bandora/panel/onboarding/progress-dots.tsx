import { useT } from "@/src/i18n";

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
