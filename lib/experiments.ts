import type { Bi } from "@/lib/types";

export type Experiment = {
  id: string;
  hypothesis: Bi;
  problem: Bi;
  audience: Bi;
  method: Bi;
  success: Bi;
  risk: Bi;
  status: "idea" | "running" | "review" | "decision";
  owner: string;
  decision: Bi;
  fictional: true;
};

export const EXPERIMENTS: Experiment[] = [
  {
    id: "E1",
    hypothesis: {
      fa: "اگر گزارش تعیین سطح فاصله هر مهارت را قبل از نمره کلی نشان بدهد، شروع برنامه بیشتر می‌شود.",
      en: "If the placement report shows each skill gap before the overall band, more people start the plan.",
    },
    problem: { fa: "در پروتوتایپ، کاربر ممکن است فقط به نمره کلی نگاه کند.", en: "In the prototype, a person may look only at the overall band." },
    audience: { fa: "زبان‌آموز تازه‌وارد بعد از تعیین سطح.", en: "A new learner just after placement." },
    method: { fa: "آزمایش A/B روی ترتیب بلوک‌های گزارش. داده واقعی هنوز جمع نشده است.", en: "An A/B test on the order of report blocks. No real data has been collected." },
    success: { fa: "شروع برنامه ظرف ۲۴ ساعت، با حد تصمیم ۵ واحد درصد. نمونه خیالی است.", en: "Plan start within 24 hours, with a 5 point decision line. The sample is fictional." },
    risk: { fa: "اگر فاصله را پررنگ کنیم، ممکن است اضطراب بیشتر شود.", en: "Emphasising the gap may raise anxiety." },
    status: "idea",
    owner: "Product",
    decision: { fa: "تصمیمی ثبت نشده. این کارت تحقیق انجام‌شده نیست.", en: "No decision is logged. This card is not a completed study." },
    fictional: true,
  },
  {
    id: "E2",
    hypothesis: {
      fa: "پیشنهاد هدف پایین‌تر، وقتی ساعت‌ها نمی‌رسند، رها کردن هدف را کمتر می‌کند.",
      en: "Suggesting a lower target when the hours do not fit reduces people abandoning the goal.",
    },
    problem: { fa: "هدف ۶ با روزی سی دقیقه در سناریوی الف ناسازگار است.", en: "A band 6 goal with thirty minutes a day is inconsistent in scenario A." },
    audience: { fa: "کسانی که زمان مطالعه کم و هدف بالا دارند.", en: "People with little study time and a high target." },
    method: { fa: "مصاحبه ساختگی در برنامه آزمایش، به‌علاوه مقایسه دو متن پیشنهاد.", en: "A fictional interview plan, plus a comparison of two suggestion texts." },
    success: { fa: "کاربر تفاوت پیشنهاد و انتخاب خودش را در یک جمله بازگو کند.", en: "The person can restate the difference between the suggestion and their own choice." },
    risk: { fa: "لحن نصیحت‌گر اعتماد را کم می‌کند.", en: "A lecturing tone would reduce trust." },
    status: "review",
    owner: "Research",
    decision: { fa: "ادامه با متن توضیحی، نه با قفل کردن هدف. هنوز شواهد کاربری واقعی نداریم.", en: "Continue with an explanation, not a locked target. There is still no real user evidence." },
    fictional: true,
  },
  {
    id: "E3",
    hypothesis: {
      fa: "نشان زنجیره مطالعه اگر خاموش‌کردنی باشد، فشار کمتری از نشان اجباری می‌سازد.",
      en: "A study streak that can be switched off creates less pressure than a forced badge.",
    },
    problem: { fa: "گیمیفیکیشن آسان به اغراق پیشرفت می‌لغزد.", en: "Gamification slides easily into exaggerated progress." },
    audience: { fa: "زبان‌آموز نزدیک آزمون.", en: "A learner close to the exam." },
    method: { fa: "تست کاربردپذیری روی مرکز اعلان و تنظیم انگیزه.", en: "A usability test of the notification centre and motivation setting." },
    success: { fa: "پنج نفر از شش نفر بتوانند اعلان انگیزشی را بی‌درنگ خاموش کنند.", en: "Five of six people can turn motivational notices off immediately." },
    risk: { fa: "حذف کامل بازخورد مثبت ممکن است بازگشت را کم کند. این حد هنوز اندازه گرفته نشده.", en: "Removing all positive feedback might reduce return visits. That limit is not measured." },
    status: "running",
    owner: "Design",
    decision: { fa: "نتیجه باز است. اعداد این کارت نمونه هستند.", en: "The result is open. Figures on this card are samples." },
    fictional: true,
  },
];

export const EVENT_CATALOG: {
  name: string;
  when: Bi;
  props: string[];
  purpose: Bi;
  metric: string;
}[] = [
  { name: "signup_completed", when: { fa: "بعد از اعتبارسنجی فرم ثبت‌نام", en: "After the signup form validates" }, props: ["method"], purpose: { fa: "شروع قیف", en: "Funnel start" }, metric: "activation" },
  { name: "onboarding_completed", when: { fa: "ذخیره هدف", en: "Goal saved" }, props: ["examType", "hasDate"], purpose: { fa: "کیفیت شروع", en: "Start quality" }, metric: "activation" },
  { name: "placement_test_started", when: { fa: "ورود به یک مهارت", en: "Entering a skill" }, props: ["skill"], purpose: { fa: "شروع آزمون", en: "Test start" }, metric: "completion" },
  { name: "placement_test_completed", when: { fa: "هر چهار مهارت ارسال شد", en: "All four skills submitted" }, props: ["bandBucket"], purpose: { fa: "تکمیل تعیین سطح", en: "Placement completion" }, metric: "completion" },
  { name: "learning_plan_created", when: { fa: "اولین ساخت برنامه", en: "First plan build" }, props: ["path"], purpose: { fa: "عبور از گزارش به برنامه", en: "Report-to-plan step" }, metric: "activation" },
  { name: "exercise_started", when: { fa: "باز شدن تمرین", en: "Opening an exercise" }, props: ["skill", "exerciseId"], purpose: { fa: "تعامل تمرین", en: "Practice engagement" }, metric: "engagement" },
  { name: "exercise_completed", when: { fa: "ثبت نتیجه تمرین", en: "Saving an exercise result" }, props: ["skill", "exerciseId"], purpose: { fa: "تکمیل تمرین", en: "Practice completion" }, metric: "engagement" },
  { name: "mock_test_completed", when: { fa: "ارسال آزمونک", en: "Submitting a mock" }, props: ["scope"], purpose: { fa: "آمادگی تکراری", en: "Repeated readiness checks" }, metric: "engagement" },
  { name: "daily_plan_completed", when: { fa: "تمام فعالیت‌های امروز", en: "All of today's tasks" }, props: ["count"], purpose: { fa: "پایبندی", en: "Adherence" }, metric: "adherence" },
  { name: "report_exported", when: { fa: "خروجی CSV یا چاپ", en: "CSV or print export" }, props: ["format"], purpose: { fa: "خروجی داده", en: "Data export" }, metric: "value" },
  { name: "feedback_submitted", when: { fa: "ثبت بازخورد", en: "Sending feedback" }, props: ["kind"], purpose: { fa: "کیفیت و پشتیبانی", en: "Quality and support" }, metric: "quality" },
];
