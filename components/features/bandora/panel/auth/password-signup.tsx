import { useId, useState, type FormEvent } from "react";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { normalizePhone } from "@/src/lib/phone";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";
import Link from "@/components/link";

const SUPPORT_EMAIL = "rahas3064@gmail.com";

type PasswordSignupProps = {
  onSignIn: () => void;
};

/** Signup used while SMS.ir OTP is not configured. The phone stays unverified. */
export function PasswordSignup({ onSignIn }: PasswordSignupProps) {
  const i18n = useT();
  const { t } = i18n;
  const { refresh } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { first: useId(), last: useId(), phone: useId(), email: useId(), password: useId() };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const normalised = normalizePhone(phone);
    if (firstName.trim() === "" || lastName.trim() === "" || !normalised || !email.includes("@") || password.length < 8) {
      setError(t("login.signup.invalid"));
      return;
    }
    if (!accepted) {
      setError(t("login.profile.acceptRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/auth/password/register", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: normalised,
        email: email.trim(),
        password,
        acceptedLegal: true,
      });
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
        <label htmlFor={ids.first}>{t("login.profile.first")}</label>
        <input id={ids.first} className="bd-input" autoComplete="given-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
      </div>
      <div className="bd-field">
        <label htmlFor={ids.last}>{t("login.profile.last")}</label>
        <input id={ids.last} className="bd-input" autoComplete="family-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
      </div>
      <div className="bd-field">
        <label htmlFor={ids.phone}>{t("login.phone.label")}</label>
        <input id={ids.phone} className="bd-input bd-input--ltr" dir="ltr" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </div>
      <div className="bd-field">
        <label htmlFor={ids.email}>{t("login.signup.email")}</label>
        <input id={ids.email} className="bd-input bd-input--ltr" dir="ltr" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="bd-field">
        <label htmlFor={ids.password}>{t("login.email.password")}</label>
        <input id={ids.password} className="bd-input bd-input--ltr" dir="ltr" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <p className="bd-muted">{t("login.signup.passwordHint")}</p>
      </div>
      <div className="bd-field">
        <label className="bd-check">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>
            {t("login.profile.accept")}{" "}
            <Link href="/terms">{t("legal.terms.title")}</Link>
            {" · "}
            <Link href="/privacy">{t("legal.privacy.title")}</Link>
            {" · "}
            <Link href="/refund">{t("legal.refund.title")}</Link>
          </span>
        </label>
      </div>
      <button type="submit" className="bd-btn bd-btn--solid bd-btn--block" disabled={busy}>
        {busy ? t("common.saving") : t("login.signup.submit")}
      </button>
      <div className="bd-auth__more">
        <button type="button" className="bd-linkbtn" onClick={onSignIn}>{t("login.signup.haveAccount")}</button>
      </div>
      <p className="bd-muted">
        <a className="bd-linkbtn" href={`mailto:${SUPPORT_EMAIL}`}>{t("login.password.forgot")}</a>
      </p>
    </form>
  );
}
