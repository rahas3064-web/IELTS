"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PublicHeader } from "@/components/shell/public-header";
import { Callout, Field, inputClass } from "@/components/product/bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useApp } from "@/lib/store";
import { cn } from "cn";

function emailOk(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function passwordOk(value: string) {
  return value.length >= 8 && /\d/.test(value);
}

export function LoginScreen() {
  const { bi, state, ready, signInDemo, signInExisting, waitForConnection } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "";
  const [email, setEmail] = useState("negar@example.com");
  const [password, setPassword] = useState("demo-pass-1");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!emailOk(email)) {
      setError(bi("ایمیل را کامل بنویسید.", "Enter a complete email."));
      return;
    }
    if (!passwordOk(password)) {
      setError(bi("رمز باید دست‌کم ۸ نویسه و یک عدد داشته باشد. این بررسی امنیتی نیست.", "Use at least 8 characters and one digit. This is not a security check."));
      return;
    }
    setPending(true);
    const connection = await waitForConnection();
    setPending(false);
    if (connection === "offline") {
      setError(bi("اتصال قطع است. ورود انجام نشد.", "You are offline. Sign-in did not finish."));
      return;
    }
    if (email.toLowerCase() === "admin@example.com") {
      signInDemo("admin");
      router.push("/admin");
      return;
    }
    if (email.toLowerCase() === "negar@example.com") {
      signInDemo("learner");
      router.push(next.startsWith("/") ? next : "/dashboard");
      return;
    }
    const ok = signInExisting(email);
    if (!ok) {
      setError(bi("این ایمیل در همین مرورگر ثبت نشده است.", "That email is not saved in this browser."));
      return;
    }
    router.push(state.onboardingDone ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto grid max-w-4xl gap-6 px-4 py-8 md:grid-cols-[1fr_0.8fr]">
        <form onSubmit={submit} className="rounded-2xl border bg-card p-5" noValidate>
          <h1 className="text-2xl font-semibold">{bi("ورود نمایشی", "Demo sign-in")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {bi("رمز عبور ذخیره نمی‌شود. برای ایمیل ثبت‌شده، هر رمز معتبر پذیرفته می‌شود.", "The password is not stored. Any valid password is accepted for an email saved here.")}
          </p>
          <div className="mt-5 grid gap-4">
            <Field label={bi("ایمیل", "Email")} htmlFor="email" error={error && !emailOk(email) ? error : undefined}>
              <input id="email" className={inputClass(!emailOk(email) && Boolean(error))} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" inputMode="email" aria-invalid={!emailOk(email) && Boolean(error)} />
            </Field>
            <Field label={bi("رمز عبور", "Password")} htmlFor="password" hint={bi("نمونه: demo-pass-1", "Sample: demo-pass-1")}>
              <input id="password" type="password" className={inputClass()} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" aria-invalid={Boolean(error) && !passwordOk(password)} />
            </Field>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            <Button type="submit" size="lg" className="h-11" disabled={pending || !ready}>
              {pending ? bi("در حال بررسی اتصال", "Checking the connection") : bi("ورود", "Log in")}
            </Button>
          </div>
          <p className="mt-4 text-sm">
            <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">{bi("بازیابی رمز", "Reset password")}</Link>
            <span className="mx-2 text-muted-foreground">·</span>
            <Link href="/signup" className="text-primary underline-offset-4 hover:underline">{bi("حساب تازه", "New account")}</Link>
          </p>
        </form>
        <div className="grid content-start gap-3">
          <Callout title={bi("دو حساب آماده", "Two ready accounts")} tone="info">
            {bi("نگار حسینی وارد داشبورد سناریوی ب می‌شود. admin@example.com پنل مدیر را باز می‌کند. هر دو خیالی‌اند.", "Negar Hosseini opens scenario B. admin@example.com opens the admin panel. Both are fictional.")}
          </Callout>
          <button type="button" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")} onClick={() => { signInDemo("learner"); router.push("/dashboard"); }}>
            {bi("ورود یادگیرنده نمونه", "Sample learner")}
          </button>
          <button type="button" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11")} onClick={() => { signInDemo("admin"); router.push("/admin"); }}>
            {bi("ورود مدیر نمونه", "Sample admin")}
          </button>
        </div>
      </main>
    </div>
  );
}

export function SignupScreen() {
  const { bi, signUp, setConsent, waitForConnection } = useApp();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", age: "", password: "" });
  const [aware, setAware] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = bi("نام را بنویسید.", "Enter a name.");
    if (!emailOk(form.email)) next.email = bi("ایمیل معتبر نیست.", "The email is not valid.");
    if (!/^09\d{9}$/.test(form.phone)) next.phone = bi("شماره را با ۰۹ و ۱۱ رقم بنویسید. شماره واقعی نگذارید.", "Use 09 and 11 digits. Do not use a real number.");
    const age = Number(form.age);
    if (!Number.isInteger(age) || age < 16 || age > 80) next.age = bi("سن باید بین ۱۶ و ۸۰ باشد.", "Age must be between 16 and 80.");
    if (!passwordOk(form.password)) next.password = bi("حداقل ۸ نویسه و یک عدد. رمز ذخیره نمی‌شود.", "At least 8 characters and one digit. The password is not stored.");
    if (!aware) next.aware = bi("باید بدانید این محیط نمایشی است.", "Confirm that this environment is a demo.");
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    const connection = await waitForConnection();
    setPending(false);
    if (connection === "offline") {
      setErrors({ form: bi("اتصال قطع است. حساب ساخته نشد.", "You are offline. The account was not created.") });
      return;
    }
    setConsent(analytics);
    signUp({ name: form.name.trim(), email: form.email.trim(), phone: form.phone, age, role: "learner" });
    router.push("/onboarding");
  }

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-lg px-4 py-8">
        <form onSubmit={submit} className="rounded-2xl border bg-card p-5" noValidate>
          <h1 className="text-2xl font-semibold">{bi("ثبت‌نام نمایشی", "Demo signup")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{bi("از داده ساختگی استفاده کنید. رمز عبور نگه داشته نمی‌شود.", "Use made-up details. The password is not kept.")}</p>
          <div className="mt-5 grid gap-4">
            <Field label={bi("نام", "Name")} htmlFor="name" error={errors.name}>
              <input id="name" className={inputClass(Boolean(errors.name))} value={form.name} onChange={(event) => set("name", event.target.value)} aria-invalid={Boolean(errors.name)} />
            </Field>
            <Field label={bi("ایمیل", "Email")} htmlFor="email" error={errors.email}>
              <input id="email" className={inputClass(Boolean(errors.email))} value={form.email} onChange={(event) => set("email", event.target.value)} aria-invalid={Boolean(errors.email)} />
            </Field>
            <Field label={bi("تلفن", "Phone")} htmlFor="phone" error={errors.phone} hint="09120000000">
              <input id="phone" className={inputClass(Boolean(errors.phone))} value={form.phone} onChange={(event) => set("phone", event.target.value)} inputMode="numeric" aria-invalid={Boolean(errors.phone)} />
            </Field>
            <Field label={bi("سن", "Age")} htmlFor="age" error={errors.age}>
              <input id="age" className={inputClass(Boolean(errors.age))} value={form.age} onChange={(event) => set("age", event.target.value)} inputMode="numeric" aria-invalid={Boolean(errors.age)} />
            </Field>
            <Field label={bi("رمز عبور", "Password")} htmlFor="password" error={errors.password}>
              <input id="password" type="password" className={inputClass(Boolean(errors.password))} value={form.password} onChange={(event) => set("password", event.target.value)} aria-invalid={Boolean(errors.password)} />
            </Field>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={aware} onCheckedChange={(checked) => setAware(Boolean(checked))} />
              <span>{bi("می‌دانم این محیط نمایشی است و اطلاعات واقعی وارد نمی‌کنم.", "I know this is a demo and I will not enter real personal data.")}</span>
            </label>
            {errors.aware ? <p className="text-xs text-destructive" role="alert">{errors.aware}</p> : null}
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={analytics} onCheckedChange={(checked) => setAnalytics(Boolean(checked))} />
              <span>{bi("رویدادهای محصول، بدون متن پاسخ‌ها، در همین مرورگر ثبت شود. اختیاری است.", "Record product events in this browser, without answer text. Optional.")}</span>
            </label>
            {errors.form ? <p className="text-sm text-destructive" role="alert">{errors.form}</p> : null}
            <Button type="submit" size="lg" className="h-11" disabled={pending}>{pending ? bi("صبر کنید", "Please wait") : bi("ادامه به هدف", "Continue to the goal")}</Button>
          </div>
        </form>
      </main>
    </div>
  );
}

