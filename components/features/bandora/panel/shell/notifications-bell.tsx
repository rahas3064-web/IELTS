import { useId } from "react";
import { Bell } from "lucide-react";
import Link from "@/components/link";
import { toast } from "sonner";
import { useT } from "@/src/i18n";
import { ErrorState } from "@/components/features/bandora/panel/ui/states";
import { useFrame } from "@/components/features/bandora/panel/shell/frame-context";
import { NotificationList } from "@/components/features/bandora/panel/shell/notification-list";
import { useNotifications } from "@/components/features/bandora/panel/shell/use-notifications";
import { usePopover } from "@/components/features/bandora/panel/shell/use-popover";

const DROPDOWN_LIMIT = 20;
const BADGE_CAP = 99;

function Dropdown({ onClose, id }: { onClose: () => void; id: string }) {
  const { t } = useT();
  const list = useNotifications();
  const items = list.items.slice(0, DROPDOWN_LIMIT);
  const hasUnread = items.some((item) => !item.readAt);

  async function readAll() {
    try {
      await list.markAll();
    } catch {
      toast.error(t("notifications.readError"));
    }
  }

  return (
    <div className="bd-pop" id={id} role="region" aria-label={t("notifications.title")}>
      <div className="bd-pop__head">
        <h2 className="bd-pop__title">{t("notifications.title")}</h2>
        <button type="button" className="bd-linkbtn" disabled={!hasUnread} onClick={() => void readAll()}>
          {t("notifications.readAll")}
        </button>
      </div>
      {list.loading && items.length === 0 ? (
        <div className="bd-stack" aria-busy="true" aria-label={t("state.loading")}>
          <span className="bd-skel" />
          <span className="bd-skel" />
        </div>
      ) : list.failed ? (
        <ErrorState message={t("notifications.loadError")} onRetry={() => void list.reload()} />
      ) : items.length === 0 ? (
        <p className="bd-muted bd-pop__empty">{t("notifications.empty")}</p>
      ) : (
        <NotificationList items={items} onRead={list.markRead} onOpened={onClose} />
      )}
      <Link href="/app/notifications" className="bd-pop__all" onClick={onClose}>
        {t("notifications.viewAll")}
      </Link>
    </div>
  );
}

export function NotificationsBell() {
  const { t, n } = useT();
  const { data } = useFrame();
  const popover = usePopover();
  const panelId = useId();
  const unread = data?.unreadCount ?? 0;
  const label = unread > 0 ? t("notifications.bellUnread", { n: unread }) : t("notifications.bell");

  return (
    <div className="bd-pop-wrap" ref={popover.wrap}>
      <button
        type="button"
        className="bd-iconbtn"
        data-popover-trigger
        aria-label={label}
        aria-expanded={popover.open}
        aria-controls={popover.open ? panelId : undefined}
        onClick={popover.toggle}
      >
        <Bell size={18} strokeWidth={1.6} aria-hidden />
        {unread > 0 ? (
          <span className="bd-badge" data-testid="unread-badge" aria-hidden>
            {unread > BADGE_CAP ? `${n(BADGE_CAP)}+` : n(unread)}
          </span>
        ) : null}
      </button>
      {popover.open ? <Dropdown id={panelId} onClose={popover.close} /> : null}
    </div>
  );
}
