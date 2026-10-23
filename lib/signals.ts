import type { LearnerView } from "@/lib/model";
import type { AppState, Bi, Skill } from "@/lib/types";
import { SKILLS } from "@/lib/types";

export type Notice = {
  id: string;
  priority: "high" | "medium" | "low";
  kind: "exam" | "plan" | "daily" | "performance" | "motivation";
  title: Bi;
  body: Bi;
};

export function buildNotices(view: LearnerView | null, prefs: AppState["notificationPrefs"]): Notice[] {
  if (!view) return [];
  const items: Notice[] = [];
  const weak = view.bottleneck;
  if (view.daysLeft != null && view.daysLeft <= 30) {
    items.push({
      id: "exam-soon",
      priority: view.daysLeft <= 21 ? "high" : "medium",
      kind: "exam",
      title: { fa: "تاریخ آزمون نزدیک است", en: "The exam date is close" },
      body: {
        fa: `${view.daysLeft} روز مانده است. برنامه را با همین واقعیت بسنجید، نه با یک هدف مجرد.`,
        en: `${view.daysLeft} days remain. Judge the plan against that fact, not against the target alone.`,
      },
    });
  }
  if (prefs.plan && view.source.adherence < 75) {
    items.push({
      id: "behind",
      priority: "high",
      kind: "plan",
      title: { fa: "برنامه از حجم واقع‌بینانه جلو زده است", en: "The plan is ahead of a realistic pace" },
      body: {
        fa: `پایبندی حدود ${view.source.adherence} درصد است. این عدد علت را ثابت نمی‌کند؛ فقط حجم انجام‌نشده را نشان می‌دهد.`,
        en: `Adherence is about ${view.source.adherence} percent. That shows unfinished volume. It does not prove a cause.`,
      },
    });
  }
  if (prefs.performance && weak) {
    items.push({
      id: `gap-${weak.skill}`,
      priority: "medium",
      kind: "performance",
      title: { fa: "مهارت محدودکننده عوض نشده", en: "The limiting skill has not moved" },
      body: weak.title,
    });
  }
  if (prefs.daily) {
    items.push({
      id: "daily",
      priority: "medium",
      kind: "daily",
      title: { fa: "گزارش پایان امروز آماده است", en: "Today's closing note is ready" },
      body: {
        fa: "زمان، تمرین‌های انجام‌شده و اولویت فردا در پیگیری پیشرفت است.",
        en: "Time, finished practice, and tomorrow's priority are on the progress page.",
      },
    });
  }
  if (prefs.motivation && view.badges.some((badge) => badge.earned)) {
    const badge = view.badges.find((item) => item.earned);
    if (badge) {
      items.push({
        id: `badge-${badge.id}`,
        priority: "low",
        kind: "motivation",
        title: { fa: "یک نشان برای کار انجام‌شده", en: "A badge for work already done" },
        body: badge.title,
      });
    }
  }
  return items;
}

export function assistantReply(message: string, view: LearnerView | null): { text: Bi; exerciseId?: string } {
  const text = message.toLowerCase();
  const weak = view?.bottleneck?.skill;
  const skillHit = (SKILLS as readonly Skill[]).find((skill) => text.includes(skill) || (skill === "listening" && /شنید|لیسن/.test(message)) || (skill === "reading" && /خواند|ریدینگ/.test(message)) || (skill === "writing" && /نوشت|رایتینگ/.test(message)) || (skill === "speaking" && /صحبت|اسپیکینگ/.test(message)));
  const focus = skillHit ?? weak ?? "writing";
  const exercise: Record<Skill, string> = {
    listening: "P-L1",
    reading: "P-R1",
    writing: "P-W1",
    speaking: "P-S1",
  };
  if (/برنامه|plan|عقب/.test(message) || /plan/.test(text)) {
    return {
      exerciseId: exercise[focus],
      text: {
        fa: view
          ? `برنامه فعلی مسیر «${view.plan.path}» است و پایبندی حدود ${view.source.adherence} درصد. اگر حجم زیاد است، فعالیت کم‌اولویت را حذف کنید، نه اینکه ساعت خیالی اضافه کنید. این پاسخ از روی عددهای همین صفحه ساخته شده است.`
          : "هنوز برآوردی نیست. اول تعیین سطح را تمام کنید.",
        en: view
          ? `The current plan uses the “${view.plan.path}” path and adherence is about ${view.source.adherence} percent. If the volume is too high, drop a low-priority task instead of inventing extra hours. This reply is built from the numbers on this page.`
          : "There is no estimate yet. Finish the placement first.",
      },
    };
  }
  if (/نمره|band|score|تضمین/.test(message) || /score|band/.test(text)) {
    return {
      text: {
        fa: view
          ? `نمره کلی نمایشی ${view.overall.toFixed(1)} است و بازه ${view.range.low.toFixed(1)} تا ${view.range.high.toFixed(1)} را فقط به‌خاطر کمبود شواهد نشان می‌دهیم. این عدد احتمال قبولی نیست و تضمین نمی‌شود.`
          : "نمره‌ای برای گزارش وجود ندارد.",
        en: view
          ? `The demo overall is ${view.overall.toFixed(1)}, with a range of ${view.range.low.toFixed(1)} to ${view.range.high.toFixed(1)} because the evidence is thin. This is not a pass probability and it is not guaranteed.`
          : "There is no score to report.",
      },
    };
  }
  return {
    exerciseId: exercise[focus],
    text: {
      fa: view
        ? `تمرکز پیشنهادی روی ${focus} است، چون در داده‌های فعلی بیشترین فاصله یا اولویت را دارد. یک تمرین کوتاه مرتبط پایین صفحه است. من به مدل زبانی وصل نیستم.`
        : "بعد از تعیین سطح می‌توانم تمرین را به شکاف همان نتیجه وصل کنم. الان فقط پاسخ آماده دارم.",
      en: view
        ? `The suggested focus is ${focus}, because it has the largest gap or the highest priority in the current data. A short related exercise is linked below. I am not connected to a language model.`
        : "After the placement I can tie practice to that result. Right now I only have prepared replies.",
    },
  };
}

