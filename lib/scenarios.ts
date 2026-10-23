import type { Bi, ExamType, Reason, Skill, SkillBands } from "@/lib/types";

export type ScenarioId = "A" | "B" | "C";

export type Scenario = {
  id: ScenarioId;
  person: Bi;
  city: Bi;
  summary: Bi;
  fictional: true;
  examType: ExamType;
  reason: Reason;
  reasonNote: Bi;
  bands: SkillBands;
  targetOverall: number;
  targetSkills: SkillBands;
  suggestedOverall: number;
  dailyMinutes: number;
  daysPerWeek: number;
  examOffsetDays: number;
  adherence: number;
  trend: number;
  skillTrend: SkillBands;
  stability: number;
  confidence: number;
  historyPoints: number;
  historySpanDays: number;
  exercisesDone: number;
  tasksDone: number;
  streakDays: number;
  mockIds: string[];
};

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  A: {
    id: "A",
    person: { fa: "آرمین رضایی", en: "Armin Rezaei" },
    city: { fa: "کرج", en: "Karaj" },
    summary: {
      fa: "مبتدی با روزی حدود سی دقیقه. هدف ۶ بلندپروازانه است و مدل ساعت مطالعه، ۵٫۵ را واقع‌بینانه‌تر می‌داند.",
      en: "A beginner with about thirty minutes a day. A 6.0 target is ambitious; the hour model treats 5.5 as the more realistic near-term band.",
    },
    fictional: true,
    examType: "academic",
    reason: "migration",
    reasonNote: {
      fa: "می‌خواهد برای پرونده مهاجرت مهارت نشان بدهد، اما تاریخ آزمون را قطعی نکرده است.",
      en: "Wants to show a score for a migration file, and has not fixed an exam date.",
    },
    bands: { listening: 4.5, reading: 4, writing: 4.5, speaking: 5 },
    targetOverall: 6,
    targetSkills: { listening: 6, reading: 6, writing: 6, speaking: 6 },
    suggestedOverall: 5.5,
    dailyMinutes: 30,
    daysPerWeek: 4,
    examOffsetDays: 180,
    adherence: 62,
    trend: 0,
    skillTrend: { listening: 0, reading: 0, writing: 0, speaking: 0 },
    stability: 40,
    confidence: 44,
    historyPoints: 2,
    historySpanDays: 21,
    exercisesDone: 3,
    tasksDone: 4,
    streakDays: 2,
    mockIds: [],
  },
  B: {
    id: "B",
    person: { fa: "نگار حسینی", en: "Negar Hosseini" },
    city: { fa: "اصفهان", en: "Isfahan" },
    summary: {
      fa: "سطح میانی و نسبتاً متعادل، با ضعف روشن‌تر در نوشتن. هدف ۷٫۵ بالاتر از پیشنهادی است که زمان مطالعه‌اش پشتیبانی می‌کند.",
      en: "Mid-level and fairly balanced, with writing as the clearer weakness. The 7.5 target sits above what the study-time model supports.",
    },
    fictional: true,
    examType: "academic",
    reason: "university",
    reasonNote: {
      fa: "برای اپلای کارشناسی ارشد، حداقل کلی ۷ و نوشتن ۶٫۵ را شنیده است و خودش ۷٫۵ می‌خواهد.",
      en: "Applying for a master's program. She has heard that 7.0 overall and 6.5 writing are often requested, and she wants 7.5.",
    },
    bands: { listening: 6, reading: 6.5, writing: 5.5, speaking: 6 },
    targetOverall: 7.5,
    targetSkills: { listening: 7.5, reading: 7.5, writing: 7, speaking: 7.5 },
    suggestedOverall: 7,
    dailyMinutes: 90,
    daysPerWeek: 6,
    examOffsetDays: 140,
    adherence: 78,
    trend: 0.5,
    skillTrend: { listening: 0.5, reading: 0.5, writing: 0.5, speaking: 0.5 },
    stability: 72,
    confidence: 61,
    historyPoints: 4,
    historySpanDays: 42,
    exercisesDone: 6,
    tasksDone: 8,
    streakDays: 5,
    mockIds: ["mock-mini-1"],
  },
  C: {
    id: "C",
    person: { fa: "کیان احمدی", en: "Kian Ahmadi" },
    city: { fa: "شیراز", en: "Shiraz" },
    summary: {
      fa: "آزمون تا حدود سه هفته دیگر است. سه مهارت نزدیک هدف‌اند و نوشتن حدود یک نمره عقب است.",
      en: "The exam is about three weeks away. Three skills sit near the target and writing is about one band behind.",
    },
    fictional: true,
    examType: "general",
    reason: "work",
    reasonNote: {
      fa: "کارفرما نمره کلی ۶٫۵ خواسته و نوشتن نباید از ۶ پایین‌تر باشد.",
      en: "An employer asked for 6.5 overall, with writing no lower than 6.0.",
    },
    bands: { listening: 6.5, reading: 6.5, writing: 5, speaking: 6.5 },
    targetOverall: 6.5,
    targetSkills: { listening: 6.5, reading: 6.5, writing: 6, speaking: 6.5 },
    suggestedOverall: 6.5,
    dailyMinutes: 120,
    daysPerWeek: 6,
    examOffsetDays: 18,
    adherence: 84,
    trend: 0.5,
    skillTrend: { listening: 0.5, reading: 0.5, writing: 0, speaking: 0.5 },
    stability: 76,
    confidence: 68,
    historyPoints: 5,
    historySpanDays: 35,
    exercisesDone: 14,
    tasksDone: 20,
    streakDays: 11,
    mockIds: ["mock-mini-1", "mock-writing-1"],
  },
};

