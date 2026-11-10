import { toFa } from "@/components/features/bandora/content";
export type PanelLocale = "fa" | "en";

export const PANEL_NAV = [
  { id: "dashboard", href: "/app", fa: "داشبورد", en: "Dashboard", ready: true },
  { id: "placement", href: "/app/placement", fa: "تعیین سطح", en: "Placement", ready: false },
  { id: "plan", href: "/app/plan", fa: "برنامه مطالعه", en: "Study Plan", ready: false },
  { id: "practice", href: "/app/practice", fa: "تمرین", en: "Practice", ready: false },
  { id: "feedback", href: "/app/feedback", fa: "بازخورد هوش مصنوعی", en: "AI Feedback", ready: false },
  { id: "progress", href: "/app/progress", fa: "پیشرفت", en: "Progress", ready: false },
  { id: "mock", href: "/app/mock", fa: "آزمون آزمایشی", en: "Mock Exam", ready: false },
  { id: "profile", href: "/app/profile", fa: "پروفایل و تنظیمات", en: "Profile & Settings", ready: false },
  { id: "subscription", href: "/app/subscription", fa: "اشتراک", en: "Subscription", ready: false },
] as const;

export const BOTTOM_NAV = ["dashboard", "plan", "practice", "progress"] as const;

export type StudyTask = {
  id: string;
  title: string;
  minutes: number;
  done: boolean;
};

export const SKILL_FIELDS = [
  { id: "listening", fa: "شنیدن", en: "Listening" },
  { id: "reading", fa: "خواندن", en: "Reading" },
  { id: "writing", fa: "نوشتن", en: "Writing" },
  { id: "speaking", fa: "صحبت کردن", en: "Speaking" },
] as const;

export function isNavActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (href === "/app") return path === "/app";
  return path === href || path.startsWith(`${href}/`);
}

export function pageMeta(pathname: string, locale: PanelLocale) {
  const item = PANEL_NAV.find((nav) => isNavActive(pathname, nav.href));
  if (!item) {
    return { title: locale === "fa" ? "باندورا" : "Bandora", en: "Bandora", ready: false };
  }
  return { title: locale === "fa" ? item.fa : item.en, en: item.en, ready: item.ready };
}

export function greeting(locale: PanelLocale, name: string, hour: number): string {
  const slot = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  if (locale === "fa") {
    const lead = slot === "morning" ? "صبح بخیر" : slot === "afternoon" ? "روز بخیر" : "عصر بخیر";
    return `${lead} ${name}`;
  }
  const lead = slot === "morning" ? "Good morning" : slot === "afternoon" ? "Good afternoon" : "Good evening";
  return `${lead}, ${name}`;
}

export function levelProgress(current: number, target: number): number {
  if (target <= 0 || current <= 0) return 0;
  return Math.round(Math.min(1, current / target) * 100);
}

export function toggleTask(tasks: readonly StudyTask[], id: string): StudyTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : { ...task }));
}

