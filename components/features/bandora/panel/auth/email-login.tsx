import { useId, useState, type FormEvent } from "react";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";

/** Secondary sign-in with the optional email + password. Failures stay generic. */
export function EmailLogin({ onBack }: { onBack: () => void }) {
  const i18n = useT();
  const { t } = i18n;
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (email.trim() === "" || password === "") {
      setError(t("login.email.required"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/password/login", { email: email.trim(), password });
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
        <label htmlFor={emailId}>{t("login.email.label")}</label>
        <input
          id={emailId}
          className="bd-input bd-input--ltr"
          type="email"
          dir="ltr"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
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
      <div className="bd-auth__more">
        <button type="button" className="bd-linkbtn" onClick={onBack}>
          {t("login.email.back")}
        </button>
      </div>
    </form>
  );
}
