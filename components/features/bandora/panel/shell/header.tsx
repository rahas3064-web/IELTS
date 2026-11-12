import { useLocation } from "react-router-dom";
import { useT } from "@/src/i18n";
import { Logo } from "@/components/features/bandora/panel/ui/logo";
import { useFrame } from "@/components/features/bandora/panel/shell/frame-context";
import { pageTitleKey } from "@/components/features/bandora/panel/shell/nav-items";
import { ExamCountdown } from "@/components/features/bandora/panel/shell/exam-countdown";
import { StreakBadge } from "@/components/features/bandora/panel/shell/streak-badge";
import { NotificationsBell } from "@/components/features/bandora/panel/shell/notifications-bell";
import { AssistantButton } from "@/components/features/bandora/panel/shell/assistant-button";
import { AvatarMenu } from "@/components/features/bandora/panel/shell/avatar-menu";

/** Page title, exam countdown, streak, notifications, assistant and the avatar menu. */
export function Header() {
  const { t } = useT();
  const { pathname } = useLocation();
  const { data, loading } = useFrame();

  return (
    <header className="bd-header">
      <div className="bd-header__brand">
        <Logo />
      </div>
      <div className="bd-header__title">
        <h1 className="bd-header__h1">{t(pageTitleKey(pathname))}</h1>
        {data ? <ExamCountdown countdown={data.examCountdown} /> : loading ? <span className="bd-skel bd-skel--chip" aria-hidden /> : null}
      </div>
      <div className="bd-header__tools">
        {data ? <StreakBadge streak={data.streak} /> : null}
        <NotificationsBell />
        <AssistantButton />
        <AvatarMenu />
      </div>
    </header>
  );
}
