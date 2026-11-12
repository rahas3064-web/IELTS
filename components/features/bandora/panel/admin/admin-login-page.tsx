import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Logo } from "@/components/features/bandora/panel/ui/logo";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { normalizePhone } from "@/src/lib/phone";
import { useT } from "@/src/i18n";
import { useDevBypass } from "@/src/auth/use-dev-bypass";

type Step = "phone" | "code" | "password";

/** `/admin/login`: OTP for purpose admin_login, then the separate admin password. */
export function AdminLoginPage() {
  const i18n = useT();
  const { t } = i18n;
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [gate, setGate] = useState("");
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Local AUTH_DEV_BYPASS only: skip the SMS code; the admin password is still required.
  const skipCode = useDevBypass();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (step === "phone") {
        const normalised = normalizePhone(phone);
        if (!normalised) {
          setError(t("login.phone.invalid"));
          return;
        }
        setPhone(normalised);
        if (skipCode) {
          const gated = await api.post<{ needsPasswordSetup: boolean; gate: string }>(
            "/api/admin/auth/dev-bypass/phone",
            { phone: normalised },
            { handleAuth: false },
          );
          setGate(gated.gate);
          setSetup(gated.needsPasswordSetup);
          setStep("password");
          return;
        }
        await api.post("/api/admin/auth/otp/request", { phone: normalised }, { handleAuth: false });
        setStep("code");
        return;
      }
      if (step === "code") {
        const verified = await api.post<{ needsPasswordSetup: boolean; gate: string }>(
          "/api/admin/auth/otp/verify",
          { phone, code },
          { handleAuth: false },
        );
        setGate(verified.gate);
        setSetup(verified.needsPasswordSetup);
        setStep("password");
        return;
      }
      const path = setup ? "/api/admin/auth/password/setup" : "/api/admin/auth/password";
      await api.post(path, { gate, password }, { handleAuth: false });
      navigate("/admin", { replace: true });
    } catch (caught) {
      setError(errorText(caught, i18n));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bd-auth">
      <Logo href="/" />
      <section className="bd-card bd-auth__card" aria-labelledby="admin-login-title">
        <p className="bd-kicker">{t("admin.login.kicker")}</p>
        <h1 id="admin-login-title" className="bd-title">{t("admin.login.title")}</h1>
        <form onSubmit={submit} noValidate>
          {step === "phone" ? (
            <div className="bd-field">
              <label htmlFor="admin-phone">{t("admin.login.phone")}</label>
              <input id="admin-phone" className="bd-input bd-input--ltr" dir="ltr" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
          ) : null}
          {step === "code" ? (
            <div className="bd-field">
              <label htmlFor="admin-code">{t("admin.login.code")}</label>
              <input id="admin-code" className="bd-input bd-input--ltr" dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} />
            </div>
          ) : null}
          {step === "password" ? (
            <div className="bd-field">
              <label htmlFor="admin-password">{t("admin.login.password")}</label>
              <input id="admin-password" className="bd-input" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
          ) : null}
          {error ? <p className="bd-error" role="alert">{error}</p> : null}
          <button type="submit" className="bd-btn bd-btn--solid bd-btn--block" disabled={busy}>
            {step === "phone" ? (skipCode ? t("admin.login.continue") : t("admin.login.send")) : setup && step === "password" ? t("admin.login.setup") : t("admin.login.continue")}
          </button>
          {skipCode && step === "phone" ? <p className="bd-muted">{t("login.devBypass.note")}</p> : null}
        </form>
      </section>
    </main>
  );
}
