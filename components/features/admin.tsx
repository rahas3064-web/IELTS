"use client";

import Link from "@/components/link";
import { useMemo, useState, type ReactNode } from "react";
import { PageIntro, StateBadge } from "@/components/product/bits";
import { Button } from "@/components/ui/button";
import { canOpen, ROLE_LABEL } from "@/lib/access";
import { sampleAnalytics, sumRows } from "@/lib/analytics-sample";
import { DELIVERY_TASKS, KNOWN_ISSUES, RELEASES } from "@/lib/delivery";
import { EVENT_CATALOG, EXPERIMENTS } from "@/lib/experiments";
import { BANK } from "@/lib/questions";
import { useApp } from "@/lib/store";
import type { DeliveryStatus, PublishStatus } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/format";

export function AdminGate({ children, path }: { children: ReactNode; path: string }) {
  const { bi, state, setRole } = useApp();
  if (!state.account) return null;
  if (!canOpen(state.account.role, path)) {
    return (
      <div className="grid gap-3">
        <PageIntro title={bi("این نقش به صفحه دسترسی نمایشی ندارد", "This role does not have demo access to the page")} lede={bi("محدودیت فقط در رابط است. نقش را عوض کنید تا صفحه را ببینید.", "The limit is only in the interface. Change the role to view the page.")} />
        <p className="text-sm">{bi(ROLE_LABEL[state.account.role].fa, ROLE_LABEL[state.account.role].en)}</p>
        <Button onClick={() => setRole("system_admin")}>{bi("ادامه به‌عنوان مدیر سیستم نمونه", "Continue as the sample system admin")}</Button>
      </div>
    );
  }
  return children;
}