export function ForgotScreen() {
  const { bi, waitForConnection } = useApp();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!emailOk(email)) {
      setError(bi("ایمیل را کامل بنویسید.", "Enter a complete email."));
      return;
    }
    const connection = await waitForConnection();
    if (connection === "offline") {
      setError(bi("اتصال قطع است. ایمیلی ارسال نشد.", "You are offline. No email was sent."));
      return;
    }
    setError("");
    setSent(true);
  }

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-lg px-4 py-8">
        <form onSubmit={submit} className="rounded-2xl border bg-card p-5">
          <h1 className="text-2xl font-semibold">{bi("بازیابی رمز", "Password reset")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{bi("ایمیلی فرستاده نمی‌شود. این فقط مسیر نمایشی است.", "No email is sent. This is only the demo path.")}</p>
          <div className="mt-5 grid gap-4">
            <Field label={bi("ایمیل", "Email")} htmlFor="email" error={error}>
              <input id="email" className={inputClass(Boolean(error))} value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            {sent ? (
              <Callout tone="success" title={bi("درخواست نمایشی ثبت شد", "Demo request recorded")}>
                {bi("در محصول واقعی اینجا یک پیوند یک‌بارمصرف می‌آید. الان چیزی ارسال نشده است.", "A real product would send a one-time link here. Nothing was sent.")}
              </Callout>
            ) : null}
            <Button type="submit" size="lg" className="h-11">{bi("ثبت درخواست نمایشی", "Record the demo request")}</Button>
            <Link href="/login" className="text-sm text-primary underline-offset-4 hover:underline">{bi("بازگشت به ورود", "Back to sign-in")}</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