export function taskSummary(tasks: readonly { done: boolean }[]) {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

export function taskLabel(task: Pick<StudyTask, "title" | "minutes">, locale: PanelLocale): string {
  const minutes = locale === "fa" ? toFa(task.minutes) : String(task.minutes);
  const unit = locale === "fa" ? "دقیقه" : "min";
  return `${task.title} · ${minutes} ${unit}`;
}

export type QuickAction = {
  id: "start" | "practice" | "placement" | "mock";
  href?: string;
  disabled?: boolean;
};

export function quickActions(placementDone: boolean): QuickAction[] {
  const items: QuickAction[] = [
    { id: "start", href: "#today-plan" },
    { id: "practice", href: "/app/practice" },
  ];
  if (!placementDone) items.push({ id: "placement", href: "/app/placement" });
  items.push({ id: "mock", disabled: true });
  return items;
}

export function unreadCount(notices: readonly { unread: boolean }[]): number {
  return notices.filter((notice) => notice.unread).length;
}

export function markNoticeRead(notices: readonly { id: string; unread: boolean }[], id: string) {
  return notices.map((notice) => (notice.id === id ? { ...notice, unread: false } : { ...notice }));
}

export function formatBand(value: number, locale: PanelLocale): string {
  const text = value.toFixed(1);
  return locale === "fa" ? toFa(text).replace(".", "٫") : text;
}

export type AccountFact = {
  id: "email" | "phone" | "age" | "exam" | "target" | "minutes" | "days";
  value: string | number;
};

export type SkillScore = {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
};

export type AttemptCount = { correct: number; total: number };

/** Round to the nearest half band, clamped to the 0-9 IELTS scale. */
export function roundBand(value: number): number {
  const clamped = Math.min(9, Math.max(0, value));
  return Math.min(9, Math.max(0, Math.round(clamped * 2) / 2));
}

/** Overall band: the average of the four skills, rounded to the nearest half band. */
export function overallBand(bands: SkillScore): number {
  return roundBand((bands.listening + bands.reading + bands.writing + bands.speaking) / 4);
}

export type AccountView = {
  name: string;
  facts: AccountFact[];
  bands: SkillScore | null;
  overall: number | null;
  target: number | null;
  stats: {
    listening: AttemptCount | null;
    reading: AttemptCount | null;
    mockCount: number;
    lastMock: AttemptCount | null;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function finite(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function attempt(correct: unknown, total: unknown): AttemptCount | null {
  const done = finite(correct);
  const all = finite(total);
  if (done == null || all == null || !Number.isInteger(done) || !Number.isInteger(all) || all < 1) return null;
  return { correct: done, total: all };
}

export function readAccount(body: unknown): AccountView | null {
  const root = asRecord(body);
  const account = asRecord(root?.account);
  const name = text(account?.name);
  if (!name) return null;
  const profile = asRecord(root?.profile);
  const facts: AccountFact[] = [];
  const email = text(account?.email);
  const phone = text(account?.phone);
  const age = finite(account?.age);
  if (email) facts.push({ id: "email", value: email });
  if (phone) facts.push({ id: "phone", value: phone });
  if (age != null && Number.isInteger(age)) facts.push({ id: "age", value: age });
  if (profile?.examType === "academic" || profile?.examType === "general") facts.push({ id: "exam", value: profile.examType });
  const target = finite(profile?.targetOverall);
  const savedTarget = target != null && target >= 0 && target <= 9 ? target : null;
  if (savedTarget != null) facts.push({ id: "target", value: savedTarget });
  const minutes = finite(profile?.dailyMinutes);
  if (minutes != null && Number.isInteger(minutes) && minutes > 0) facts.push({ id: "minutes", value: minutes });
  const days = finite(profile?.daysPerWeek);
  if (days != null && Number.isInteger(days) && days >= 1 && days <= 7) facts.push({ id: "days", value: days });

  const placement = asRecord(root?.placement);
  const rawBands = asRecord(placement?.bands);
  const listening = finite(rawBands?.listening);
  const reading = finite(rawBands?.reading);
  const writing = finite(rawBands?.writing);
  const speaking = finite(rawBands?.speaking);
  const bands = listening != null && reading != null && writing != null && speaking != null
    ? { listening, reading, writing, speaking }
    : null;
  const objective = asRecord(placement?.objectiveCorrect);
  const mocks = Array.isArray(root?.mocks) ? root.mocks : [];
  const last = mocks.length > 0 ? asRecord(mocks[mocks.length - 1]) : null;
  return {
    name,
    facts,
    bands,
    overall: bands ? overallBand(bands) : null,
    target: savedTarget,
    stats: {
      listening: attempt(objective?.listening, objective?.listeningTotal),
      reading: attempt(objective?.reading, objective?.readingTotal),
      mockCount: mocks.length,
      lastMock: attempt(last?.correct, last?.total),
    },
  };
}

export function todayLabel(locale: PanelLocale, date: Date): string {
  return new Intl.DateTimeFormat(locale === "fa" ? "fa-IR" : "en-GB", {
    timeZone: "Asia/Tehran",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function panelCopy(locale: PanelLocale) {
  const fa = locale === "fa";
  return {
    skip: fa ? "پرش به محتوا" : "Skip to content",
    menu: fa ? "منو" : "Menu",
    close: fa ? "بستن" : "Close",
    lang: fa ? "زبان" : "Language",
    notices: fa ? "اعلان‌ها" : "Notifications",
    account: fa ? "حساب کاربری" : "Account",
    empty: fa ? "هنوز داده‌ای نیست" : "Nothing here yet",
    signIn: fa ? "ورود" : "Log in",
    signUp: fa ? "ثبت‌نام" : "Sign up",
    signInLead: fa ? "اول وارد شو تا اطلاعات خودت این‌جا بیاید" : "Log in so your own details show up here",
    accountTitle: fa ? "اطلاعات حساب" : "Account details",
    email: fa ? "ایمیل" : "Email",
    phone: fa ? "تلفن" : "Phone",
    age: fa ? "سن" : "Age",
    exam: fa ? "نوع آزمون" : "Exam",
    academic: fa ? "آکادمیک" : "Academic",
    general: fa ? "جنرال" : "General Training",
    daily: fa ? "دقیقه در روز" : "Minutes a day",
    days: fa ? "روز در هفته" : "Days a week",
    goal: fa ? "تکمیل هدف" : "Finish the goal",
    statsTitle: fa ? "آمار آزمون" : "Test results",
    listeningCorrect: fa ? "شنیدن" : "Listening",
    readingCorrect: fa ? "خواندن" : "Reading",
    mockCount: fa ? "آزمون آزمایشی داده‌شده" : "Mocks taken",
    lastMock: fa ? "آخرین آزمون" : "Latest mock",
    logout: fa ? "خروج" : "Log out",
    saving: fa ? "در حال ذخیره…" : "Saving…",
    saved: fa ? "ذخیره شد" : "Saved",
    saveError: fa ? "ذخیره نشد. دوباره تلاش کن." : "Could not save. Try again.",
    save: fa ? "ثبت" : "Save",
    add: fa ? "افزودن" : "Add",
    remove: fa ? "حذف" : "Delete",
    removeAsk: fa ? "این کار پاک شود؟" : "Delete this task?",
    nameLabel: fa ? "نام" : "Name",
    focusKicker: fa ? "تمرکز امروز" : "Today's focus",
    askName: fa ? "نامت را بنویس" : "Write your name",
    levelTitle: fa ? "سطح تو" : "Your level",
    current: fa ? "سطح" : "Level",
    bandNow: fa ? "نمره الان" : "Band now",
    target: fa ? "نمره هدف" : "Target band",
    planTitle: fa ? "برنامه امروز" : "Today's plan",
    taskTitle: fa ? "نام کار" : "Task",
    minutes: fa ? "دقیقه" : "Minutes",
    progressTitle: fa ? "مهارت‌ها" : "Skills",
    soon: fa ? "به‌زودی" : "Coming soon",
    soonBody: fa ? "این بخش هنوز آماده نیست." : "This part is not ready yet.",
    back: fa ? "بازگشت به داشبورد" : "Back to dashboard",
    start: fa ? "شروع برنامه امروز" : "Start today's plan",
    practice: fa ? "ادامه تمرین" : "Continue practice",
    placement: fa ? "شروع تعیین سطح" : "Take placement",
    mock: fa ? "آزمون آزمایشی" : "Open mock exam",
    signOut: fa ? "بازگشت به صفحه اصلی" : "Back to home",
    profile: fa ? "پروفایل و تنظیمات" : "Profile & settings",
    more: fa ? "بیشتر" : "More",
    nav: fa ? "ناوبری پنل" : "Panel navigation",
    shortcuts: fa ? "میانبرها" : "Shortcuts",
  };
}
