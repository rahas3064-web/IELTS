import { useState, type FormEvent } from "react";
import Link from "@/components/link";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";
import { api } from "@/src/lib/api-client";
import { CardSkeleton, EmptyState } from "@/components/features/bandora/panel/ui/states";
import { displayName } from "@/server/auth/full-name.js";

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
      <p>{displayName(user.firstName, user.lastName)}</p>
      <p>{t("profile.phone")}: <span dir="ltr">{user.phone}</span></p>
      <p>{t("profile.email")}: {user.email ?? t("profile.none")}</p>
      <DeleteAccount />
      <Link href="/app" className="bd-btn bd-btn--outline">{t("section.back")}</Link>
    </section>
  );
}

function DeleteAccount() {
  const { t } = useT();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const ready = word === "حذف";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready || pending) return;
    setPending(true);
    setError("");
    try {
      await api.post("/api/account/delete", { confirmation: "حذف" });
      await logout();
    } catch {
      setError(t("profile.deleteFailed"));
      setPending(false);
    }
  }

  return (
    <>
      <button type="button" className="bd-btn bd-btn--outline" onClick={() => setOpen(true)}>
        {t("profile.delete")}
      </button>
      {open ? (
        <div className="bd-modal bd-modal--dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <h3 id="delete-title" className="bd-modal__title">{t("profile.delete")}</h3>
          <p>{t("profile.deleteHint")}</p>
          <form className="bd-stack" onSubmit={submit}>
            <label className="bd-field">
              {t("profile.deleteLabel")}
              <input value={word} autoComplete="off" onChange={(event) => setWord(event.target.value)} />
            </label>
            {error ? <p role="alert">{error}</p> : null}
            <button type="submit" className="bd-btn bd-btn--solid" disabled={!ready || pending}>
              {t("profile.delete")}
            </button>
            <button type="button" className="bd-btn bd-btn--outline" onClick={() => { setOpen(false); setWord(""); setError(""); }}>
              {t("profile.deleteCancel")}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}

// The subscription page lives in ./subscription (plans, quotas, checkout).
export { SubscriptionPage } from "@/components/features/bandora/panel/subscription/subscription-page";
