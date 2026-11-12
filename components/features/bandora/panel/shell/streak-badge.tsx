import { Flame } from "lucide-react";
import { useT } from "@/src/i18n";
import type { FrameData } from "@/components/features/bandora/panel/shell/frame-context";

export function StreakBadge({ streak }: { streak: FrameData["streak"] }) {
  const { t, n } = useT();
  return (
    <p className="bd-streak" data-active={streak.activeToday ? "true" : "false"} title={t("streak.best", { n: streak.best })}>
      <Flame size={18} strokeWidth={1.6} aria-hidden />
      <span aria-hidden className="bd-num">{n(streak.current)}</span>
      <span className="bd-sr">{t("streak.label", { n: streak.current })}</span>
    </p>
  );
}
