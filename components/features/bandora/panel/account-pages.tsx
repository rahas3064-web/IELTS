import Link from "@/components/link";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";
import { CardSkeleton, EmptyState } from "@/components/features/bandora/panel/ui/states";

/** Sections that must not show a band until a human publishes content. */
export function UnpublishedSection({ titleKey }: { titleKey: string }) {
  const { t } = useT();
  return (
    <section className="bd-card bd-stack" aria-labelledby="section-title">
      <h2 id="section-title" className="bd-title">{t(titleKey)}</h2>
      <EmptyState message={t("section.unpublished")} actionHref="/app" actionLabel={t("section.back")} />
    </section>
  );
}

export function ProfilePage() {
  const { t } = useT();
  const { me } = useAuth();
  if (!me) return <CardSkeleton />;
  const { user } = me;
  return (
    <section className="bd-card bd-stack" aria-labelledby="profile-title">
      <h2 id="profile-title" className="bd-title">{t("nav.profile")}</h2>
      <p>{user.firstName} {user.lastName}</p>
      <p>{t("profile.phone")}: <span dir="ltr">{user.phone}</span></p>
      <p>{t("profile.email")}: {user.email ?? t("profile.none")}</p>
      <Link href="/app" className="bd-btn bd-btn--outline">{t("section.back")}</Link>
    </section>
  );
}

// The subscription page lives in ./subscription (plans, quotas, checkout).
export { SubscriptionPage } from "@/components/features/bandora/panel/subscription/subscription-page";
