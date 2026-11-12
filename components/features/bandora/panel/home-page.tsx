import Link from "@/components/link";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";
import { useFrame } from "@/components/features/bandora/panel/shell/frame-context";
import { CardSkeleton, EmptyState } from "@/components/features/bandora/panel/ui/states";

/** Honest Phase-1 home: real /api/me + /api/frame only; no invented scores or tasks. */
export function HomePage() {
  const { t } = useT();
  const { me } = useAuth();
  const { data, loading, failed } = useFrame();

  if (!me) return <CardSkeleton />;

  const name = `${me.user.firstName} ${me.user.lastName}`.trim() || me.user.firstName;
  const exam =
    me.profile?.examType === "academic"
      ? t("onboarding.exam.academic")
      : me.profile?.examType === "general"
        ? t("onboarding.exam.general")
        : null;
  const target = me.profile?.targetBand;

  return (
    <section className="bd-card bd-stack" aria-labelledby="home-title">
      <p className="bd-kicker">{t("home.kicker")}</p>
      <h2 id="home-title" className="bd-title">
        {t("home.title", { name })}
      </h2>
      <p className="bd-sub">{t("home.body")}</p>
      {exam ? <p className="bd-hint">{t("home.exam", { value: exam })}</p> : null}
      {target == null ? (
        <p className="bd-hint">{t("home.targetUnknown")}</p>
      ) : (
        <p className="bd-hint">{t("home.target", { n: target })}</p>
      )}
      {loading && !data ? <CardSkeleton /> : null}
      {failed && !data ? <EmptyState message={t("error.generic")} /> : null}
      {data ? (
        <p className="bd-hint">{t("home.plan", { done: data.planToday.done, total: data.planToday.total })}</p>
      ) : null}
      <Link href="/app/placement/intro" className="bd-btn bd-btn--solid">
        {t("home.placement")}
      </Link>
      <Link href="/app/practice" className="bd-btn bd-btn--outline">
        {t("home.practice")}
      </Link>
    </section>
  );
}
