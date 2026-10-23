import type { Bi, Difficulty, Priority, Skill } from "@/lib/types";

export type TaskTemplate = {
  id: string;
  weaknessId: string;
  skill: Skill;
  title: Bi;
  objective: Bi;
  minutes: number;
  difficulty: Difficulty;
  priority: Priority;
  success: Bi;
  phase: 1 | 2 | 3 | 4;
};

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "listen-signpost",
    weaknessId: "listening-detail",
    skill: "listening",
    title: { fa: "نشانه‌های تغییر حرف", en: "Signposts that change the answer" },
    objective: { fa: "شنیدن however، actually و جابه‌جایی زمان یا مکان", en: "Catch however, actually, and moved times or places" },
    minutes: 25,
    difficulty: "core",
    priority: "high",
    success: { fa: "چهار مورد از پنج تغییر را درست یادداشت کنید.", en: "Note four of five changes correctly." },
    phase: 2,
  },
  {
    id: "listen-numbers",
    weaknessId: "listening-detail",
    skill: "listening",
    title: { fa: "عدد، قیمت و روز", en: "Numbers, prices, and days" },
    objective: { fa: "ثبات در املای عدد و واحد پول", en: "Stable spelling of numbers and prices" },
    minutes: 20,
    difficulty: "foundation",
    priority: "high",
    success: { fa: "هشت عدد از ده عدد را بدون جابه‌جایی رقم بنویسید.", en: "Write eight of ten numbers without a swapped digit." },
    phase: 2,
  },
  {
    id: "read-tfng",
    weaknessId: "reading-speed",
    skill: "reading",
    title: { fa: "دام درست، غلط، ذکرنشده", en: "True, False, Not Given traps" },
    objective: { fa: "فرق تناقض با سکوت متن", en: "Tell a contradiction apart from silence" },
    minutes: 25,
    difficulty: "core",
    priority: "high",
    success: { fa: "دلیل هر پاسخ را با یک خط از متن نشان بدهید.", en: "Point each answer to one line in the text." },
    phase: 2,
  },
  {
    id: "read-timed",
    weaknessId: "reading-speed",
    skill: "reading",
    title: { fa: "پاراگراف زمان‌دار", en: "Timed paragraph" },
    objective: { fa: "خواندن برای ایده اصلی، نه واژه به واژه", en: "Read for the main idea, not word by word" },
    minutes: 20,
    difficulty: "core",
    priority: "medium",
    success: { fa: "ایده اصلی را در یک جمله بنویسید، بدون نگاه دوباره.", en: "Write the main idea in one sentence without rereading." },
    phase: 2,
  },
  {
    id: "write-cover",
    weaknessId: "writing-task",
    skill: "writing",
    title: { fa: "چک‌لیست صورت سؤال", en: "Prompt checklist" },
    objective: { fa: "هر بخش سؤال یک پاراگراف داشته باشد", en: "Give every part of the question a paragraph" },
    minutes: 30,
    difficulty: "core",
    priority: "high",
    success: { fa: "قبل از نوشتن، طرح چهارخطی را کامل کنید.", en: "Finish a four-line plan before the draft." },
    phase: 2,
  },
  {
    id: "write-overview",
    weaknessId: "writing-task",
    skill: "writing",
    title: { fa: "نگاه کلی نمودار", en: "Chart overview" },
    objective: { fa: "یک جمله مقایسه، بدون دلیل خیالی", en: "One comparison sentence, with no invented cause" },
    minutes: 25,
    difficulty: "foundation",
    priority: "high",
    success: { fa: "بزرگ‌ترین و کوچک‌ترین مقدار را نام ببرید.", en: "Name the largest and smallest figures." },
    phase: 1,
  },
  {
    id: "write-link",
    weaknessId: "writing-coherence",
    skill: "writing",
    title: { fa: "پیوند بین جمله‌ها", en: "Links between sentences" },
    objective: { fa: "جایگزینی تکرار با ارجاع روشن", en: "Replace repetition with a clear reference" },
    minutes: 20,
    difficulty: "core",
    priority: "medium",
    success: { fa: "در یک پاراگراف سه پیوند دقیق به کار ببرید.", en: "Use three precise links in one paragraph." },
    phase: 2,
  },
  {
    id: "speak-extend",
    weaknessId: "speaking-fluency",
    skill: "speaking",
    title: { fa: "جواب به‌علاوه دلیل", en: "Answer plus a reason" },
    objective: { fa: "بیست تا چهل ثانیه بدون ازبرکردن", en: "Twenty to forty seconds without a script" },
    minutes: 15,
    difficulty: "foundation",
    priority: "high",
    success: { fa: "یک مثال واقعی به جواب اضافه کنید.", en: "Add one real example to the answer." },
    phase: 2,
  },
  {
    id: "speak-cue",
    weaknessId: "speaking-fluency",
    skill: "speaking",
    title: { fa: "کارت نکته، هر چهار مورد", en: "Cue card, all four points" },
    objective: { fa: "پوشش کارت قبل از زیبا حرف زدن", en: "Cover the card before polishing the language" },
    minutes: 20,
    difficulty: "core",
    priority: "high",
    success: { fa: "هر چهار نکته کارت را در یادداشت بزنید.", en: "Tick all four cue-card points in your notes." },
    phase: 3,
  },
  {
    id: "grammar-combine",
    weaknessId: "grammar-range",
    skill: "writing",
    title: { fa: "ترکیب دو جمله ساده", en: "Join two simple sentences" },
    objective: { fa: "although و because بدون خطای فعل", en: "although and because without a verb error" },
    minutes: 15,
    difficulty: "foundation",
    priority: "medium",
    success: { fa: "شش جمله از هشت جمله را درست ترکیب کنید.", en: "Combine six of eight sentences accurately." },
    phase: 1,
  },
  {
    id: "mock-review",
    weaknessId: "writing-task",
    skill: "writing",
    title: { fa: "بازبینی خطاهای آزمونک", en: "Review mini-mock errors" },
    objective: { fa: "فقط خطاهای تکرارشده را جدا کنید", en: "Separate repeated errors from one-off slips" },
    minutes: 25,
    difficulty: "stretch",
    priority: "high",
    success: { fa: "سه الگوی خطا را با یک مثال بنویسید.", en: "Write three error patterns with one example each." },
    phase: 4,
  },
  {
    id: "maintain-mixed",
    weaknessId: "listening-detail",
    skill: "listening",
    title: { fa: "نگهداری مهارت قوی‌تر", en: "Keep the stronger skill warm" },
    objective: { fa: "جلوگیری از افت مهارتی که نزدیک هدف است", en: "Stop a near-target skill from slipping" },
    minutes: 15,
    difficulty: "core",
    priority: "low",
    success: { fa: "یک تمرین کوتاه را تا آخر جواب بدهید.", en: "Finish one short set." },
    phase: 3,
  },
];

