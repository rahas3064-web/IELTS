import Link from "@/components/link";
import { CalendarClock } from "lucide-react";
import { useT } from "@/src/i18n";
import type { FrameData } from "@/components/features/bandora/panel/shell/frame-context";

const GOAL_LINK = "/app/profile#exam-goal";

/** Days to the exam, or a link to set the date when there is none (or it has passed). */
export function ExamCountdown({ countdown }: { countdown: FrameData["examCountdown"] }) {
  const { t } = useT();
  const { days, precision, past } = countdown;

  if (days === null || past) {
    return (
      <Link href={GOAL_LINK} className="bd-countdown bd-countdown--link">
        <CalendarClock size={16} strokeWidth={1.6} aria-hidden />
        <span>{t(past ? "countdown.past" : "countdown.set")}</span>
      </Link>
    );
  }
  const key = days === 0 ? "countdown.today" : precision === "approx" ? "countdown.approx" : "countdown.days";
  return (
    <p className="bd-countdown">
      <CalendarClock size={16} strokeWidth={1.6} aria-hidden />
      <span>{t(key, { n: days })}</span>
    </p>
  );
}
