import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { FullPageSkeleton } from "@/components/features/bandora/panel/ui/states";
import { api, ApiClientError } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useT } from "@/src/i18n";

type ReviewItem = { id: string; skill: string; stem: { prompt: string }; answerKey?: { correct?: string }; status: string };
type ReviewSet = { id: string; skill: string; title_fa: string; is_free: boolean };
type ReviewVersion = { id: string; exam_type: string; version_no: number };

/** `/admin/review`: human approve or reject. Nothing here auto-publishes. */
export function AdminReviewPage() {
  const i18n = useT();
  const { t } = i18n;
  const [data, setData] = useState<{ items: ReviewItem[]; sets: ReviewSet[]; versions: ReviewVersion[] } | null | undefined>(undefined);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<{ items: ReviewItem[]; sets: ReviewSet[]; versions: ReviewVersion[] }>("/api/admin/review", { handleAuth: false })
      .then(setData)
      .catch((caught) => {
        if (caught instanceof ApiClientError && (caught.status === 401 || caught.status === 403)) setData(null);
        else setError(errorText(caught, i18n));
      });
  }

  useEffect(load, [i18n]);

  async function act(path: string, body?: unknown) {
    setError(null);
    try {
      await api.post(path, body ?? {}, { handleAuth: false });
      load();
    } catch (caught) {
      setError(errorText(caught, i18n));
    }
  }

  if (data === undefined) return <FullPageSkeleton />;
  if (data === null) return <Navigate to="/admin/login" replace />;

  return (
    <main className="bd-auth">
      <section className="bd-card bd-stack">
        <p className="bd-kicker">{t("admin.login.kicker")}</p>
        <h1 className="bd-title">{t("admin.review.title")}</h1>
        {error ? <p className="bd-error" role="alert">{error}</p> : null}
        <h2 className="bd-title">{t("admin.review.items")}</h2>
        {data.items.length === 0 ? <p className="bd-sub">{t("admin.review.empty")}</p> : null}
        {data.items.map((item) => (
          <article key={item.id} className="bd-stack">
            <p>{item.skill}</p>
            <p>{item.stem.prompt}</p>
            <p>{t("admin.review.key")}: {item.answerKey?.correct ?? "—"}</p>
            <button type="button" className="bd-btn bd-btn--solid" onClick={() => act(`/api/admin/content/${item.id}/approve`)}>{t("admin.review.approve")}</button>
            <input className="bd-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("admin.review.reason")} />
            <button type="button" className="bd-btn bd-btn--outline" onClick={() => act(`/api/admin/content/${item.id}/reject`, { reason })}>{t("admin.review.reject")}</button>
          </article>
        ))}
        <h2 className="bd-title">{t("admin.review.sets")}</h2>
        {data.sets.map((set) => (
          <article key={set.id}>
            <p>{set.title_fa} · {set.skill} · {set.is_free ? "free" : "paid"}</p>
            <button type="button" className="bd-btn bd-btn--solid" onClick={() => act(`/api/admin/practice-sets/${set.id}/approve`)}>{t("admin.review.approve")}</button>
          </article>
        ))}
        <h2 className="bd-title">{t("admin.review.placement")}</h2>
        {data.versions.map((version) => (
          <article key={version.id}>
            <p>{version.exam_type} v{version.version_no}</p>
            <button type="button" className="bd-btn bd-btn--solid" onClick={() => act(`/api/admin/placement-versions/${version.id}/approve`)}>{t("admin.review.approve")}</button>
          </article>
        ))}
      </section>
    </main>
  );
}
