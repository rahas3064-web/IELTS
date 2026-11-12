import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/src/i18n";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { CardSkeleton, ErrorState } from "@/components/features/bandora/panel/ui/states";
import {
  QUOTA_KEYS, checkoutNoticeKey, formatDate, planName, premiumPlans, usagePercent,
  type BillingPlan, type BillingSummary, type PlansResponse,
} from "@/components/features/bandora/panel/subscription/subscription-model";

type Loaded = { summary: BillingSummary; plans: PlansResponse };

/** `/app/subscription`: current plan, this month's quotas, and the premium plans. */
export function SubscriptionPage() {
  const i18n = useT();
  const { t } = i18n;
  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [summary, plans] = await Promise.all([
        api.get<BillingSummary>("/api/billing"),
        api.get<PlansResponse>("/api/billing/plans"),
      ]);
      setData({ summary, plans });
    } catch (error) {
      setLoadError(error);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  if (loadError && !data) {
    return (
      <section className="bd-card" aria-labelledby="sub-title">
        <h2 id="sub-title" className="bd-title">{t("nav.subscription")}</h2>
        <ErrorState message={errorText(loadError, i18n)} onRetry={() => void load()} />
      </section>
    );
  }
  if (!data) return <CardSkeleton />;

  const { summary, plans } = data;
  const notice = checkoutNoticeKey(summary.checkout);
  return (
    <div className="bd-sub-page">
      <CurrentPlan summary={summary} plans={plans.plans} />
      <UsageCard summary={summary} />
      <section className="bd-card bd-stack" aria-labelledby="sub-plans-title">
        <h2 id="sub-plans-title" className="bd-title">{t("subscription.plans.title")}</h2>
        {summary.checkout.available ? (
          <p className="bd-hint">{t("subscription.payInBale")}</p>
        ) : notice ? (
          <p className="bd-alert bd-alert--info" role="note">{t(notice)}</p>
        ) : null}
        <div className="bd-plan-grid">
          {premiumPlans(plans.plans).map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              current={summary.subscription.plan === plan.key}
              savingsPercent={plan.key === "premium_quarterly" ? plans.quarterlySavingsPercent : null}
            />
          ))}
        </div>
        <Link href="/app" className="bd-btn bd-btn--outline bd-sub-back">{t("section.back")}</Link>
      </section>
    </div>
  );
}

function CurrentPlan({ summary, plans }: { summary: BillingSummary; plans: BillingPlan[] }) {
  const { t, locale } = useT();
  const { subscription } = summary;
  const name = subscription.plan === "free"
    ? t("subscription.free")
    : planName(plans.find((p) => p.key === subscription.plan), locale) ?? subscription.plan;
  return (
    <section className="bd-card bd-stack" aria-labelledby="sub-title">
      <p className="bd-kicker">{t("subscription.kicker")}</p>
      <h2 id="sub-title" className="bd-title">{t("nav.subscription")}</h2>
      <dl className="bd-sub-facts">
        <div>
          <dt>{t("subscription.plan")}</dt>
          <dd>
            {name}
            {subscription.status !== "free" ? (
              <span className="bd-sub-badge" data-status={subscription.status}>{t(`subscription.status.${subscription.status}`)}</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>{t("subscription.ends")}</dt>
          <dd>{subscription.endsAt ? formatDate(subscription.endsAt, locale) : t("subscription.none")}</dd>
        </div>
        {subscription.status === "grace" && subscription.graceEndsAt ? (
          <div>
            <dt>{t("subscription.graceEnds")}</dt>
            <dd>{formatDate(subscription.graceEndsAt, locale)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}

function UsageCard({ summary }: { summary: BillingSummary }) {
  const { t, locale } = useT();
  const rows = QUOTA_KEYS.map((key) => summary.usage.quotas.find((q) => q.key === key)).filter(Boolean);
  return (
    <section className="bd-card bd-stack" aria-labelledby="sub-usage-title">
      <h2 id="sub-usage-title" className="bd-title bd-title--sm">{t("subscription.usage.title")}</h2>
      <ul className="bd-usage">
        {rows.map((row) => {
          if (!row) return null;
          const percent = usagePercent(row);
          const label = t(`subscription.quota.${row.key}`);
          return (
            <li key={row.key} className="bd-usage__row">
              <div className="bd-usage__head">
                <span>{label}</span>
                <span className="bd-muted">
                  {row.limit === null
                    ? t("subscription.usage.unset")
                    : row.limit === 0
                      ? t("subscription.usage.notIncluded")
                      : t("subscription.usage.count", { used: row.used, limit: row.limit })}
                </span>
              </div>
              <div
                className="bd-usage__bar"
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={row.limit ?? 0}
                aria-valuenow={Math.min(row.used, row.limit ?? 0)}
                data-full={percent >= 100 ? "true" : undefined}
              >
                <span style={{ width: `${percent}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="bd-hint">{t("subscription.usage.reset", { date: formatDate(summary.usage.resetsAt, locale) })}</p>
    </section>
  );
}

function PlanCard({ plan, current, savingsPercent }: { plan: BillingPlan; current: boolean; savingsPercent: number | null }) {
  const i18n = useT();
  const { t, locale } = i18n;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const featured = plan.key === "premium_quarterly";

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const started = await api.post<{ url?: string }>("/api/billing/checkout", { planKey: plan.key });
      // A future payment adapter returns where to pay; access changes only after the server verifies payment.
      if (started && typeof started.url === "string" && started.url.startsWith("https://")) window.location.assign(started.url);
    } catch (caught) {
      setError(errorText(caught, i18n));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="bd-plan" data-featured={featured ? "true" : undefined} aria-labelledby={`plan-${plan.key}`}>
      <h3 id={`plan-${plan.key}`} className="bd-plan__name">{planName(plan, locale)}</h3>
      <p className="bd-plan__price">
        {plan.price
          ? t("subscription.price.toman", { amount: plan.price.amountToman })
          : <span className="bd-plan__unset">{t("subscription.price.unset")}</span>}
      </p>
      <p className="bd-plan__meta">
        {plan.durationDays ? t("subscription.duration", { days: plan.durationDays }) : null}
        {savingsPercent ? <span className="bd-plan__save">{t("subscription.savings", { percent: savingsPercent })}</span> : null}
      </p>
      <div className="bd-plan__rule" />
      <ul className="bd-plan__list">
        {QUOTA_KEYS.map((key) => (plan.quotas[key] ? (
          <li key={key}>
            <Check size={18} strokeWidth={2} aria-hidden />
            {t("subscription.quotaLine", { count: plan.quotas[key] ?? 0, label: t(`subscription.quota.${key}`) })}
          </li>
        ) : null))}
      </ul>
      <button type="button" className={`bd-btn bd-btn--block ${featured ? "bd-btn--cream" : "bd-btn--solid"}`} disabled={busy} onClick={() => void buy()}>
        {busy ? t("subscription.buying") : current ? t("subscription.renew") : t("subscription.buy")}
      </button>
      {error ? (
        <p className="bd-error bd-plan__error" role="alert">
          <AlertCircle size={16} strokeWidth={1.6} aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </article>
  );
}