export const PHASES: { id: 1 | 2 | 3 | 4; title: Bi; detail: Bi }[] = [
  {
    id: 1,
    title: { fa: "پایه قابل‌استفاده", en: "A usable foundation" },
    detail: { fa: "عادت مطالعه و ابزارهای ساده، اگر نمره هنوز زیر ۵٫۵ است.", en: "Study habits and simple tools when the band is still under 5.5." },
  },
  {
    id: 2,
    title: { fa: "تمرکز روی شکاف", en: "Focus on the gap" },
    detail: { fa: "بیشترین زمان برای مهارتی که از حداقل هدف عقب است.", en: "Most of the time goes to the skill behind its minimum." },
  },
  {
    id: 3,
    title: { fa: "ترکیب مهارت‌ها", en: "Mix the skills" },
    detail: { fa: "مهارت قوی‌تر سرد نشود و مهارت ضعیف در بافت آزمون دیده شود.", en: "The stronger skill stays warm, and the weaker one appears in test conditions." },
  },
  {
    id: 4,
    title: { fa: "آزمونک و جمع‌بندی", en: "Mocks and review" },
    detail: { fa: "نزدیک آزمون، حجم درس کم و بازبینی خطا زیاد می‌شود.", en: "Near the exam, lessons shrink and error review grows." },
  },
];
