import { useId, useState, type FormEvent } from "react";
import { AlertCircle } from "lucide-react";
import { ApiClientError, api } from "@/src/lib/api-client";
import { errorText, fieldErrorText } from "@/src/lib/error-message";
import { normalizePhone } from "@/src/lib/phone";
import { useT } from "@/src/i18n";
import { useAuth } from "@/src/auth/auth-provider";
import { useDevBypass } from "@/src/auth/use-dev-bypass";

const DEFAULT_RESEND_SECONDS = 60;

type OtpRequestResult = { ok: boolean; resendAfterSec?: number; resendAfter?: number };
type BypassResult = { user?: unknown; needsProfile?: boolean; signupToken?: string };

export const resendSeconds = (result: OtpRequestResult | null): number =>
  result?.resendAfterSec ?? result?.resendAfter ?? DEFAULT_RESEND_SECONDS;

type PhoneStepProps = {
  initialPhone?: string;
  onSent: (phone: string, resendAfterSec: number) => void;
  onUseEmail: () => void;
  /** Local AUTH_DEV_BYPASS only: the code step is skipped and a new number goes straight to the name step. */
  onNeedsProfile?: (signupToken: string) => void;
};

export function PhoneStep({ initialPhone = "", onSent, onUseEmail, onNeedsProfile }: PhoneStepProps) {
  const i18n = useT();
  const { t } = i18n;
  const { refresh } = useAuth();
  const skipCode = useDevBypass() && onNeedsProfile !== undefined;
  const [raw, setRaw] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  const errorId = useId();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const phone = normalizePhone(raw);
    if (!phone) {
      setError(t("login.phone.invalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (skipCode) {
        const result = await api.post<BypassResult>("/api/auth/dev-bypass/phone", { phone });
        if (result.needsProfile && result.signupToken) onNeedsProfile?.(result.signupToken);
        else await refresh();
        return;
      }
      const result = await api.post<OtpRequestResult>("/api/auth/otp/request", { phone });
      onSent(phone, resendSeconds(result));
    } catch (failure) {
      const wait = failure instanceof ApiClientError && failure.code === "rate_limited" ? failure.retryAfter : null;
      // A code was sent moments ago: carry on to the code screen with the server's wait.
      if (wait !== null && wait <= DEFAULT_RESEND_SECONDS) onSent(phone, wait);
      else setError(fieldErrorText(failure, "phone", i18n) ?? errorText(failure, i18n));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-labelledby="login-title">
      <div className="bd-field">
        <label htmlFor={inputId}>{t("login.phone.label")}</label>
        <input
          id={inputId}
          className="bd-input bd-input--ltr"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          dir="ltr"
          placeholder={t("login.phone.placeholder")}
          value={raw}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setRaw(event.target.value);
            setError(null);
          }}
        />
        {error ? (
          <p id={errorId} className="bd-error" role="alert">
            <AlertCircle size={16} strokeWidth={1.6} aria-hidden />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
      <button type="submit" className="bd-btn bd-btn--solid bd-btn--block" disabled={busy}>
        {busy ? t("login.phone.sending") : skipCode ? t("login.phone.continue") : t("login.phone.submit")}
      </button>
      {skipCode ? <p className="bd-muted">{t("login.devBypass.note")}</p> : null}
      <div className="bd-auth__more">
        <button type="button" className="bd-linkbtn" onClick={onUseEmail}>
          {t("login.email.switch")}
        </button>
      </div>
    </form>
  );
}
