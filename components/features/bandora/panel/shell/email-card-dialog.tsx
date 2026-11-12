import { useId, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ApiClientError, api } from "@/src/lib/api-client";
import { errorText, fieldErrorText } from "@/src/lib/error-message";
import { useAuth } from "@/src/auth/auth-provider";
import type { MeUser } from "@/src/auth/types";
import { useT } from "@/src/i18n";
import { Modal } from "@/components/features/bandora/panel/ui/modal";

const MIN_PASSWORD = 8;

/** The server asks for a fresh SMS code (or the current password) before changing the sign-in method. */
const needsConfirmation = (failure: unknown) =>
  failure instanceof ApiClientError && failure.status === 403 && failure.details?.reason === "reauth_required";

export function EmailCardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const i18n = useT();
  const { t } = i18n;
  const { me, setMe } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [askCode, setAskCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = { email: useId(), password: useId(), code: useId() };

  async function sendCode() {
    if (!me) return;
    setError(null);
    try {
      await api.post("/api/auth/otp/request", { phone: me.user.phone });
      setCodeSent(true);
    } catch (failure) {
      setError(errorText(failure, i18n));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (email.trim() === "" || password.length < MIN_PASSWORD) {
      setError(t("emailCard.invalid"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = { email: email.trim(), password, ...(code.trim() ? { otpCode: code.trim() } : {}) };
      const result = await api.put<{ user: MeUser }>("/api/account/email-password", body);
      setMe((current) => (current ? { ...current, user: result.user } : current));
      toast.success(t("emailCard.saved"));
      onClose();
    } catch (failure) {
      if (needsConfirmation(failure)) setAskCode(true);
      setError(fieldErrorText(failure, "email", i18n) ?? fieldErrorText(failure, "password", i18n) ?? errorText(failure, i18n));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t("emailCard.dialogTitle")} variant="dialog">
      <form onSubmit={submit} noValidate>
        <p className="bd-sub">{t("emailCard.dialogBody")}</p>
        {error ? <p className="bd-alert" role="alert">{error}</p> : null}
        <div className="bd-field">
          <label htmlFor={ids.email}>{t("login.email.label")}</label>
          <input id={ids.email} className="bd-input bd-input--ltr" type="email" dir="ltr" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div className="bd-field">
          <label htmlFor={ids.password}>{t("emailCard.password")}</label>
          <input id={ids.password} className="bd-input bd-input--ltr" type="password" dir="ltr" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <p className="bd-hint">{t("emailCard.passwordHint", { n: MIN_PASSWORD })}</p>
        </div>
        {askCode ? (
          <div className="bd-field">
            <label htmlFor={ids.code}>{t("emailCard.code")}</label>
            <input id={ids.code} className="bd-input bd-input--ltr" dir="ltr" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value)} />
            <button type="button" className="bd-linkbtn" onClick={() => void sendCode()}>
              {codeSent ? t("emailCard.codeSent") : t("emailCard.sendCode")}
            </button>
          </div>
        ) : null}
        <button type="submit" className="bd-btn bd-btn--solid bd-btn--block" disabled={busy}>
          {busy ? t("common.saving") : t("emailCard.submit")}
        </button>
      </form>
    </Modal>
  );
}
