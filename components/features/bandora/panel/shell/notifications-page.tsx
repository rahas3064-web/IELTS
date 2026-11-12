import { toast } from "sonner";
import { useT } from "@/src/i18n";
import { EmptyState, ErrorState, CardSkeleton } from "@/components/features/bandora/panel/ui/states";
import { NotificationList } from "@/components/features/bandora/panel/shell/notification-list";
import { useNotifications } from "@/components/features/bandora/panel/shell/use-notifications";

/** `/app/notifications`: every notification, newest first, with cursor paging. */
export function NotificationsPage() {
  const { t } = useT();
  const list = useNotifications();
  const hasUnread = list.items.some((item) => !item.readAt);

  async function readAll() {
    try {
      await list.markAll();
    } catch {
      toast.error(t("notifications.readError"));
    }
  }

  if (list.loading && list.items.length === 0) return <CardSkeleton />;
  return (
    <section className="bd-card" aria-labelledby="notifications-title">
      <div className="bd-card__head">
        <h2 id="notifications-title" className="bd-title">{t("notifications.title")}</h2>
        <button type="button" className="bd-btn bd-btn--outline" disabled={!hasUnread} onClick={() => void readAll()}>
          {t("notifications.readAll")}
        </button>
      </div>
      {list.failed && list.items.length === 0 ? (
        <ErrorState message={t("notifications.loadError")} onRetry={() => void list.reload()} />
      ) : list.items.length === 0 ? (
        <EmptyState message={t("notifications.empty")} />
      ) : (
        <>
          <NotificationList items={list.items} onRead={list.markRead} />
          {list.failed ? <ErrorState message={t("notifications.loadError")} onRetry={() => void list.loadMore()} /> : null}
          {list.nextCursor ? (
            <button type="button" className="bd-btn bd-btn--outline bd-more" disabled={list.loading} onClick={() => void list.loadMore()}>
              {t("notifications.more")}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
