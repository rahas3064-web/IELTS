import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Link from "@/components/link";
import { FullPageSkeleton } from "@/components/features/bandora/panel/ui/states";
import { api } from "@/src/lib/api-client";
import { useT } from "@/src/i18n";

type AdminMe = { user: { firstName: string; lastName: string; role: string } };
type MediaFile = { id: string; storageKey: string; onDisk: boolean; downloadPath: string };

const MEDIA_FILE = /^\/api\/admin\/media\/files\/[0-9a-f-]{36}$/i;

/** `/admin`: signed-in admins only. No dashboard metrics. */
export function AdminHome() {
  const { t } = useT();
  const [me, setMe] = useState<AdminMe | null | undefined>(undefined);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[] | null>(null);
  const [mediaError, setMediaError] = useState("");

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

  async function downloadMediaBackup() {
    setMediaError("");
    try {
      const body = await api.get<{ files: MediaFile[] }>("/api/admin/media/export");
      const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "bandora-media-backup.json";
      link.click();
      URL.revokeObjectURL(url);
      setMediaFiles(body.files);
    } catch {
      setMediaError(t("admin.media.error"));
    }
  }

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
        {me.user.role === "super_admin" ? (
          <>
            <button type="button" className="bd-btn bd-btn--outline" onClick={downloadMediaBackup}>{t("admin.media.download")}</button>
            {mediaError ? <p>{mediaError}</p> : null}
            {mediaFiles ? (
              <>
                <p>{t("admin.media.count", { count: mediaFiles.length })}</p>
                <ul>
                  {mediaFiles.map((file) => {
                    const href = MEDIA_FILE.test(file.downloadPath) ? file.downloadPath : null;
                    return (
                      <li key={file.id}>
                        {href && file.onDisk
                          ? <a href={href} download>{file.storageKey}</a>
                          : <span>{file.storageKey} — {t("admin.media.missing")}</span>}
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
          </>
        ) : null}
        <button type="button" className="bd-btn bd-btn--solid" onClick={logout}>{t("admin.login.out")}</button>
      </section>
    </main>
  );
}
