import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useT } from "@/src/i18n";
import { Logo } from "@/components/features/bandora/panel/ui/logo";
import { PhoneStep } from "@/components/features/bandora/panel/auth/phone-step";
import { OtpStep } from "@/components/features/bandora/panel/auth/otp-step";
import { ProfileStep } from "@/components/features/bandora/panel/auth/profile-step";
import { EmailLogin } from "@/components/features/bandora/panel/auth/email-login";

type Step =
  | { name: "phone"; phone: string }
  | { name: "email" }
  | { name: "otp"; phone: string; seconds: number }
  | { name: "profile"; signupToken: string };

const TITLES: Record<Step["name"], string> = {
  phone: "login.title",
  email: "login.email.title",
  otp: "login.otp.title",
  profile: "login.profile.title",
};

/** `/login`: phone, then the code, then (new users only) their name. One entry for sign-in and sign-up. */
export function LoginPage() {
  const { t } = useT();
  const [params] = useSearchParams();
  const [step, setStep] = useState<Step>({ name: "phone", phone: "" });
  const referral = (params.get("ref") ?? "").trim().toUpperCase().slice(0, 64);

  return (
    <main className="bd-auth">
      <Logo href="/" />
      <section className="bd-card bd-auth__card" aria-labelledby="login-title">
        <p className="bd-kicker">{t("login.kicker")}</p>
        <h1 id="login-title" className="bd-title">{t(TITLES[step.name])}</h1>
        {step.name === "phone" ? (
          <PhoneStep
            initialPhone={step.phone}
            onSent={(phone, seconds) => setStep({ name: "otp", phone, seconds })}
            onUseEmail={() => setStep({ name: "email" })}
            onNeedsProfile={(signupToken) => setStep({ name: "profile", signupToken })}
          />
        ) : null}
        {step.name === "email" ? <EmailLogin onBack={() => setStep({ name: "phone", phone: "" })} /> : null}
        {step.name === "otp" ? (
          <OtpStep
            phone={step.phone}
            initialSeconds={step.seconds}
            onChangePhone={() => setStep({ name: "phone", phone: step.phone })}
            onNeedsProfile={(signupToken) => setStep({ name: "profile", signupToken })}
          />
        ) : null}
        {step.name === "profile" ? (
          <ProfileStep
            signupToken={step.signupToken}
            initialReferral={referral}
            onExpired={() => setStep({ name: "phone", phone: "" })}
          />
        ) : null}
      </section>
    </main>
  );
}
