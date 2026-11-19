import { useState, type ReactNode } from "react";
import { api } from "@/src/lib/api-client";
import { errorText } from "@/src/lib/error-message";
import { useAuth } from "@/src/auth/auth-provider";
import { useSmsOtp } from "@/src/auth/use-sms-otp";
import { useT } from "@/src/i18n";
import { OtpStep } from "@/components/features/bandora/panel/auth/otp-step";
import { resendSeconds } from "@/components/features/bandora/panel/auth/phone-step";

/** Once SMS.ir is on, an unverified phone is confirmed with one OTP before the panel. */
export function PhoneVerifyGate({ children }: { children: ReactNode }) {
  const smsOtp = useSmsOtp();
  const { me } = useAuth();
  const unverified = me?.user.phoneVerified === false;
  if (!unverified || smsOtp === false) return children;
  if (smsOtp === null || !me) return null;
  return <VerifyPhone phone={me.user.phone} />;
}

function VerifyPhone({ phone }: { phone: string }) {
  const i18n = useT();
  const { t } = i18n;
  const [seconds, setSeconds] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ ok: boolean; resendAfterSec?: number; resendAfter?: number }>("/api/auth/otp/request", { phone });
      setSeconds(resendSeconds(result));
    } catch (failure) {
      setError(errorText(failure, i18n));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bd-card" aria-labelledby="verify-phone-title">
      <h1 id="verify-phone-title" className="bd-title">{t("login.phone.verifyTitle")}</h1>
      <p className="bd-sub">{t("login.phone.verifyLead")}</p>
      {seconds === null ? (
        <>
          {error ? <p className="bd-alert" role="alert">{error}</p> : null}
          <button type="button" className="bd-btn bd-btn--solid" onClick={() => void send()} disabled={busy}>
            {busy ? t("login.phone.sending") : t("login.phone.verifySend")}
          </button>
        </>
      ) : (
        <OtpStep phone={phone} initialSeconds={seconds} onNeedsProfile={() => undefined} />
      )}
    </section>
  );
}
