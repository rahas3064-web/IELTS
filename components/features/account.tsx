"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Callout, EmptyBlock, Field, PageIntro, inputClass } from "@/components/product/bits";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CAPABILITIES } from "@/lib/capabilities";
import { EVENT_CATALOG } from "@/lib/experiments";
import { formatDate, formatNumber } from "@/lib/format";
import { buildNotices, assistantReply, FAQ, REASONS } from "@/lib/signals";
import { SCENARIOS } from "@/lib/scenarios";
import { useApp } from "@/lib/store";
import { ROLE_LABEL } from "@/lib/access";
import type { LabOverrides, Role } from "@/lib/types";
import { SKILLS } from "@/lib/types";

export function ProfileScreen() {
  const { bi, state, setTextScale, setReducedMotion, setRole, setConsent, resetWorkspace, deleteLocalAccount, logSecurity } = useApp();
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="grid gap-5">
      <PageIntro title={bi("پروفایل و تنظیمات", "Profile and settings")} lede={bi("انتخاب‌ها در همین مرورگر می‌مانند. حذف حساب فقط داده محلی را پاک می‌کند.", "Choices stay in this browser. Deleting the account only clears local data.")} />
      <section className="rounded-xl border bg-card p-4 text-sm leading-6">
        <h2 className="font-semibold">{state.account?.name}</h2>
        <p>{state.account?.email}</p>
        <p>{state.profile ? `${state.profile.examType} · ${bi(REASONS[state.profile.reason].fa, REASONS[state.profile.reason].en)}` : bi("هدف هنوز ذخیره نشده.", "The goal is not saved yet.")}</p>
        <Link href="/onboarding" className="text-primary underline-offset-4 hover:underline">{bi("ویرایش هدف", "Edit the goal")}</Link>
      </section>
      <section className="grid gap-3 rounded-xl border p-4">
        <h2 className="font-semibold">{bi("نمایش", "Display")}</h2>
        <label className="flex items-center justify-between gap-3 text-sm">
          {bi("اندازه متن", "Text size")}
          <select className="h-9 rounded-md border bg-card px-2" value={state.textScale} onChange={(event) => setTextScale(event.target.value as typeof state.textScale)}>
            <option value="sm">{bi("کوچک", "Small")}</option>
            <option value="md">{bi("معمول", "Default")}</option>
            <option value="lg">{bi("بزرگ", "Large")}</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>{bi("کاهش حرکت", "Reduce motion")}</span>
          <Switch checked={state.reducedMotion} onCheckedChange={(checked) => setReducedMotion(Boolean(checked))} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>{bi("رضایت رویداد تحلیلی در همین مرورگر", "Consent for analytics events in this browser")}</span>
          <Switch checked={state.consentAnalytics} onCheckedChange={(checked) => setConsent(Boolean(checked))} />
        </label>
      </section>
      <section className="rounded-xl border p-4">
        <h2 className="font-semibold">{bi("نقش نمایشی", "Demo role")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{bi("کنترل دسترسی واقعی در بک‌اند است. این تغییر فقط رابط نمونه را عوض می‌کند.", "Real access control belongs on the server. This switch only changes the demo interface.")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(ROLE_LABEL) as Role[]).map((role) => (
            <Button key={role} size="sm" variant={state.account?.role === role ? "default" : "outline"} onClick={() => setRole(role)}>
              {bi(ROLE_LABEL[role].fa, ROLE_LABEL[role].en)}
            </Button>
          ))}
        </div>
      </section>
      <section className="rounded-xl border p-4 text-sm">
        <h2 className="font-semibold">{bi("رویداد امنیتی همین مرورگر", "Security events in this browser")}</h2>
        <ul className="mt-2 grid gap-1">
          {state.securityEvents.length === 0 ? <li className="text-muted-foreground">{bi("هنوز رویدادی نیست.", "No events yet.")}</li> : state.securityEvents.slice(-8).map((event, index) => (
            <li key={`${event.at}-${index}`}>{formatDate(event.at, state.locale)} · {event.name} · {event.detail}</li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { const blob = new Blob([JSON.stringify({ profile: state.profile, events: state.events }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "ielts-readiness-demo.json"; link.click(); URL.revokeObjectURL(url); logSecurity("export", "json"); }}>{bi("خروجی داده محلی", "Export local data")}</Button>
          <Button variant="outline" onClick={() => resetWorkspace()}>{bi("بازنشانی فضای نمونه", "Reset the demo space")}</Button>
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>{bi("حذف داده محلی", "Delete local data")}</Button>
        </div>
        {confirmDelete ? (
          <div className="mt-3">
            <Callout tone="warning" title={bi("حذف فقط روی همین مرورگر است", "Deletion only affects this browser")}>
              {bi("سروری در کار نیست. بعد از تأیید، به صفحه اول برمی‌گردید.", "There is no server. After you confirm, you return to the first page.")}
            </Callout>
            <Button className="mt-2" variant="destructive" onClick={() => { logSecurity("delete_local", "confirmed"); deleteLocalAccount(); router.push("/"); }}>{bi("تأیید حذف", "Confirm deletion")}</Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function NotificationsScreen() {
  const { bi, state, view, markNotice, setNoticePref } = useApp();
  const notices = buildNotices(view, state.notificationPrefs);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const visible = notices.filter((item) => filter === "all" || !state.notificationReads.includes(item.id));
  return (
    <div className="grid gap-4">
      <PageIntro title={bi("اعلان‌ها", "Notices")} lede={bi("ایمیل و پوش ارسال نمی‌شود. این فهرست داخل برنامه است.", "Email and push are not sent. This list stays inside the app.")} />
      <div className="grid gap-2 rounded-xl border p-4 text-sm">
        {(Object.keys(state.notificationPrefs) as (keyof typeof state.notificationPrefs)[]).map((key) => (
          <label key={key} className="flex items-center justify-between gap-3">
            <span>{key === "motivation" ? bi("انگیزشی", "Motivation") : key === "daily" ? bi("گزارش روزانه", "Daily note") : key === "plan" ? bi("برنامه", "Plan") : bi("عملکرد", "Performance")}</span>
            <Switch checked={state.notificationPrefs[key]} onCheckedChange={(checked) => setNoticePref(key, Boolean(checked))} />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>{bi("همه", "All")}</Button>
        <Button size="sm" variant={filter === "unread" ? "default" : "outline"} onClick={() => setFilter("unread")}>{bi("نخوانده", "Unread")}</Button>
      </div>
      {visible.length === 0 ? <EmptyBlock title={bi("اعلانی در این نما نیست", "No notices in this view")} body={bi("یا همه‌چیز خوانده شده، یا تنظیمات آن نوع را خاموش کرده‌اید.", "Either everything is read, or you turned that type off.")} /> : visible.map((item) => {
        const read = state.notificationReads.includes(item.id);
        return (
          <article key={item.id} className="rounded-xl border p-4">
            <p className="text-xs text-muted-foreground">{item.priority} · {item.kind} · {read ? bi("خوانده شده", "Read") : bi("نخوانده", "Unread")}</p>
            <h2 className="mt-1 font-medium">{bi(item.title.fa, item.title.en)}</h2>
            <p className="text-sm text-muted-foreground">{bi(item.body.fa, item.body.en)}</p>
            {!read ? <Button className="mt-2" size="sm" variant="outline" onClick={() => markNotice(item.id)}>{bi("خواندم", "Mark read")}</Button> : null}
          </article>
        );
      })}
    </div>
  );
}

export function AssistantScreen() {
  const { bi, view } = useApp();
  const [text, setText] = useState("");
  const [thread, setThread] = useState<{ role: "user" | "demo"; text: string; exerciseId?: string }[]>([
    { role: "demo", text: bi("من به برنامه و شکاف فعلی وصل‌ام، اما مدل زبانی نیستم. چند سؤال نمونه را امتحان کنید.", "I am tied to the current plan and gap, but I am not a language model. Try one of the sample questions.") },
  ]);
  const samples = [
    bi("نمره‌ام یعنی چه؟", "What does my score mean?"),
    bi("برنامه‌ام سنگین است.", "My plan feels too heavy."),
    bi("روی نوشتن کار کنم؟", "Should I work on writing?"),
  ];
  function ask(message: string) {
    const reply = assistantReply(message, view);
    setThread((current) => [...current, { role: "user", text: message }, { role: "demo", text: bi(reply.text.fa, reply.text.en), exerciseId: reply.exerciseId }]);
    setText("");
  }
  return (
    <div>
      <PageIntro title={bi("دستیار آموزشی", "Study assistant")} lede={bi("پاسخ‌ها نمایشی و قاعده‌محورند. اتصال هوش مصنوعی برای نسخه واقعی مستند شده، اینجا اجرا نمی‌شود.", "Replies are scripted rules. An AI connection is documented for a real version and does not run here.")} />
      <div className="grid gap-3">
        {thread.map((message, index) => (
          <article key={index} className={message.role === "user" ? "ms-8 rounded-xl bg-primary/10 p-3 text-sm" : "me-8 rounded-xl border bg-card p-3 text-sm"}>
            <p>{message.text}</p>
            {message.exerciseId ? <Link href={`/practice/${message.exerciseId}`} className="mt-2 inline-block text-primary underline-offset-4 hover:underline">{bi("تمرین مرتبط", "Related exercise")}</Link> : null}
            {message.role === "demo" ? <p className="mt-2 text-xs text-muted-foreground">{bi("پاسخ نمایشی", "Demo reply")}</p> : null}
          </article>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {samples.map((sample) => <Button key={sample} size="sm" variant="outline" onClick={() => ask(sample)}>{sample}</Button>)}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); if (text.trim()) ask(text.trim()); }}>
        <input className={inputClass()} value={text} onChange={(event) => setText(event.target.value)} aria-label={bi("پیام", "Message")} />
        <Button type="submit">{bi("بپرس", "Ask")}</Button>
      </form>
    </div>
  );
}

export function HelpScreen() {
  const { bi } = useApp();
  return (
    <div className="grid gap-4">
      <PageIntro title={bi("راهنما", "Help")} lede={bi("پاسخ کوتاه به سؤال‌های محصول. پشتیبانی تیکتی در صفحه بازخورد است.", "Short answers about the product. Ticketed support is on the feedback page.")} />
      {FAQ.map((item) => (
        <article key={item.q.en} className="rounded-xl border p-4">
          <h2 className="font-medium">{bi(item.q.fa, item.q.en)}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{bi(item.a.fa, item.a.en)}</p>
        </article>
      ))}
      <section>
        <h2 className="font-semibold">{bi("وضعیت قابلیت‌ها", "Capability status")}</h2>
        <ul className="mt-2 grid gap-2 text-sm">
          {CAPABILITIES.map((item) => (
            <li key={item.id} className="rounded-lg border px-3 py-2">
              <span className="font-medium">{bi(item.area.fa, item.area.en)}</span>
              <span className="mx-2 text-muted-foreground">{item.state}</span>
              <span>{bi(item.note.fa, item.note.en)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ReportsScreen() {
  const { bi, state, view, track, logSecurity } = useApp();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const rows = useMemo(() => {
    if (!view) return [];
    return view.source.history.filter((point) => (!from || point.date >= from) && (!to || point.date <= to));
  }, [view, from, to]);
  function csv() {
    if (!view) return;
    const header = ["date", "overall", "listening", "reading", "writing", "speaking"];
    const body = rows.map((point) => [point.date, point.overall, point.bands.listening, point.bands.reading, point.bands.writing, point.bands.speaking].join(","));
    const blob = new Blob([[header.join(","), ...body].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ielts-readiness-demo.csv";
    link.click();
    URL.revokeObjectURL(url);
    track("report_exported", { format: "csv" });
    logSecurity("export", "csv");
    setMessage(bi("فایل CSV از داده‌های همین مرورگر ساخته شد.", "The CSV was built from this browser's data."));
  }
  return (
    <div className="print-root grid gap-4">
      <PageIntro title={bi("مرکز گزارش", "Reports")} lede={bi("CSV فایل واقعی از داده نمونه است. PDF از چاپ همین صفحه ساخته می‌شود و پیش‌نمایش چاپی است.", "CSV is a real file of the sample data. PDF uses the browser print dialog and is a print preview.")} />
      <div className="no-print flex flex-wrap gap-2">
        <Field label={bi("از", "From")} htmlFor="from"><input id="from" type="date" className={inputClass()} value={from} onChange={(event) => setFrom(event.target.value)} /></Field>
        <Field label={bi("تا", "To")} htmlFor="to"><input id="to" type="date" className={inputClass()} value={to} onChange={(event) => setTo(event.target.value)} /></Field>
      </div>
      {rows.length === 0 ? <EmptyBlock title={bi("نقطه‌ای در این بازه نیست", "No point in this range")} body={bi("بازه را خالی کنید یا تعیین سطح را تمام کنید.", "Clear the range, or finish the placement.")} /> : (
        <table className="w-full text-sm">
          <thead><tr>{["date", "overall", ...SKILLS].map((head) => <th key={head} className="py-1 text-start">{head}</th>)}</tr></thead>
          <tbody>
            {rows.map((point) => (
              <tr key={point.date} className="border-t">
                <td>{formatDate(point.date, state.locale)}</td>
                <td>{formatNumber(point.overall, state.locale, 1)}</td>
                {SKILLS.map((skill) => <td key={skill}>{formatNumber(point.bands[skill], state.locale, 1)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="no-print flex gap-2">
        <Button onClick={csv} disabled={!view}>{bi("دانلود CSV", "Download CSV")}</Button>
        <Button variant="outline" onClick={() => { track("report_exported", { format: "print" }); window.print(); }}>{bi("پیش‌نمایش چاپ / PDF", "Print / PDF preview")}</Button>
      </div>
      {message ? <p className="text-sm" role="status">{message}</p> : null}
      <p className="text-xs text-muted-foreground">{bi("رویدادهای مجاز در کاتالوگ تحلیل، متن پاسخ آموزشی را شامل نمی‌شوند.", "Events allowed in the analytics catalog do not include answer text.")}</p>
      <ul className="text-xs text-muted-foreground">
        {EVENT_CATALOG.slice(0, 4).map((event) => <li key={event.name}>{event.name}</li>)}
      </ul>
    </div>
  );
}

export function FeedbackScreen() {
  const { bi, state, addTicket } = useApp();
  const [kind, setKind] = useState<"feedback" | "bug" | "support" | "rating">("feedback");
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [page, setPage] = useState("/dashboard");
  const [rating, setRating] = useState("4");
  const [created, setCreated] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="grid gap-4">
      <PageIntro title={bi("بازخورد و گزارش خطا", "Feedback and bug reports")} lede={bi("تیکت در همین مرورگر می‌ماند و در پنل پشتیبان هم دیده می‌شود.", "The ticket stays in this browser and is also visible in the support panel.")} />
      <form className="grid gap-3 rounded-xl border bg-card p-4" onSubmit={(event) => {
        event.preventDefault();
        if (topic.trim().length < 3 || body.trim().length < 8) {
          setError(bi("موضوع و شرح را کمی بلندتر بنویسید.", "Write a slightly longer subject and description."));
          return;
        }
        const id = addTicket({ kind, topic, body, page, rating: kind === "rating" ? Number(rating) : undefined });
        setCreated(id);
        setError("");
        setTopic("");
        setBody("");
      }}>
        <Field label={bi("نوع", "Type")} htmlFor="kind">
          <select id="kind" className={inputClass()} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
            <option value="feedback">{bi("پیشنهاد", "Suggestion")}</option>
            <option value="bug">{bi("خطا", "Bug")}</option>
            <option value="support">{bi("درخواست پشتیبانی", "Support request")}</option>
            <option value="rating">{bi("امتیاز تمرین", "Exercise rating")}</option>
          </select>
        </Field>
        <Field label={bi("صفحه", "Page")} htmlFor="page">
          <input id="page" className={inputClass()} value={page} onChange={(event) => setPage(event.target.value)} />
        </Field>
        <Field label={bi("موضوع", "Subject")} htmlFor="topic" error={error}>
          <input id="topic" className={inputClass(Boolean(error))} value={topic} onChange={(event) => setTopic(event.target.value)} />
        </Field>
        <Field label={bi("شرح", "Details")} htmlFor="body">
          <textarea id="body" className={`${inputClass()} h-28 py-2`} value={body} onChange={(event) => setBody(event.target.value)} />
        </Field>
        {kind === "rating" ? (
          <Field label={bi("امتیاز", "Rating")} htmlFor="rating">
            <input id="rating" className={inputClass()} value={rating} onChange={(event) => setRating(event.target.value)} inputMode="numeric" />
          </Field>
        ) : null}
        <Button type="submit">{bi("ثبت", "Submit")}</Button>
        {created ? <p role="status" className="text-sm">{bi(`تیکت ${created} با وضعیت باز ثبت شد.`, `Ticket ${created} was saved as open.`)}</p> : null}
      </form>
      <ul className="grid gap-2 text-sm">
        {state.tickets.map((ticket) => (
          <li key={ticket.id} className="rounded-lg border px-3 py-2">{ticket.topic} · {ticket.status} · {formatDate(ticket.createdAt, state.locale)}</li>
        ))}
      </ul>
    </div>
  );
}

export function PlansScreen() {
  const { bi } = useApp();
  const rows = [
    [bi("تعیین سطح کوتاه", "Short placement"), bi("بله", "Yes"), bi("بله، با بانک کامل‌تر", "Yes, with a fuller bank")],
    [bi("برنامه قابل‌ویرایش", "Editable plan"), bi("بله", "Yes"), bi("بله", "Yes")],
    [bi("آزمونک نامحدود نمایشی", "Unlimited demo mocks"), bi("بله", "Yes"), bi("بله", "Yes")],
    [bi("تصحیح انسانی نوشتن", "Human writing review"), bi("نه", "No"), bi("در نقشه آینده، نه الان", "On the future map, not now")],
    [bi("پرداخت", "Payment"), bi("ندارد", "None"), bi("این صفحه خرید را اجرا نمی‌کند", "This page does not take payment")],
  ];
  return (
    <div>
      <PageIntro title={bi("پلن‌ها", "Plans")} lede={bi("نسخه اولیه رایگان است. این مقایسه فقط برای دیدن تجربه آینده است. دکمه خرید وجود ندارد.", "The first version is free. This comparison only previews a future offer. There is no buy button.")} />
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="px-3 py-2 text-start">{bi("قابلیت", "Capability")}</th>
              <th className="px-3 py-2 text-start">Free</th>
              <th className="px-3 py-2 text-start">Pro</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} className="border-t">
                {row.map((cell) => <td key={cell} className="px-3 py-2">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{bi("Pro یک برچسب محصول آینده است، نه چیزی که بتوان فعال کرد.", "Pro is a label for a future product, not something you can turn on.")}</p>
    </div>
  );
}

export function LabScreen() {
  const { bi, state, view, setDataSource, setOverrides, saveLab, loadLab, deleteLab } = useApp();
  const [name, setName] = useState("");
  const base = state.dataSource === "self" ? null : SCENARIOS[state.dataSource];
  const overrides = state.labOverrides ?? {};
  function update(partial: LabOverrides) {
    setOverrides({ ...overrides, ...partial });
  }
  const bands = overrides.bands ?? view?.source.bands ?? base?.bands;
  return (
    <div className="grid gap-4">
      <PageIntro title={bi("آزمایشگاه سناریو", "Scenario lab")} lede={bi("تغییر این عددها داشبورد، گزارش و برنامه را با هم عوض می‌کند. داده‌ها کاربر واقعی نیستند.", "Changing these numbers updates the dashboard, report, and plan together. The data is not a real learner.")} />
      <div className="flex flex-wrap gap-2">
        {(["A", "B", "C", "self"] as const).map((id) => (
          <Button key={id} size="sm" variant={state.dataSource === id ? "default" : "outline"} onClick={() => setDataSource(id)}>
            {id === "self" ? bi("داده خودم", "My data") : bi(SCENARIOS[id].person.fa, SCENARIOS[id].person.en)}
          </Button>
        ))}
      </div>
      {(["A", "B", "C"] as const).map((id) => (
        <p key={id} className="text-sm text-muted-foreground">{id}: {bi(SCENARIOS[id].summary.fa, SCENARIOS[id].summary.en)}</p>
      ))}
      {bands ? (
        <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
          {SKILLS.map((skill) => (
            <label key={skill} className="text-sm">
              {skill}
              <input className={`${inputClass()} mt-1`} type="number" step="0.5" min={1} max={9} value={bands[skill]} onChange={(event) => update({ bands: { ...bands, [skill]: Number(event.target.value) } })} />
            </label>
          ))}
          <label className="text-sm">{bi("هدف کلی", "Overall target")}
            <input className={`${inputClass()} mt-1`} type="number" step="0.5" value={overrides.targetOverall ?? view?.source.targetOverall ?? 6} onChange={(event) => update({ targetOverall: Number(event.target.value) })} />
          </label>
          <label className="text-sm">{bi("دقیقه روزانه", "Daily minutes")}
            <input className={`${inputClass()} mt-1`} type="number" value={overrides.dailyMinutes ?? view?.source.dailyMinutes ?? 60} onChange={(event) => update({ dailyMinutes: Number(event.target.value) })} />
          </label>
          <label className="text-sm">{bi("روز در هفته", "Days per week")}
            <input className={`${inputClass()} mt-1`} type="number" value={overrides.daysPerWeek ?? view?.source.daysPerWeek ?? 5} onChange={(event) => update({ daysPerWeek: Number(event.target.value) })} />
          </label>
          <label className="text-sm">{bi("فاصله آزمون به روز، خالی یعنی نامعلوم", "Days until the exam, empty means unknown")}
            <input className={`${inputClass()} mt-1`} value={overrides.examOffsetDays ?? ""} onChange={(event) => update({ examOffsetDays: event.target.value === "" ? null : Number(event.target.value) })} />
          </label>
          <label className="text-sm">{bi("پایبندی", "Adherence")}
            <input className={`${inputClass()} mt-1`} type="number" value={overrides.adherence ?? view?.source.adherence ?? 0} onChange={(event) => update({ adherence: Number(event.target.value) })} />
          </label>
          <label className="text-sm">{bi("روند نمره کلی", "Overall trend")}
            <input className={`${inputClass()} mt-1`} type="number" step="0.5" value={overrides.trend ?? view?.source.trend ?? 0} onChange={(event) => update({ trend: Number(event.target.value) })} />
          </label>
        </div>
      ) : <EmptyBlock title={bi("داده خودتان هنوز نمره ندارد", "Your own data has no band yet")} body={bi("یک سناریو را انتخاب کنید یا تعیین سطح را تمام کنید.", "Pick a scenario, or finish the placement.")} />}
      {view ? (
        <Callout title={bi("اثر فعلی", "Current effect")}>
          {bi(`آمادگی ${formatNumber(view.readiness.score, state.locale)} و کلی ${formatNumber(view.overall, state.locale, 1)}. مسیر برنامه: ${view.plan.path}.`, `Readiness ${formatNumber(view.readiness.score, state.locale)} and overall ${formatNumber(view.overall, state.locale, 1)}. Plan path: ${view.plan.path}.`)}
        </Callout>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <input className={inputClass()} value={name} onChange={(event) => setName(event.target.value)} aria-label={bi("نام سناریو", "Scenario name")} placeholder={bi("نام برای ذخیره", "Name to save")} />
        <Button variant="outline" onClick={() => name.trim() && saveLab(name.trim())}>{bi("ذخیره", "Save")}</Button>
        <Button variant="outline" onClick={() => setOverrides(null)}>{bi("بازنشانی مقادیر", "Reset values")}</Button>
      </div>
      <ul className="grid gap-2 text-sm">
        {state.savedLabs.map((lab) => (
          <li key={lab.id} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
            <span>{lab.name}</span>
            <Button size="sm" variant="outline" onClick={() => loadLab(lab.id)}>{bi("بارگذاری", "Load")}</Button>
            <Button size="sm" variant="ghost" onClick={() => deleteLab(lab.id)}>{bi("حذف", "Delete")}</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
