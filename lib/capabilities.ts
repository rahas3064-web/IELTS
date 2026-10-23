import type { Bi } from "@/lib/types";

export type Capability = {
  id: string;
  area: Bi;
  state: "live" | "simulated" | "planned";
  note: Bi;
};

export const CAPABILITIES: Capability[] = [
  { id: "nav", area: { fa: "ناوبری و صفحه‌ها", en: "Navigation and pages" }, state: "live", note: { fa: "مسیرها در همین برنامه به هم وصل‌اند.", en: "Routes in this app are connected." } },
  { id: "i18n", area: { fa: "فارسی، انگلیسی، راست‌به‌چپ", en: "Persian, English, right-to-left" }, state: "live", note: { fa: "انتخاب زبان در همین مرورگر می‌ماند.", en: "The language choice stays in this browser." } },
  { id: "theme", area: { fa: "تم روشن و تاریک", en: "Light and dark theme" }, state: "live", note: { fa: "با تنظیمات سامانه هم قابل‌انتخاب است.", en: "System theme can be selected too." } },
  { id: "score", area: { fa: "تخمین نمره و شاخص آمادگی", en: "Band estimate and readiness index" }, state: "live", note: { fa: "محاسبه واقعی روی داده نمونه یا پاسخ همین مرورگر است، اما رسمی نیست.", en: "The math really runs on sample data or this browser's answers. It is not official." } },
  { id: "plan", area: { fa: "برنامه قابل‌ویرایش", en: "Editable plan" }, state: "live", note: { fa: "تغییر فعالیت، پوشش مهارت را در همان صفحه عوض می‌کند.", en: "Editing a task changes skill coverage on the same page." } },
  { id: "lab", area: { fa: "آزمایشگاه سناریو", en: "Scenario lab" }, state: "live", note: { fa: "داشبورد، گزارش و برنامه از یک نمای مشترک می‌خوانند.", en: "Dashboard, report, and plan read one shared view." } },
  { id: "csv", area: { fa: "خروجی CSV", en: "CSV export" }, state: "live", note: { fa: "فایل از داده‌های همین مرورگر ساخته می‌شود.", en: "The file is built from this browser's data." } },
  { id: "auth", area: { fa: "ورود و رمز عبور", en: "Sign-in and password" }, state: "simulated", note: { fa: "رمز ذخیره نمی‌شود و نشست امن نیست.", en: "The password is not stored and the session is not secure." } },
  { id: "audio", area: { fa: "صوت شنیدن و تحلیل گفتار", en: "Listening audio and speech analysis" }, state: "simulated", note: { fa: "گفتار مصنوعی مرورگر یا رونوشت. تلفظ نمره ندارد.", en: "Browser speech synthesis or a transcript. Pronunciation is not scored." } },
  { id: "ai", area: { fa: "دستیار و تصحیح هوش مصنوعی", en: "Assistant and AI marking" }, state: "simulated", note: { fa: "پاسخ‌ها قالب‌های متصل به عددهای فعلی‌اند.", en: "Replies are templates tied to the current numbers." } },
  { id: "pay", area: { fa: "پرداخت و اشتراک", en: "Payment and subscription" }, state: "simulated", note: { fa: "دکمه خرید وجود ندارد.", en: "There is no purchase button." } },
  { id: "push", area: { fa: "ایمیل و پوش", en: "Email and push" }, state: "simulated", note: { fa: "اعلان‌ها فقط داخل برنامه دیده می‌شوند.", en: "Notices appear only inside the app." } },
  { id: "acl", area: { fa: "کنترل دسترسی مدیر", en: "Admin access control" }, state: "simulated", note: { fa: "نقش را خود کاربر در نمونه عوض می‌کند.", en: "In the demo, the person changes their own role." } },
  { id: "sync", area: { fa: "همگام‌سازی چنددستگاهی", en: "Multi-device sync" }, state: "planned", note: { fa: "داده‌ها فقط در localStorage همین مرورگرند.", en: "Data lives only in this browser's localStorage." } },
  { id: "bank", area: { fa: "بانک سؤال تولیدی", en: "Production question bank" }, state: "planned", note: { fa: "سؤال‌های فعلی آموزشی و غیررسمی‌اند.", en: "Current items are educational and unofficial." } },
];
