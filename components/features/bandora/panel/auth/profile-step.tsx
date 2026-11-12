import { useId, useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ApiClientError, api } from "@/src/lib/api-client";
import { errorText, fieldErrorText } from "@/src/lib/error-message";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";

type RegisterResult = { user: unknown; referral: { accepted: boolean } | null };
type FieldName = "firstName" | "lastName" | "referralCode";
type FieldErrors = Partial<Record<FieldName, string>>;

type ProfileStepProps = {
  signupToken: string;
  initialReferral: string;
  /** The signup token no longer works (expired): start again from the phone number. */
  onExpired: () => void;
};

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="bd-error" role="alert">
      <AlertCircle size={16} strokeWidth={1.6} aria-hidden />
      <span>{message}</span>
    </p>
  );
}

export function ProfileStep({ signupToken, initialReferral, onExpired }: ProfileStepProps) {
  const i18n = useT();
  const { t } = i18n;
  const { refresh } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [referral, setReferral] = useState(initialReferral);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { first: useId(), last: useId(), ref: useId() };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const local: FieldErrors = {};
    if (firstName.trim() === "") local.firstName = t("login.profile.firstRequired");
    if (lastName.trim() === "") local.lastName = t("login.profile.lastRequired");
    setErrors(local);
    setFormError(null);
    if (Object.keys(local).length > 0) return;
    setBusy(true);
    try {
      const body = {
        signupToken,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(referral.trim() ? { referralCode: referral.trim() } : {}),
      };
      const result = await api.post<RegisterResult>("/api/auth/register", body);
      if (result.referral && !result.referral.accepted) toast(t("login.profile.referralRejected"));
      await refresh();
    } catch (failure) {
      if (failure instanceof ApiClientError && failure.status === 401) {
        toast(t("login.profile.expired"));
        onExpired();
        return;
      }
      const server: FieldErrors = {};
      for (const field of ["firstName", "lastName", "referralCode"] as const) {
        const message = fieldErrorText(failure, field, i18n);
        if (message) server[field] = message;
      }
      setErrors(server);
      if (Object.keys(server).length === 0) setFormError(errorText(failure, i18n));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <p className="bd-sub bd-auth__lead">{t("login.profile.lead")}</p>
      {formError ? <p className="bd-alert" role="alert">{formError}</p> : null}
      <div className="bd-field">
        <label htmlFor={ids.first}>{t("login.profile.first")}</label>
        <input
          id={ids.first}
          className="bd-input"
          autoComplete="given-name"
          value={firstName}
          aria-invalid={errors.firstName ? true : undefined}
          aria-describedby={errors.firstName ? `${ids.first}-e` : undefined}
          onChange={(event) => setFirstName(event.target.value)}
        />
        <FieldError id={`${ids.first}-e`} message={errors.firstName} />
      </div>
      <div className="bd-field">
        <label htmlFor={ids.last}>{t("login.profile.last")}</label>
        <input
          id={ids.last}
          className="bd-input"
          autoComplete="family-name"
          value={lastName}
          aria-invalid={errors.lastName ? true : undefined}
          aria-describedby={errors.lastName ? `${ids.last}-e` : undefined}
          onChange={(event) => setLastName(event.target.value)}
        />
        <FieldError id={`${ids.last}-e`} message={errors.lastName} />
      </div>
      <div className="bd-field">
        <label htmlFor={ids.ref}>
          {t("login.profile.referral")} <span className="bd-muted">({t("common.optional")})</span>
        </label>
        <input
          id={ids.ref}
          className="bd-input bd-input--ltr"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          value={referral}
          aria-invalid={errors.referralCode ? true : undefined}
          aria-describedby={errors.referralCode ? `${ids.ref}-e` : undefined}
          onChange={(event) => setReferral(event.target.value)}
        />
        <FieldError id={`${ids.ref}-e`} message={errors.referralCode} />
      </div>
      <button type="submit" className="bd-btn bd-btn--solid bd-btn--block" disabled={busy}>
        {busy ? t("common.saving") : t("login.profile.submit")}
      </button>
    </form>
  );
}
