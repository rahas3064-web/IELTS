import { useEffect, useId, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/src/lib/api-client";
import { normalizePhone } from "@/src/lib/phone";
import type { Lang } from "@/components/features/bandora/content";

const SUPPORT_EMAIL = "rahas3064@gmail.com";

const TEXT = {
  FA: {
    dir: "rtl" as const,
    signIn: "ورود",
    signUp: "ثبت‌نام",
    phone: "شماره موبایل",
    password: "رمز عبور",
    fullName: "نام و نام خانوادگی",
    hint: "حداقل ۸ نویسه",
    accept: "قوانین استفاده، حریم خصوصی و بازگشت وجه را خواندم و قبول می‌کنم.",
    terms: "قوانین",
    privacy: "حریم خصوصی",
    refund: "بازگشت وجه",
    submitIn: "ورود",
    submitUp: "ساخت حساب",
    close: "بستن",
    forgot: "رمز را فراموش کردی؟ به rahas3064@gmail.com ایمیل بزن",
    invalid: "نام، شماره موبایل معتبر و رمز حداقل ۸ نویسه‌ای را وارد کن.",
    acceptRequired: "برای ثبت‌نام باید این متن‌ها را قبول کنی.",
    required: "شماره موبایل و رمز را وارد کن.",
    sending: "در حال ارسال…",
  },
  EN: {
    dir: "ltr" as const,
    signIn: "Sign in",
    signUp: "Sign up",
    phone: "Mobile number",
    password: "Password",
    fullName: "Full name",
    hint: "At least 8 characters",
    accept: "I have read and accept the terms of use, privacy notice and refund terms.",
    terms: "Terms",
    privacy: "Privacy",
    refund: "Refunds",
    submitIn: "Sign in",
    submitUp: "Create account",
    close: "Close",
    forgot: "Forgot your password? Email rahas3064@gmail.com",
    invalid: "Enter your name, a valid mobile number, and a password of at least 8 characters.",
    acceptRequired: "Accept these documents to sign up.",
    required: "Enter your mobile number and password.",
    sending: "Sending…",
  },
};

type Tab = "login" | "signup";

const field: CSSProperties = { display: "grid", gap: 6 };
const input: CSSProperties = {
  border: "1px solid #D9CFBB",
  borderRadius: 4,
  background: "#FBF8F1",
  color: "#1A2238",
  font: "inherit",
  padding: "10px 12px",
  width: "100%",
};
const label: CSSProperties = { fontSize: 14, color: "#1F2E54" };

/** Landing sign-in and sign-up. The page around it stays unchanged. */
export function LandingAuthModal({
  tab,
  lang,
  mobile,
  onTab,
  onClose,
}: {
  tab: Tab;
  lang: Lang;
  mobile: boolean;
  onTab: (tab: Tab) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const copy = TEXT[lang];
  const ids = { name: useId(), phone: useId(), password: useId() };
  const titleId = useId();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const normalised = normalizePhone(phone);
    if (tab === "signup") {
      if (fullName.trim() === "" || !normalised || password.length < 8) {
        setError(copy.invalid);
        return;
      }
      if (!accepted) {
        setError(copy.acceptRequired);
        return;
      }
    } else if (!normalised || password === "") {
      if (phone.includes("@") && password !== "") {
        // An older account can still sign in with its email.
      } else {
        setError(copy.required);
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      if (tab === "signup" && normalised) {
        await api.post("/api/auth/password/register", {
          fullName: fullName.trim(),
          phone: normalised,
          password,
          acceptedLegal: true,
        }, { handleAuth: false });
      } else if (phone.includes("@")) {
        await api.post("/api/auth/password/login", { email: phone.trim(), password }, { handleAuth: false });
      } else if (normalised) {
        await api.post("/api/auth/password/login", { phone: normalised, password }, { handleAuth: false });
      }
      navigate("/app");
    } catch (failure) {
      const body = failure as { message_fa?: string; message_en?: string };
      setError(lang === "FA" ? body.message_fa || copy.invalid : body.message_en || copy.invalid);
    } finally {
      setBusy(false);
    }
  }

  const panel: CSSProperties = mobile
    ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 80, background: "#FBF8F1", color: "#1A2238", borderRadius: "12px 12px 0 0", padding: 20, maxHeight: "90dvh", overflow: "auto" }
    : { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", zIndex: 80, width: "min(100% - 32px, 420px)", background: "#FBF8F1", color: "#1A2238", borderRadius: 8, padding: 24, border: "1px solid #D9CFBB" };

  return (
    <div dir={copy.dir} lang={lang === "FA" ? "fa" : "en"}>
      <button type="button" aria-label={copy.close} onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 70, border: 0, background: "rgba(26,34,56,.45)", cursor: "pointer" }} />
      <section role="dialog" aria-modal="true" aria-labelledby={titleId} style={panel}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 22, color: "#1F2E54" }}>{tab === "login" ? copy.signIn : copy.signUp}</h2>
          <button type="button" onClick={onClose} aria-label={copy.close} style={{ border: "1px solid #D9CFBB", background: "transparent", borderRadius: 4, width: 36, height: 36, cursor: "pointer" }}>×</button>
        </div>
        <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["login", "signup"] as const).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tab === item}
              onClick={() => { setError(null); onTab(item); }}
              style={{ flex: 1, border: "1px solid #D9CFBB", borderRadius: 4, padding: "8px 12px", cursor: "pointer", font: "inherit", background: tab === item ? "#1F2E54" : "transparent", color: tab === item ? "#F6F1E7" : "#1A2238" }}
            >
              {item === "login" ? copy.signIn : copy.signUp}
            </button>
          ))}
        </div>
        <form onSubmit={submit} noValidate style={{ display: "grid", gap: 14 }}>
          {error ? <p role="alert" style={{ margin: 0, color: "#8C3A3A" }}>{error}</p> : null}
          {tab === "signup" ? (
            <div style={field}>
              <label htmlFor={ids.name} style={label}>{copy.fullName}</label>
              <input id={ids.name} style={input} autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
          ) : null}
          <div style={field}>
            <label htmlFor={ids.phone} style={label}>{copy.phone}</label>
            <input id={ids.phone} style={{ ...input, direction: "ltr" }} type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <div style={field}>
            <label htmlFor={ids.password} style={label}>{copy.password}</label>
            <input id={ids.password} style={{ ...input, direction: "ltr" }} type="password" autoComplete={tab === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
            {tab === "signup" ? <span style={{ fontSize: 13, color: "#4A5168" }}>{copy.hint}</span> : null}
          </div>
          {tab === "signup" ? (
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14 }}>
              <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
              <span>
                {copy.accept}{" "}
                <a href="/terms">{copy.terms}</a>
                {" · "}
                <a href="/privacy">{copy.privacy}</a>
                {" · "}
                <a href="/refund">{copy.refund}</a>
              </span>
            </label>
          ) : (
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ fontSize: 14, color: "#1F2E54" }}>{copy.forgot}</a>
          )}
          <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 4, background: "#1F2E54", color: "#F6F1E7", padding: "12px 16px", font: "inherit", cursor: "pointer" }}>
            {busy ? copy.sending : tab === "login" ? copy.submitIn : copy.submitUp}
          </button>
        </form>
      </section>
    </div>
  );
}
