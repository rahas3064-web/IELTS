import type { Bi, DeliveryStatus, Priority } from "@/lib/types";

export type Release = {
  id: string;
  name: string;
  goal: Bi;
  status: "current" | "next" | "later";
};

export const RELEASES: Release[] = [
  {
    id: "0.1",
    name: "0.1 Prototype",
    goal: { fa: "مسیر قابل‌کلیک با داده سازگار و مستندات انتقال.", en: "A clickable path with consistent data and handoff docs." },
    status: "current",
  },
  {
    id: "0.2",
    name: "0.2 MVP",
    goal: { fa: "حساب واقعی، بانک سؤال و ذخیره پاسخ روی سرور.", en: "Real accounts, a question bank, and saved answers on a server." },
    status: "next",
  },
  {
    id: "0.3",
    name: "0.3 Scoring",
    goal: { fa: "نمره شنیدن و خواندن با جدول مستند، و بازخورد نوشتن با بازبین انسانی یا مدل کنترل‌شده.", en: "Listening and reading bands from a documented table, and writing feedback from a human or a controlled model." },
    status: "later",
  },
  {
    id: "0.4",
    name: "0.4 Speech",
    goal: { fa: "ضبط واقعی، رضایت جدا، و ارزیابی تلفظ فقط بعد از آزمون کیفیت.", en: "Real recording, separate consent, and pronunciation marking only after a quality trial." },
    status: "later",
  },
];

export type DeliveryTask = {
  id: string;
  release: string;
  sprint: string;
  title: Bi;
  goal: Bi;
  acceptance: Bi;
  priority: Priority;
  status: DeliveryStatus;
  owner: string;
  dependsOn: string[];
};

export const DELIVERY_TASKS: DeliveryTask[] = [
  {
    id: "T1",
    release: "0.1",
    sprint: "Sprint 1",
    title: { fa: "پوسته، زبان و تم", en: "Shell, language, and theme" },
    goal: { fa: "ناوبری راست‌به‌چپ و تغییر زبان.", en: "Right-to-left navigation and a language switch." },
    acceptance: { fa: "فارسی و انگلیسی و تم روشن و تاریک بین صفحه‌ها می‌مانند.", en: "Persian, English, and both themes persist across pages." },
    priority: "high",
    status: "done",
    owner: "Design",
    dependsOn: [],
  },
  {
    id: "T2",
    release: "0.1",
    sprint: "Sprint 1",
    title: { fa: "مسیر تعیین سطح", en: "Placement path" },
    goal: { fa: "چهار مهارت و قفل گزارش تا پایان هر چهار تا.", en: "Four skills, with the report locked until all four are done." },
    acceptance: { fa: "گزارش قبل از مهارت چهارم باز نمی‌شود.", en: "The report does not open before the fourth skill." },
    priority: "high",
    status: "done",
    owner: "Learner",
    dependsOn: ["T1"],
  },
  {
    id: "T3",
    release: "0.1",
    sprint: "Sprint 2",
    title: { fa: "شاخص آمادگی و سه سناریو", en: "Readiness index and three scenarios" },
    goal: { fa: "یک فرمول مشترک برای داشبورد، گزارش و برنامه.", en: "One formula shared by the dashboard, report, and plan." },
    acceptance: { fa: "تغییر سناریو در آزمایشگاه هر سه نما را با هم عوض می‌کند.", en: "Changing the scenario in the lab updates all three views together." },
    priority: "high",
    status: "done",
    owner: "Product",
    dependsOn: ["T2"],
  },
  {
    id: "T4",
    release: "0.2",
    sprint: "Sprint 3",
    title: { fa: "احراز هویت سرور", en: "Server authentication" },
    goal: { fa: "جایگزینی ورود نمایشی با نشست امن.", en: "Replace the demo sign-in with a secure session." },
    acceptance: { fa: "رمز عبور هش می‌شود و مسیرهای یادگیرنده بدون نشست باز نمی‌شوند.", en: "Passwords are hashed and learner routes reject a missing session." },
    priority: "high",
    status: "ready",
    owner: "Platform",
    dependsOn: [],
  },
  {
    id: "T5",
    release: "0.2",
    sprint: "Sprint 3",
    title: { fa: "بانک سؤال نسخه‌دار", en: "Versioned question bank" },
    goal: { fa: "انتشار سؤال بدون تغییر آزمون‌های قبلی.", en: "Publish questions without changing past attempts." },
    acceptance: { fa: "هر تلاش، نسخه سؤال را ذخیره می‌کند.", en: "Each attempt stores the question version." },
    priority: "high",
    status: "backlog",
    owner: "Content",
    dependsOn: ["T4"],
  },
  {
    id: "T6",
    release: "0.3",
    sprint: "Sprint 4",
    title: { fa: "سرویس نمره و محدودیت اطمینان", en: "Scoring service and confidence limits" },
    goal: { fa: "جدا کردن قاعده نمره از رابط.", en: "Separate the scoring rules from the interface." },
    acceptance: { fa: "خروجی شامل نمره، بازه و فهرست شواهد است.", en: "The output includes the band, the range, and the evidence list." },
    priority: "high",
    status: "backlog",
    owner: "Scoring",
    dependsOn: ["T5"],
  },
  {
    id: "T7",
    release: "0.3",
    sprint: "Sprint 5",
    title: { fa: "ارزیابی نوشتن", en: "Writing evaluation" },
    goal: { fa: "جایگزینی قاعده طول با بازبینی قابل‌ممیزی.", en: "Replace the length rule with an auditable review." },
    acceptance: { fa: "هر معیار نقل‌قول یا برچسب خطا دارد و تلفظ جعل نمی‌شود.", en: "Each criterion has a quote or an error tag, and pronunciation is not invented." },
    priority: "medium",
    status: "blocked",
    owner: "Scoring",
    dependsOn: ["T6"],
  },
  {
    id: "T8",
    release: "0.4",
    sprint: "Sprint 6",
    title: { fa: "صوت و رضایت جدا", en: "Audio and separate consent" },
    goal: { fa: "ذخیره صدا فقط با رضایت مشخص.", en: "Store audio only with specific consent." },
    acceptance: { fa: "بدون رضایت، دکمه ضبط فایل نمی‌سازد.", en: "Without consent, record does not create a file." },
    priority: "medium",
    status: "backlog",
    owner: "Platform",
    dependsOn: ["T4"],
  },
  {
    id: "T9",
    release: "0.2",
    sprint: "Sprint 4",
    title: { fa: "تحلیل محصول با رضایت", en: "Product analytics with consent" },
    goal: { fa: "رویدادها بدون متن پاسخ آموزشی.", en: "Events without the text of study answers." },
    acceptance: { fa: "رد رضایت، ارسال رویداد را متوقف می‌کند.", en: "Refusing consent stops event dispatch." },
    priority: "medium",
    status: "ready",
    owner: "Product",
    dependsOn: ["T4"],
  },
];

export const KNOWN_ISSUES: { id: string; title: Bi; area: string }[] = [
  {
    id: "K1",
    title: { fa: "صوت شنیدن، گفتار مصنوعی مرورگر است نه فایل آزمون.", en: "Listening audio is browser speech synthesis, not a test recording." },
    area: "Listening",
  },
  {
    id: "K2",
    title: { fa: "رمز عبور ذخیره نمی‌شود و ورود بعدی امنیت واقعی ندارد.", en: "The password is not stored, so a later sign-in is not real security." },
    area: "Auth",
  },
  {
    id: "K3",
    title: { fa: "نقش‌ها فقط در رابط محدود می‌شوند.", en: "Roles are restricted only in the interface." },
    area: "Access",
  },
];
