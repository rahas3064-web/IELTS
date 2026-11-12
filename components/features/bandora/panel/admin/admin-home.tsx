import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Link from "@/components/link";
import { FullPageSkeleton } from "@/components/features/bandora/panel/ui/states";
import { api } from "@/src/lib/api-client";
import { useT } from "@/src/i18n";

type AdminMe = { user: { firstName: string; lastName: string; role: string } };

/** `/admin`: signed-in admins only. No dashboard metrics. */
export function AdminHome() {
  const { t } = useT();
  const [me, setMe] = useState<AdminMe | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    api.get<AdminMe>("/api/admin/me", { handleAuth: false })
      .then((body) => {
        if (!cancelled) setMe(body);
      })
      .catch(() => {
        if (!cancelled) setMe(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function logout() {
    await api.post("/api/admin/auth/logout", {}, { handleAuth: false }).catch(() => undefined);
    setMe(null);
  }

  if (me === undefined) return <FullPageSkeleton />;
  if (!me) return <Navigate to="/admin/login" replace />;

  return (
    <main className="bd-auth">
      <section className="bd-card bd-auth__card">
        <p className="bd-kicker">{t("admin.login.kicker")}</p>
        <h1 className="bd-title">{t("admin.login.home")}</h1>
        <p>{me.user.firstName} {me.user.lastName}</p>
        <p>{t("admin.login.role")}: {me.user.role}</p>
        <Link href="/admin/review" className="bd-btn bd-btn--outline">{t("admin.review.open")}</Link>
        <button type="button" className="bd-btn bd-btn--solid" onClick={logout}>{t("admin.login.out")}</button>
      </section>
    </main>
  );
}
