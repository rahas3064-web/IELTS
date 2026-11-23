import { useT } from "@/src/i18n";
import { BdIcon } from "@/components/features/bandora/panel/icons/bd-icon";
import type { FrameData } from "@/components/features/bandora/panel/shell/frame-context";

export function StreakBadge({ streak }: { streak: FrameData["streak"] }) {
  const { t, digits } = useT();
  return (
    <p className="bd-streak" data-active={streak.activeToday ? "true" : "false"} title={t("streak.best", { n: streak.best })}>
      <BdIcon name="streak-flame" />
      <span className="bd-num">{digits(streak.current)} {t("home.days")}</span>
      <span className="bd-sr">{t("streak.label", { n: streak.current })}</span>
    </p>
  );
}
