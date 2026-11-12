import { useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { ApiClientError, api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useAuth } from "@/src/auth/auth-provider";
import { formatClock, useT } from "@/src/i18n";
import { OtpBoxes } from "@/components/features/bandora/panel/auth/otp-boxes";
import { useCountdown } from "@/components/features/bandora/panel/auth/use-countdown";
import { resendSeconds } from "@/components/features/bandora/panel/auth/phone-step";

type VerifyResult = { user?: unknown; needsProfile?: boolean; signupToken?: string };

type OtpStepProps = {
  phone: string;
  initialSeconds: number;
  onChangePhone: () => void;
  onNeedsProfile: (signupToken: string) => void;
};

export function OtpStep({ phone, initialSeconds, onChangePhone, onNeedsProfile }: OtpStepProps) {
  const i18n = useT();
  const { t, locale, digits } = i18n;
  const { refresh } = useAuth();
  const { remaining, restart } = useCountdown(initialSeconds);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const inFlight = useRef(false);

  async function verify(value: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<VerifyResult>("/api/auth/otp/verify", { phone, code: value });
      if (result.needsProfile && result.signupToken) onNeedsProfile(result.signupToken);
      else await refresh();
    } catch (failure) {
      setError(errorText(failure, i18n));
      setLocked(failure instanceof ApiClientError && failure.code === "otp_locked");
      setCode("");
      setResetKey((key) => key + 1);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setCode("");
    try {
      const result = await api.post<{ ok: boolean; resendAfterSec?: number; resendAfter?: number }>("/api/auth/otp/request", { phone });
      restart(resendSeconds(result));
      setResetKey((key) => key + 1);
    } catch (failure) {
      if (failure instanceof ApiClientError && failure.retryAfter !== null) restart(failure.retryAfter);
      setError(errorText(failure, i18n));
      setLocked(failure instanceof ApiClientError && failure.code === "otp_locked");
    }
  }

  return (
    <div>
      <p className="bd-sub" id="otp-sent">
        {t("login.otp.sent")} <span className="bd-num">{digits(phone)}</span>
      </p>
      <div className="bd-field bd-otp-field">
        <OtpBoxes
          value={code}
          onChange={setCode}
          onComplete={(value) => void verify(value)}
          disabled={busy || locked}
          invalid={error !== null}
          resetKey={resetKey}
          describedBy="otp-sent"
        />
        <p className="bd-sr" aria-live="polite">{busy ? t("login.otp.checking") : ""}</p>
        {error ? (
          <p className="bd-error" role="alert">
            <AlertCircle size={16} strokeWidth={1.6} aria-hidden />
            <span>{error}</span>
          </p>
        ) : null}
      </div>
      <div className="bd-auth__row">
        {remaining > 0 ? (
          <p className="bd-muted" aria-live="off">
            {t("login.otp.resendIn", { time: formatClock(remaining, locale) })}
          </p>
        ) : (
          <button type="button" className="bd-linkbtn" onClick={() => void resend()} disabled={busy}>
            {t("login.otp.resend")}
          </button>
        )}
        <button type="button" className="bd-linkbtn" onClick={onChangePhone}>
          {t("login.otp.changePhone")}
        </button>
      </div>
    </div>
  );
}
