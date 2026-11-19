import { useId, useState, type FormEvent } from "react";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";

const SUPPORT_EMAIL = "rahas3064@gmail.com";

type EmailLoginProps = {
  onBack?: () => void;
  onCreateAccount?: () => void;
};

/** Sign-in with phone or email plus password. Failures stay generic. */
export function EmailLogin({ onBack, onCreateAccount }: EmailLoginProps) {
  const i18n = useT();
  const { t } = i18n;
  const { refresh } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const raw = identifier.trim();
    if (raw === "" || password === "") {
      setError(t("login.password.required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = raw.includes("@") ? { email: raw, password } : { phone: raw, password };
      await api.post("/api/auth/password/login", body);
      await refresh();
    } catch (failure) {
      setError(errorText(failure, i18n));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {error ? <p className="bd-alert" role="alert">{error}</p> : null}
      <div className="bd-field">
        <label htmlFor={emailId}>{t("login.password.identifier")}</label>
        <input
          id={emailId}
          className="bd-input bd-input--ltr"
          type="text"
          dir="ltr"
          autoComplete="username"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
        />
        <p className="bd-muted">{t("login.password.emailHint")}</p>
      </div>
      <div className="bd-field">
        <label htmlFor={passwordId}>{t("login.email.password")}</label>
        <input
          id={passwordId}
          className="bd-input bd-input--ltr"
          type="password"
          dir="ltr"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <button type="submit" className="bd-btn bd-btn--solid bd-btn--block" disabled={busy}>
        {busy ? t("login.email.sending") : t("login.email.submit")}
      </button>
      <p className="bd-muted">
        <a className="bd-linkbtn" href={`mailto:${SUPPORT_EMAIL}`}>{t("login.password.forgot")}</a>
      </p>
      <div className="bd-auth__more">
        {onCreateAccount ? (
          <button type="button" className="bd-linkbtn" onClick={onCreateAccount}>{t("login.password.signup")}</button>
        ) : null}
        {onBack ? (
          <button type="button" className="bd-linkbtn" onClick={onBack}>
            {t("login.email.back")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
