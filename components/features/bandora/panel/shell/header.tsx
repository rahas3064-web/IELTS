import { useLocation } from "react-router-dom";
import { useT } from "@/src/i18n";
import { useAuth } from "@/src/auth/auth-provider";
import { BdIcon } from "@/components/features/bandora/panel/icons/bd-icon";
import { useFrame } from "@/components/features/bandora/panel/shell/frame-context";
import { pageTitleKey } from "@/components/features/bandora/panel/shell/nav-items";
import { ExamCountdown } from "@/components/features/bandora/panel/shell/exam-countdown";
import { StreakBadge } from "@/components/features/bandora/panel/shell/streak-badge";
import { NotificationsBell } from "@/components/features/bandora/panel/shell/notifications-bell";
import { AvatarMenu } from "@/components/features/bandora/panel/shell/avatar-menu";

/** Greeting and the day's stats. Other routes keep a title. More and notifications stay here. */
export function Header({ onMore }: { onMore: () => void }) {
  const { t, digits } = useT();
  const { pathname } = useLocation();
  const { me } = useAuth();
  const { data, loading } = useFrame();
  const home = pathname === "/app" || pathname === "/app/";
  const goal = data?.dailyGoal ?? { done: 0, total: 3 };

  return (
    <header className="bd-header">
      <div className="bd-header__title">
        <h1 className="bd-header__h1">{home ? t("home.title", { name: me?.user.firstName ?? "" }) : t(pageTitleKey(pathname))}</h1>
        {!home && data ? <ExamCountdown countdown={data.examCountdown} /> : null}
      </div>
      <div className="bd-header__tools">
        {data ? <StreakBadge streak={data.streak} /> : loading ? <span className="bd-skel bd-skel--chip" aria-hidden /> : null}
        <p className="bd-goal">
          <BdIcon name="daily-goal" />
          <span>{digits(goal.done)} {t("home.goalOf")} {digits(goal.total)}</span>
        </p>
        <NotificationsBell />
        <button type="button" className="bd-header__more" aria-label={t("nav.more")} onClick={onMore}>
          <BdIcon name="settings" size={22} />
        </button>
        <AvatarMenu />
      </div>
    </header>
  );
}
