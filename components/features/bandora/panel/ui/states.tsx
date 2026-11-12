import { AlertCircle } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/src/i18n";

export function CardSkeleton() {
  const { t } = useT();
  return (
    <section className="bd-card bd-stack" aria-busy="true" aria-label={t("state.loading")}>
      <span className="bd-skel bd-skel--title" />
      <span className="bd-skel" />
      <span className="bd-skel bd-skel--tall" />
    </section>
  );
}

export function FullPageSkeleton() {
  return (
    <div className="bd-boot">
      <CardSkeleton />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div className="bd-state" role="alert">
      <p className="bd-error">
        <AlertCircle size={16} strokeWidth={1.6} aria-hidden />
        <span>{message}</span>
      </p>
      {onRetry ? (
        <button type="button" className="bd-btn bd-btn--outline" onClick={onRetry}>
          {t("state.retry")}
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({ message, actionHref, actionLabel }: { message: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="bd-state">
      <p className="bd-muted">{message}</p>
      {actionHref && actionLabel ? <Link href={actionHref} className="bd-btn bd-btn--outline">{actionLabel}</Link> : null}
    </div>
  );
}

/** Clean "coming soon" page for sections that are not built yet. */
export function PagePlaceholder({ titleKey, showBack = true }: { titleKey: string; showBack?: boolean }) {
  const { t } = useT();
  return (
    <section className="bd-card bd-placeholder" aria-labelledby="placeholder-title">
      <p className="bd-kicker">{t("placeholder.soon")}</p>
      <h2 id="placeholder-title" className="bd-title">{t(titleKey)}</h2>
      <p className="bd-sub">{t("placeholder.body")}</p>
      {showBack ? <Link href="/app" className="bd-btn bd-btn--outline">{t("placeholder.back")}</Link> : null}
    </section>
  );
}
