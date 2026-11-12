import { useNavigate } from "react-router-dom";
import { MonitorX } from "lucide-react";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";
import { Logo } from "@/components/features/bandora/panel/ui/logo";

/** Full-screen notice shown when another device signed in (401 `session_replaced`). */
export function SessionReplaced() {
  const { t } = useT();
  const { acknowledgeReplaced } = useAuth();
  const navigate = useNavigate();
  return (
    <main className="bd-auth" role="alertdialog" aria-labelledby="replaced-title" aria-describedby="replaced-body">
      <Logo href="/" />
      <section className="bd-card bd-auth__card">
        <MonitorX size={28} strokeWidth={1.6} aria-hidden className="bd-auth__icon" />
        <h1 id="replaced-title" className="bd-title">{t("replaced.title")}</h1>
        <p id="replaced-body" className="bd-sub">{t("replaced.body")}</p>
        <button
          type="button"
          className="bd-btn bd-btn--solid bd-btn--block"
          onClick={() => {
            acknowledgeReplaced();
            navigate("/login", { replace: true });
          }}
        >
          {t("replaced.action")}
        </button>
      </section>
    </main>
  );
}