export const WEAKNESS_COPY: Record<
  string,
  { skill: Skill; title: Bi; evidence: Bi }
> = {
  "listening-detail": {
    skill: "listening",
    title: { fa: "جزئیات بخش‌های طولانی شنیدن", en: "Detail in longer listening sections" },
    evidence: {
      fa: "فاصله نمره در شنیدن نشان می‌دهد پاسخ به عدد، اسم و تغییر نظر هنوز ناپایدار است.",
      en: "The listening gap suggests numbers, names, and changes of plan are still unstable.",
    },
  },
  "reading-speed": {
    skill: "reading",
    title: { fa: "سرعت و دام‌های درست/غلط/ذکرنشده", en: "Speed and True/False/Not Given traps" },
    evidence: {
      fa: "خواندن پایین‌ترین یا از پایین‌ترین نمره‌هاست؛ زمان و تطبیق دقیق عبارت‌ها اولویت دارد.",
      en: "Reading is among the lowest bands, so timing and exact paraphrase matching come first.",
    },
  },
  "writing-task": {
    skill: "writing",
    title: { fa: "پوشش کامل صورت سؤال", en: "Covering the whole prompt" },
    evidence: {
      fa: "فاصله نوشتن دست‌کم یک نمره است و در نمونه پاسخ‌ها بخش مقایسه یا موضع روشن جا می‌ماند.",
      en: "Writing is at least one band behind, and sample answers miss a comparison or a clear position.",
    },
  },
  "writing-coherence": {
    skill: "writing",
    title: { fa: "انسجام پاراگراف", en: "Paragraph cohesion" },
    evidence: {
      fa: "حتی وقتی واژگان کافی است، پاراگراف‌ها ایده مرکزی و پیوند روشن ندارند.",
      en: "Even where vocabulary is adequate, paragraphs lack a central idea and a clear link.",
    },
  },
  "speaking-fluency": {
    skill: "speaking",
    title: { fa: "ادامه حرف بدون حفظ کردن", en: "Keeping going without memorised lines" },
    evidence: {
      fa: "صحبت کردن از هدف عقب است و پاسخ‌های کوتاه یا از بر شده الگوی تکراری این سطح است.",
      en: "Speaking trails the target, and short or memorised answers are the usual pattern at this level.",
    },
  },
  "grammar-range": {
    skill: "writing",
    title: { fa: "تنوع ساختار جمله", en: "Range of sentence structures" },
    evidence: {
      fa: "جمله‌ها بیشتر ساده و هم‌شکل‌اند و این روی نوشتن و صحبت کردن هر دو اثر می‌گذارد.",
      en: "Sentences stay simple and repetitive, which shows up in both writing and speaking.",
    },
  },
};

export const STRENGTH_COPY: Record<string, Bi> = {
  listening: { fa: "شنیدن نزدیک یا بالاتر از حداقل هدف است.", en: "Listening is near or above its minimum target." },
  reading: { fa: "خواندن نسبت به مهارت‌های دیگر پایدارتر است.", en: "Reading is steadier than the other skills." },
  writing: { fa: "نوشتن حداقل هدف خودش را لمس کرده است.", en: "Writing has reached its own minimum target." },
  speaking: { fa: "صحبت کردن روان‌تر از مهارت ضعیف‌تر است.", en: "Speaking is more secure than the weaker skill." },
};