export function AdminHome() {
  const { bi } = useApp();
  const links = [
    ["/admin/analytics", bi("تحلیل محصول", "Product analytics")],
    ["/admin/content", bi("بانک سؤال", "Question bank")],
    ["/admin/users", bi("کاربران و نقش‌ها", "Users and roles")],
    ["/admin/feedback", bi("بازخورد", "Feedback")],
    ["/admin/experiments", bi("آزمایش‌ها", "Experiments")],
    ["/admin/roadmap", bi("نسخه و اسپرینت", "Releases and sprints")],
    ["/admin/settings", bi("تنظیمات", "Settings")],
    ["/admin/design-system", bi("سیستم طراحی", "Design system")],
  ];
  return (
    <div>
      <PageIntro title={bi("پنل مدیریت", "Admin")} lede={bi("نقش‌ها شبیه‌سازی شده‌اند. دسترسی واقعی باید در سرور باشد.", "Roles are simulated. Real access must live on the server.")} />
      <ul className="grid gap-2 sm:grid-cols-2">
        {links.map(([href, label]) => (
          <li key={href}><Link href={href} className="block rounded-xl border bg-card px-4 py-3 hover:bg-muted">{label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export function AnalyticsScreen() {
  const { bi, state } = useApp();
  const [windowDays, setWindowDays] = useState(28);
  const rows = useMemo(() => sampleAnalytics(42).slice(-windowDays), [windowDays]);
  const totals = sumRows(rows);
  const previous = sumRows(sampleAnalytics(42).slice(-(windowDays * 2), -windowDays));
  const funnel = [
    [bi("ثبت‌نام", "Signups"), totals.signups],
    [bi("شروع تعیین سطح", "Placement started"), totals.placementsStarted],
    [bi("اتمام تعیین سطح", "Placement finished"), totals.placementsCompleted],
    [bi("شروع برنامه", "Plan started"), totals.plansStarted],
  ];
  const max = Math.max(...rows.map((row) => row.signups), 1);
  return (
    <div className="grid gap-4">
      <PageIntro title={bi("تحلیل محصول", "Product analytics")} lede={bi("عددهای این نمودار نمونه ساختگی‌اند، نه کاربران واقعی. رویدادهای همین مرورگر پایین صفحه جدا شده‌اند.", "The chart figures are fictional, not real users. Events from this browser are listed separately below.")} actions={<StateBadge state="simulated" />} />
      <div className="flex gap-2">
        {[7, 28, 42].map((days) => <Button key={days} size="sm" variant={windowDays === days ? "default" : "outline"} onClick={() => setWindowDays(days)}>{days}</Button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {funnel.map(([label, value]) => (
          <article key={String(label)} className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatNumber(Number(value), state.locale)}</p>
          </article>
        ))}
      </div>
      <p className="text-sm">{bi(`نرخ اتمام تعیین سطح در این بازه: ${formatNumber(totals.placementsStarted ? Math.round((totals.placementsCompleted / totals.placementsStarted) * 100) : 0, state.locale)} درصد. بازه قبلی ${formatNumber(previous.placementsCompleted, state.locale)} اتمام داشت.`, `Placement completion in this window: ${formatNumber(totals.placementsStarted ? Math.round((totals.placementsCompleted / totals.placementsStarted) * 100) : 0, state.locale)} percent. The previous window had ${formatNumber(previous.placementsCompleted, state.locale)} completions.`)}</p>
      <svg viewBox={`0 0 ${rows.length * 12} 80`} className="w-full text-primary" role="img" aria-label={bi("نمودار ثبت‌نام روزانه نمونه", "Sample daily signup chart")}>
        {rows.map((row, index) => (
          <rect key={row.date} x={index * 12 + 2} y={80 - (row.signups / max) * 70} width="8" height={(row.signups / max) * 70} fill="currentColor" />
        ))}
      </svg>
      <p className="text-sm">{bi(`بازگشت نمونه: ${formatNumber(totals.returned, state.locale)}. تمایل به قابلیت پولی آینده: ${formatNumber(totals.proIntent, state.locale)}. این تبدیل واقعی نیست.`, `Sample return visits: ${formatNumber(totals.returned, state.locale)}. Interest in a future paid feature: ${formatNumber(totals.proIntent, state.locale)}. This is not a real conversion.`)}</p>
      <section>
        <h2 className="font-semibold">{bi("رویدادهای این مرورگر", "Events from this browser")}</h2>
        {state.events.length === 0 ? <p className="text-sm text-muted-foreground">{bi("رضایت تحلیل خاموش است یا هنوز رویدادی ثبت نشده.", "Analytics consent is off, or nothing has been recorded yet.")}</p> : (
          <ul className="mt-2 text-sm">{state.events.slice(-12).map((event, index) => <li key={index}>{event.name} · {formatDate(event.at, state.locale)}</li>)}</ul>
        )}
      </section>
      <section>
        <h2 className="font-semibold">{bi("کاتالوگ رویداد", "Event catalog")}</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead><tr>{[bi("نام", "Name"), bi("زمان", "When"), bi("ویژگی‌ها", "Properties"), bi("شاخص", "Metric")].map((head) => <th key={head} className="py-1 text-start">{head}</th>)}</tr></thead>
            <tbody>
              {EVENT_CATALOG.map((event) => (
                <tr key={event.name} className="border-t">
                  <td className="py-1">{event.name}</td>
                  <td>{bi(event.when.fa, event.when.en)}</td>
                  <td>{event.props.join(", ")}</td>
                  <td>{event.metric}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function ContentScreen() {
  const { bi, state, setQuestionStatus } = useApp();
  const [skill, setSkill] = useState("all");
  const [status, setStatus] = useState("all");
  const items = BANK.filter((item) => (skill === "all" || item.skill === skill) && (status === "all" || (state.questionStatus[item.id] ?? item.status) === status));
  return (
    <div>
      <PageIntro title={bi("بانک سؤال", "Question bank")} lede={bi("محتوا غیررسمی و آموزشی است. تغییر وضعیت فقط در همین مرورگر ذخیره می‌شود.", "The content is unofficial and educational. Status changes are saved only in this browser.")} />
      <div className="mb-3 flex gap-2">
        <select className="h-9 rounded-md border bg-card px-2" value={skill} onChange={(event) => setSkill(event.target.value)} aria-label={bi("مهارت", "Skill")}>
          <option value="all">{bi("همه مهارت‌ها", "All skills")}</option>
          <option value="listening">listening</option>
          <option value="reading">reading</option>
          <option value="writing">writing</option>
          <option value="speaking">speaking</option>
        </select>
        <select className="h-9 rounded-md border bg-card px-2" value={status} onChange={(event) => setStatus(event.target.value)} aria-label={bi("وضعیت انتشار", "Publish status")}>
          <option value="all">{bi("همه وضعیت‌ها", "All statuses")}</option>
          <option value="draft">draft</option>
          <option value="in_review">in_review</option>
          <option value="published">published</option>
          <option value="retired">retired</option>
        </select>
      </div>
      {items.length === 0 ? <p className="text-sm text-muted-foreground">{bi("سؤالی با این فیلتر نیست.", "No question matches this filter.")}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead><tr>{["ID", bi("مهارت", "Skill"), bi("نسخه", "Version"), bi("وضعیت", "Status")].map((head) => <th key={head} className="py-1 text-start">{head}</th>)}</tr></thead>
            <tbody>
              {items.map((item) => {
                const current = state.questionStatus[item.id] ?? item.status;
                return (
                  <tr key={item.id} className="border-t">
                    <td className="py-2">{item.id}</td>
                    <td>{item.skill}</td>
                    <td>{item.version}</td>
                    <td>
                      <select className="h-8 rounded-md border bg-card px-2" value={current} aria-label={`${item.id} status`} onChange={(event) => setQuestionStatus(item.id, event.target.value as PublishStatus)}>
                        {["draft", "in_review", "published", "retired"].map((option) => <option key={option}>{option}</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function UsersScreen() {
  const { bi, state } = useApp();
  const people = [
    { name: "آرمین رضایی", email: "armin@example.com", role: "learner", note: bi("سناریوی الف، خیالی", "Scenario A, fictional") },
    { name: "نگار حسینی", email: "negar@example.com", role: "learner", note: bi("سناریوی ب، خیالی", "Scenario B, fictional") },
    { name: "کیان احمدی", email: "kian@example.com", role: "learner", note: bi("سناریوی ج، خیالی", "Scenario C, fictional") },
    { name: "مدیر نمونه", email: "admin@example.com", role: "system_admin", note: bi("حساب ورود مدیر", "Admin sign-in") },
    ...state.accounts.filter((account) => !["armin@example.com", "negar@example.com", "kian@example.com", "admin@example.com"].includes(account.email)).map((account) => ({ name: account.name, email: account.email, role: account.role, note: bi("ساخته‌شده در این مرورگر", "Created in this browser") })),
  ];
  return (
    <div>
      <PageIntro title={bi("کاربران و نقش‌ها", "Users and roles")} lede={bi("فهرست نمونه است. نقش فعال شما را از پروفایل عوض کنید.", "This list is a sample. Change your active role from the profile.")} />
      <table className="w-full text-sm">
        <thead><tr>{[bi("نام", "Name"), bi("ایمیل", "Email"), bi("نقش", "Role"), bi("یادداشت", "Note")].map((head) => <th key={head} className="py-1 text-start">{head}</th>)}</tr></thead>
        <tbody>
          {people.map((person) => (
            <tr key={person.email} className="border-t">
              <td className="py-2">{person.name}</td>
              <td>{person.email}</td>
              <td>{person.role}</td>
              <td>{person.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminFeedbackScreen() {
  const { bi, state, setTicketStatus } = useApp();
  const [status, setStatus] = useState("all");
  const tickets = state.tickets.filter((ticket) => status === "all" || ticket.status === status);
  return (
    <div>
      <PageIntro title={bi("پیگیری بازخورد", "Feedback follow-up")} lede={bi("تیکت‌های همین مرورگر. اگر چیزی ثبت نشده، فهرست خالی درست است.", "Tickets from this browser. An empty list is correct when nothing has been sent.")} />
      <select className="mb-3 h-9 rounded-md border bg-card px-2" value={status} onChange={(event) => setStatus(event.target.value)} aria-label={bi("وضعیت", "Status")}>
        <option value="all">{bi("همه", "All")}</option>
        <option value="open">open</option>
        <option value="triage">triage</option>
        <option value="waiting">waiting</option>
        <option value="resolved">resolved</option>
      </select>
      {tickets.length === 0 ? <p className="text-sm text-muted-foreground">{bi("تیکتی در این فیلتر نیست.", "No ticket in this filter.")}</p> : tickets.map((ticket) => (
        <article key={ticket.id} className="mb-3 rounded-xl border p-4 text-sm">
          <h2 className="font-medium">{ticket.topic}</h2>
          <p className="text-muted-foreground">{ticket.page} · {ticket.kind}</p>
          <p className="mt-1">{ticket.body}</p>
          <select className="mt-2 h-9 rounded-md border bg-card px-2" value={ticket.status} aria-label={ticket.topic} onChange={(event) => setTicketStatus(ticket.id, event.target.value as typeof ticket.status)}>
            {["open", "triage", "waiting", "resolved"].map((option) => <option key={option}>{option}</option>)}
          </select>
        </article>
      ))}
    </div>
  );
}

export function ExperimentsScreen() {
  const { bi } = useApp();
  return (
    <div className="grid gap-3">
      <PageIntro title={bi("آزمایش محصول", "Product experiments")} lede={bi("فرضیه‌ها و نتیجه‌های این صفحه خیالی‌اند و تحقیق انجام‌شده نیستند.", "Hypotheses and results on this page are fictional. They are not completed research.")} actions={<StateBadge state="simulated" />} />
      {EXPERIMENTS.map((item) => (
        <article key={item.id} className="rounded-xl border p-4 text-sm leading-6">
          <p className="text-xs text-muted-foreground">{item.id} · {item.status} · {item.owner}</p>
          <h2 className="font-semibold">{bi(item.hypothesis.fa, item.hypothesis.en)}</h2>
          <p>{bi("مسئله", "Problem")}: {bi(item.problem.fa, item.problem.en)}</p>
          <p>{bi("مخاطب", "Audience")}: {bi(item.audience.fa, item.audience.en)}</p>
          <p>{bi("روش", "Method")}: {bi(item.method.fa, item.method.en)}</p>
          <p>{bi("معیار", "Success line")}: {bi(item.success.fa, item.success.en)}</p>
          <p>{bi("ریسک", "Risk")}: {bi(item.risk.fa, item.risk.en)}</p>
          <p>{bi("تصمیم", "Decision")}: {bi(item.decision.fa, item.decision.en)}</p>
        </article>
      ))}
    </div>
  );
}

export function RoadmapAdminScreen() {
  const { bi, state, setDeliveryStatus } = useApp();
  const columns: DeliveryStatus[] = ["backlog", "ready", "in_progress", "review", "blocked", "done"];
  return (
    <div className="grid gap-4">
      <PageIntro title={bi("نسخه‌ها و اسپرینت‌ها", "Releases and sprints")} lede={bi("از پروتوتایپ شروع می‌شود و قابلیت سنگین را به بعد می‌برد.", "It starts at the prototype and pushes heavy capability later.")} />
      <ul className="grid gap-2 md:grid-cols-2">
        {RELEASES.map((release) => (
          <li key={release.id} className="rounded-xl border p-3 text-sm">
            <p className="font-medium">{release.name} · {release.status}</p>
            <p className="text-muted-foreground">{bi(release.goal.fa, release.goal.en)}</p>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 lg:grid-cols-3">
        {columns.map((column) => (
          <section key={column}>
            <h2 className="mb-2 text-sm font-semibold">{column}</h2>
            <div className="grid gap-2">
              {DELIVERY_TASKS.filter((task) => (state.deliveryStatus[task.id] ?? task.status) === column).map((task) => (
                <article key={task.id} className="rounded-xl border bg-card p-3 text-sm">
                  <p className="font-medium">{bi(task.title.fa, task.title.en)}</p>
                  <p className="text-muted-foreground">{task.sprint} · {task.release} · {task.owner}</p>
                  <p className="mt-1">{bi(task.acceptance.fa, task.acceptance.en)}</p>
                  {task.dependsOn.length ? <p className="text-xs">{bi("وابسته به", "Depends on")} {task.dependsOn.join(", ")}</p> : null}
                  <select className="mt-2 h-8 w-full rounded-md border bg-card px-2" value={state.deliveryStatus[task.id] ?? task.status} aria-label={task.id} onChange={(event) => setDeliveryStatus(task.id, event.target.value as DeliveryStatus)}>
                    {columns.map((option) => <option key={option}>{option}</option>)}
                  </select>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
      <section>
        <h2 className="font-semibold">{bi("مشکل‌های شناخته‌شده", "Known issues")}</h2>
        <ul className="mt-2 text-sm">{KNOWN_ISSUES.map((issue) => <li key={issue.id}>{issue.area}: {bi(issue.title.fa, issue.title.en)}</li>)}</ul>
      </section>
    </div>
  );
}

export function SettingsScreen() {
  const { bi, state } = useApp();
  return (
    <div className="grid gap-3 text-sm leading-6">
      <PageIntro title={bi("تنظیمات سامانه", "System settings")} lede={bi("این مقادیر سیاست نمونه هستند، نه پیکربندی سرور.", "These values are sample policy, not a server configuration.")} />
      <p>{bi("نگهداری پاسخ آزمون: تا حذف حساب، و در نسخه واقعی حداکثر ۲۴ ماه پس از آخرین فعالیت.", "Test answers are kept until account deletion, and in a real version for at most 24 months after the last activity.")}</p>
      <p>{bi("جداسازی: رویداد تحلیلی متن پاسخ را ندارد. پروفایل و پاسخ آموزشی در خروجی جدا هستند.", "Separation: analytics events do not contain answer text. Profile and study answers export separately.")}</p>
      <p>{bi(`رضایت تحلیل این مرورگر: ${state.consentAnalytics ? "روشن" : "خاموش"}.`, `Analytics consent in this browser: ${state.consentAnalytics ? "on" : "off"}.`)}</p>
      <p>{bi("سیاست قطع اینترنت در آزمون زمان‌دار: زمان ادامه دارد، ارسال متوقف می‌شود، پاسخ محلی می‌ماند.", "Offline policy for a timed test: the clock continues, submission stops, and the local answers remain.")}</p>
    </div>
  );
}

export function DesignSystemScreen() {
  const { bi } = useApp();
  return (
    <div className="grid gap-4">
      <PageIntro title={bi("سیستم طراحی", "Design system")} lede={bi("حالت‌های اصلی مؤلفه‌های مشترک. بنفش برند است و معنا فقط با رنگ گفته نمی‌شود.", "Core states of the shared components. Violet is the brand, and meaning is not carried by color alone.")} />
      <div className="flex flex-wrap gap-2">
        <Button>{bi("اصلی", "Primary")}</Button>
        <Button variant="outline">{bi("حاشیه‌دار", "Outline")}</Button>
        <Button variant="ghost">{bi("سایه روشن", "Ghost")}</Button>
        <Button disabled>{bi("غیرفعال", "Disabled")}</Button>
        <Button variant="destructive">{bi("خطا", "Destructive")}</Button>
      </div>
      <input className="h-11 max-w-sm rounded-lg border px-3" placeholder={bi("ورودی", "Input")} aria-label={bi("نمونه ورودی", "Sample input")} />
      <input className="h-11 max-w-sm rounded-lg border border-destructive px-3" aria-invalid placeholder={bi("ورودی خطا", "Error input")} aria-label={bi("نمونه خطای ورودی", "Sample invalid input")} />
      <div className="grid gap-2">
        <StateBadge state="live" />
        <StateBadge state="simulated" />
        <StateBadge state="planned" />
      </div>
      <p className="text-sm text-muted-foreground">{bi("تم روشن و تاریک، اندازه متن و کاهش حرکت در پروفایل تنظیم می‌شوند.", "Light and dark theme, text size, and reduced motion are set in the profile.")}</p>
    </div>
  );
}
