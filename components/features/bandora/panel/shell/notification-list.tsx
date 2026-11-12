import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useT, type Locale } from "@/src/i18n";
import type { NotificationItem } from "@/components/features/bandora/panel/shell/use-notifications";

/** Persian users see Jalali dates (Tehran time); English users see Gregorian. */
export function formatWhen(iso: string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
    timeZone: "Asia/Tehran",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

/** Only in-app paths are followed; anything else a notification carries is ignored. */
export function internalLink(link: string | null): string | null {
  return link && link.startsWith("/") && !link.startsWith("//") && !link.includes("\\") ? link : null;
}

type ListProps = {
  items: readonly NotificationItem[];
  onRead: (id: string) => Promise<void>;
  /** Called after an item was opened (the dropdown closes itself here). */
  onOpened?: () => void;
};

export function NotificationList({ items, onRead, onOpened }: ListProps) {
  const { t, locale } = useT();
  const navigate = useNavigate();

  async function open(item: NotificationItem) {
    if (!item.readAt) {
      try {
        await onRead(item.id);
      } catch {
        toast.error(t("notifications.readError"));
      }
    }
    const target = internalLink(item.link);
    if (target) navigate(target);
    onOpened?.();
  }

  return (
    <ul className="bd-notices">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" className="bd-notice" data-unread={item.readAt ? "false" : "true"} onClick={() => void open(item)}>
            <span className="bd-notice__title">
              {item.readAt ? null : <span className="bd-sr">{t("notifications.unread")}: </span>}
              {item.title}
            </span>
            <span className="bd-notice__body">{item.body}</span>
            <time className="bd-hint" dateTime={item.createdAt}>{formatWhen(item.createdAt, locale)}</time>
          </button>
        </li>
      ))}
    </ul>
  );
}