export const FAQ: { q: Bi; a: Bi }[] = [
  {
    q: { fa: "آیا این نمره، نمره رسمی آیلتس است؟", en: "Is this an official IELTS score?" },
    a: { fa: "نه. تعیین سطح کوتاه و غیررسمی است و جدول نمره آزمون رسمی را به کار نمی‌برد.", en: "No. The placement is short and unofficial, and it does not use the official raw-score table." },
  },
  {
    q: { fa: "اگر اینترنت وسط آزمون قطع شود چه می‌شود؟", en: "What if the connection drops during a test?" },
    a: { fa: "زمان متوقف نمی‌شود. پاسخ‌ها در همین مرورگر می‌مانند و ارسال تا اتصال دوباره انجام نمی‌شود.", en: "The clock keeps running. Answers stay in this browser, and submission waits until the connection returns." },
  },
  {
    q: { fa: "آیا پرداختی در کار است؟", en: "Is there a payment?" },
    a: { fa: "نه. نسخه اولیه رایگان فرض شده و صفحه پلن‌ها فقط تجربه آینده را نشان می‌دهد.", en: "No. The first version is assumed to be free, and the plans page only previews a future offer." },
  },
  {
    q: { fa: "پاسخ نوشتن را چه کسی تصحیح می‌کند؟", en: "Who marks the writing?" },
    a: { fa: "هیچ داور انسانی یا مدل زبانی وصل نیست. بازخورد از طول متن، پاراگراف و چند پیوند واژگانی ساخته می‌شود.", en: "No human rater and no language model are connected. Feedback comes from length, paragraphs, and a few linking words." },
  },
  {
    q: { fa: "می‌توان نام محصول را عوض کرد؟", en: "Can the product name change?" },
    a: { fa: "بله. IELTS Readiness نام موقت است و در متن رابط از یک ثابت استفاده شده است.", en: "Yes. IELTS Readiness is a temporary name, and the interface reads it from one constant." },
  },
];

export const SKILL_WORD: Record<Skill, Bi> = {
  listening: { fa: "شنیدن", en: "Listening" },
  reading: { fa: "خواندن", en: "Reading" },
  writing: { fa: "نوشتن", en: "Writing" },
  speaking: { fa: "صحبت کردن", en: "Speaking" },
};

export const REASONS: Record<string, Bi> = {
  migration: { fa: "مهاجرت", en: "Migration" },
  university: { fa: "پذیرش دانشگاه", en: "University admission" },
  work: { fa: "کار", en: "Work" },
  personal: { fa: "هدف شخصی", en: "Personal goal" },
  other: { fa: "سایر", en: "Other" },
};

export const PATH_WORD: Record<string, Bi> = {
  balanced: { fa: "متعادل", en: "Balanced" },
  bottleneck: { fa: "تمرکز روی شکاف", en: "Bottleneck" },
  sprint: { fa: "جمع‌بندی نزدیک آزمون", en: "Exam sprint" },
  auto: { fa: "پیشنهاد سیستم", en: "System suggestion" },
};

export const DAY_WORD: Record<"fa" | "en", string[]> = {
  fa: ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"],
  en: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};
