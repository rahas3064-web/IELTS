import type { Bi, Difficulty, ExamType, PublishStatus, Skill } from "@/lib/types";

export type QuestionKind = "mcq" | "short" | "tfng" | "writing" | "speaking";

export type BankItem = {
  id: string;
  skill: Skill;
  examType: ExamType | "both";
  level: "foundation" | "intermediate" | "advanced";
  difficulty: 1 | 2 | 3 | 4 | 5;
  kind: QuestionKind;
  minutes: number;
  instruction: string;
  prompt: string;
  options?: string[];
  answer?: string;
  accept?: string[];
  explanation: string;
  tags: string[];
  version: string;
  status: PublishStatus;
  passageId?: string;
  section?: string;
};

export type Passage = {
  id: string;
  title: string;
  body: string;
  audioScript?: string;
};

export const PASSAGES: Passage[] = [
  {
    id: "lib-tour",
    title: "Riverside Community Library",
    audioScript:
      "Welcome to Riverside Community Library. Membership is free for anyone who lives, works, or studies in the city. Please bring a photo and a proof of address. The desk is open from nine in the morning until seven on weekdays, and from ten until four on Saturdays. We are closed on Sundays. New members may borrow up to six items. If you return a book late, the fee is twenty pence per day. The quiet study room on the second floor can be booked for two hours. Laptops are allowed there, but phone calls are not. Tonight at six there is a short talk about local history in room B. No ticket is required.",
    body: "A short original listening script for the demo player. It is not an official IELTS recording.",
  },
  {
    id: "market",
    title: "Night markets and the city after dark",
    body: `Night markets are often described as tourist attractions, but in many cities they began as practical answers to heat, work shifts, and the cost of renting a daytime shop. Sellers who could not afford a permanent stall used the cooler evening, when office workers were finally free to eat.

Researchers who counted visitors at three municipal markets found that almost half arrived after eight o'clock, and that the busiest hour was not the same in every city. In Harbor Town the peak came just after the last commuter train. In Old Mill it came later, because most visitors walked from nearby housing rather than from a station. The study did not measure how much money each person spent, so it cannot claim that later visitors supported the markets more than earlier ones.

City councils tend to praise night markets for keeping streets busy. That effect is real, but it is uneven. Stalls that sold hot food drew crowds. Stalls that sold phone cases and socks often stood empty after the first month, unless they moved closer to the food. A market manager in Old Mill said the layout mattered more than the advertising: "People follow the smell, then they look sideways."

There is a cost that the promotional leaflets leave out. Residents above the busiest lanes reported broken sleep, and rubbish collections had to move from dawn to midnight. The council in Harbor Town kept the market only after it agreed to close the music at nine-thirty and to give each block one silent night per week. The compromise did not satisfy every neighbour, yet the number of written complaints fell in the following month.

None of this means a night market will revive a struggling high street. The study followed markets that already had a regular food audience. Where that audience was missing, extra evening hours did not create one.`,
  },
];

export const BANK: BankItem[] = [
  {
    id: "L1",
    skill: "listening",
    examType: "both",
    level: "foundation",
    difficulty: 2,
    kind: "short",
    minutes: 4,
    section: "Listening · Section 1 of the demo",
    passageId: "lib-tour",
    instruction: "Listen to the library announcement and answer in no more than two words or a number.",
    prompt: "How many items may a new member borrow?",
    answer: "six",
    accept: ["6", "six items"],
    explanation: "The speaker says new members may borrow up to six items.",
    tags: ["form", "number", "section-1"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "L2",
    skill: "listening",
    examType: "both",
    level: "foundation",
    difficulty: 2,
    kind: "short",
    minutes: 4,
    section: "Listening · Section 1 of the demo",
    passageId: "lib-tour",
    instruction: "Listen to the library announcement and answer in no more than two words or a number.",
    prompt: "What is the late fee per day?",
    answer: "twenty pence",
    accept: ["20 pence", "20p", "twenty p"],
    explanation: "The fee is twenty pence per day.",
    tags: ["number", "section-1"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "L3",
    skill: "listening",
    examType: "both",
    level: "foundation",
    difficulty: 3,
    kind: "mcq",
    minutes: 4,
    section: "Listening · Section 1 of the demo",
    passageId: "lib-tour",
    instruction: "Choose the correct letter.",
    prompt: "What are members allowed to do in the quiet study room?",
    options: [
      "Make short phone calls",
      "Use a laptop",
      "Play music with headphones",
      "Reserve the room for the whole day",
    ],
    answer: "Use a laptop",
    explanation: "Laptops are allowed. Phone calls are not, and the room can be booked for two hours.",
    tags: ["rules", "section-1"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "L4",
    skill: "listening",
    examType: "both",
    level: "foundation",
    difficulty: 3,
    kind: "short",
    minutes: 3,
    section: "Listening · Section 2 of the demo",
    passageId: "lib-tour",
    instruction: "Answer in no more than two words and/or a number.",
    prompt: "Where is tonight's talk about local history?",
    answer: "room B",
    accept: ["room b", "b"],
    explanation: "The talk is in room B at six. No ticket is required, but the question asks for the place.",
    tags: ["place", "section-2"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "L5",
    skill: "listening",
    examType: "both",
    level: "intermediate",
    difficulty: 3,
    kind: "mcq",
    minutes: 3,
    section: "Listening · Section 2 of the demo",
    passageId: "lib-tour",
    instruction: "Choose the correct letter.",
    prompt: "On which day is the library closed?",
    options: ["Saturday", "Sunday", "Monday", "Friday"],
    answer: "Sunday",
    explanation: "The library is closed on Sundays. Saturday has shorter hours.",
    tags: ["day", "section-2"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "R1",
    skill: "reading",
    examType: "academic",
    level: "intermediate",
    difficulty: 3,
    kind: "tfng",
    minutes: 8,
    section: "Reading · Passage A of the demo",
    passageId: "market",
    instruction: "Do the following statements agree with the information in the passage? Choose True, False, or Not Given.",
    prompt: "The busiest hour was the same in Harbor Town and Old Mill.",
    options: ["True", "False", "Not Given"],
    answer: "False",
    explanation: "The passage says the busiest hour was not the same in every city.",
    tags: ["tfng", "detail"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "R2",
    skill: "reading",
    examType: "academic",
    level: "intermediate",
    difficulty: 3,
    kind: "tfng",
    minutes: 8,
    passageId: "market",
    instruction: "Choose True, False, or Not Given.",
    prompt: "The study proved that later visitors spent more money than earlier visitors.",
    options: ["True", "False", "Not Given"],
    answer: "False",
    explanation: "The study did not measure spending, so it cannot claim that later visitors spent more. The statement contradicts the passage.",
    tags: ["tfng", "claim"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "R3",
    skill: "reading",
    examType: "academic",
    level: "intermediate",
    difficulty: 4,
    kind: "tfng",
    minutes: 8,
    passageId: "market",
    instruction: "Choose True, False, or Not Given.",
    prompt: "Harbor Town cancelled its night market after neighbours complained.",
    options: ["True", "False", "Not Given"],
    answer: "False",
    explanation: "The council kept the market after agreeing to limits on music and one silent night per week.",
    tags: ["tfng"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "R4",
    skill: "reading",
    examType: "academic",
    level: "intermediate",
    difficulty: 3,
    kind: "mcq",
    minutes: 8,
    passageId: "market",
    instruction: "Choose the correct letter.",
    prompt: "According to the market manager, what mattered most?",
    options: ["The advertising budget", "The layout of the stalls", "The price of the food", "The number of tourists"],
    answer: "The layout of the stalls",
    explanation: "The manager says the layout mattered more than the advertising.",
    tags: ["mcq", "opinion"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "R5",
    skill: "reading",
    examType: "academic",
    level: "intermediate",
    difficulty: 4,
    kind: "short",
    minutes: 8,
    passageId: "market",
    instruction: "Choose no more than three words from the passage.",
    prompt: "What did not, by itself, create an audience where none existed?",
    answer: "extra evening hours",
    accept: ["evening hours", "extra hours"],
    explanation: "The last paragraph says extra evening hours did not create an audience where it was missing.",
    tags: ["short-answer"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "W1",
    skill: "writing",
    examType: "academic",
    level: "intermediate",
    difficulty: 3,
    kind: "writing",
    minutes: 20,
    section: "Academic Writing · Task 1",
    instruction:
      "You should spend about 20 minutes on this task in the full test. The demo timer is shorter. Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.",
    prompt:
      "The chart below shows how four fictional learners divided one study week between IELTS skills. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    explanation:
      "A strong Task 1 overview compares the largest and smallest shares and does not invent reasons that the chart does not show.",
    tags: ["task-1", "chart"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "W2",
    skill: "writing",
    examType: "both",
    level: "intermediate",
    difficulty: 4,
    kind: "writing",
    minutes: 40,
    section: "Writing · Task 2",
    instruction:
      "You should spend about 40 minutes on this task in the full test. The demo timer is shorter. Write at least 250 words.",
    prompt:
      "Some people believe that public transport in large cities should be free for everyone. Others say users should pay, because free transport would reduce quality. Discuss both views and give your own opinion.",
    explanation:
      "A complete response discusses both views, states a position, and develops it with explanation rather than a list of unsupported claims.",
    tags: ["task-2", "opinion"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "S1",
    skill: "speaking",
    examType: "both",
    level: "foundation",
    difficulty: 2,
    kind: "speaking",
    minutes: 2,
    section: "Speaking · Part 1",
    instruction: "Answer in spoken English if you can, and type a transcript so this demo can store the response. Suggested time: 20–30 seconds.",
    prompt: "What do you enjoy doing when you have a free evening?",
    explanation: "Part 1 rewards a direct answer plus one developed reason, not a memorised paragraph.",
    tags: ["part-1"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "S2",
    skill: "speaking",
    examType: "both",
    level: "foundation",
    difficulty: 2,
    kind: "speaking",
    minutes: 2,
    section: "Speaking · Part 1",
    instruction: "Suggested time: 20–30 seconds.",
    prompt: "Do you prefer studying alone or with other people? Why?",
    explanation: "Give a preference and a concrete reason.",
    tags: ["part-1"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "S3",
    skill: "speaking",
    examType: "both",
    level: "intermediate",
    difficulty: 3,
    kind: "speaking",
    minutes: 3,
    section: "Speaking · Part 2",
    instruction:
      "You have one minute to prepare in the full test. In this demo, preparation is shorter. Then speak for up to two minutes. Type what you said, or a close transcript.",
    prompt:
      "Describe a skill you would like to improve. You should say what the skill is, why you want to improve it, how you could practise it, and explain how you would feel if you improved it.",
    explanation: "Cover the four cue-card points and keep going with an example.",
    tags: ["part-2", "cue-card"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "S4",
    skill: "speaking",
    examType: "both",
    level: "intermediate",
    difficulty: 4,
    kind: "speaking",
    minutes: 3,
    section: "Speaking · Part 3",
    instruction: "Discussion. Suggested time: 30–40 seconds.",
    prompt: "Why do some people stop learning a language even when they have a clear goal?",
    explanation: "Part 3 asks for reasons, not only a personal story. Offer more than one explanation.",
    tags: ["part-3"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "S5",
    skill: "speaking",
    examType: "both",
    level: "intermediate",
    difficulty: 4,
    kind: "speaking",
    minutes: 3,
    section: "Speaking · Part 3",
    instruction: "Discussion. Suggested time: 30–40 seconds.",
    prompt: "Should employers pay for employees' language classes? Why or why not?",
    explanation: "Take a position and support it. A balanced answer can still have a clear conclusion.",
    tags: ["part-3"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "P-L1",
    skill: "listening",
    examType: "both",
    level: "foundation",
    difficulty: 2,
    kind: "mcq",
    minutes: 8,
    instruction: "A colleague leaves this message. Choose the correct letter. No audio file is shipped; read the transcript and treat the result as practice, not a listening score.",
    prompt:
      "Transcript: 'Don't wait at the north door. The lecture moved to Hall C, and it starts at quarter past four, not four.' Where should the listener go?",
    options: ["North door", "Hall C", "The library", "Room B"],
    answer: "Hall C",
    explanation: "The meeting point changed to Hall C. The time change is a distractor.",
    tags: ["distractor", "message"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "P-R1",
    skill: "reading",
    examType: "both",
    level: "foundation",
    difficulty: 2,
    kind: "tfng",
    minutes: 10,
    instruction: "Read the sentence and choose True, False, or Not Given.",
    prompt:
      "Text: 'The workshop is open to beginners, but places must be booked by Friday.' Statement: The workshop refuses beginners.",
    options: ["True", "False", "Not Given"],
    answer: "False",
    explanation: "The text says the workshop is open to beginners.",
    tags: ["tfng", "short"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "P-W1",
    skill: "writing",
    examType: "both",
    level: "foundation",
    difficulty: 2,
    kind: "writing",
    minutes: 15,
    instruction: "Rewrite the ideas as one coherent paragraph of 70–110 words. This is a drill, not a full Task 2.",
    prompt:
      "Ideas: free buses help low-income workers; free buses need a large subsidy; crowded buses may get worse if the service is not expanded.",
    explanation: "Link the three ideas with a contrast and do not add a new claim you cannot support.",
    tags: ["coherence", "drill"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "P-S1",
    skill: "speaking",
    examType: "both",
    level: "foundation",
    difficulty: 2,
    kind: "speaking",
    minutes: 6,
    instruction: "Answer aloud, then type the transcript.",
    prompt: "Describe your usual weekday morning in four or five sentences.",
    explanation: "Fluency practice: sequence markers (first, then, after that) without reading a script.",
    tags: ["fluency", "part-1"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "P-G1",
    skill: "writing",
    examType: "both",
    level: "foundation",
    difficulty: 2,
    kind: "mcq",
    minutes: 6,
    instruction: "Choose the sentence that is grammatically accurate.",
    prompt: "Which sentence is accurate?",
    options: [
      "People should be encourage to read every day.",
      "People should be encouraged to read every day.",
      "People should be encouraging to read every day.",
      "People should encouraged to read every day.",
    ],
    answer: "People should be encouraged to read every day.",
    explanation: "After 'should be', the passive participle is 'encouraged'.",
    tags: ["grammar", "passive"],
    version: "0.1.0",
    status: "in_review",
  },
  {
    id: "P-R2",
    skill: "reading",
    examType: "academic",
    level: "advanced",
    difficulty: 4,
    kind: "mcq",
    minutes: 12,
    instruction: "Choose the best summary of the author's point.",
    prompt:
      "Text: 'A longer reading list does not produce deeper reading if students have no time to reread.' What is the author's point?",
    options: [
      "Students should always be given longer reading lists.",
      "Rereading matters, and time can matter more than the length of the list.",
      "Deep reading is impossible at university.",
      "Lecturers should stop assigning books.",
    ],
    answer: "Rereading matters, and time can matter more than the length of the list.",
    explanation: "The sentence limits the value of a longer list when rereading time is missing.",
    tags: ["inference"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "M-L1",
    skill: "listening",
    examType: "both",
    level: "intermediate",
    difficulty: 3,
    kind: "mcq",
    minutes: 6,
    instruction: "Mini-mock item. Transcript stands in for audio.",
    prompt:
      "Transcript: 'The assignment deadline has moved from Monday to Wednesday, but the tutorial is still on Monday at ten.' Which event stayed on Monday?",
    options: ["The assignment deadline", "The tutorial", "Both events", "Neither event"],
    answer: "The tutorial",
    explanation: "Only the tutorial remains on Monday. The deadline moved to Wednesday.",
    tags: ["mock", "change"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "M-R1",
    skill: "reading",
    examType: "academic",
    level: "intermediate",
    difficulty: 3,
    kind: "tfng",
    minutes: 6,
    instruction: "Mini-mock item.",
    prompt:
      "Text: 'The trial included 40 volunteers and ran for six weeks.' Statement: The trial lasted for forty weeks.",
    options: ["True", "False", "Not Given"],
    answer: "False",
    explanation: "Forty refers to volunteers, not weeks. The trial ran for six weeks.",
    tags: ["mock", "number"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "M-W1",
    skill: "writing",
    examType: "general",
    level: "intermediate",
    difficulty: 3,
    kind: "writing",
    minutes: 20,
    instruction: "General Training style letter, shortened. Write at least 120 words in this demo.",
    prompt:
      "You recently bought a desk from a company, and one leg arrived broken. Write a letter to the company. In your letter: describe the desk, explain the problem, and say what you want the company to do.",
    explanation: "A GT letter needs a clear purpose, all three bullet points, and a tone that matches a complaint.",
    tags: ["mock", "gt-letter"],
    version: "0.1.0",
    status: "published",
  },
  {
    id: "M-S1",
    skill: "speaking",
    examType: "both",
    level: "intermediate",
    difficulty: 3,
    kind: "speaking",
    minutes: 4,
    instruction: "Mini-mock speaking prompt.",
    prompt: "What makes a study plan difficult to follow, and what could make it easier?",
    explanation: "Give two reasons and one practical change.",
    tags: ["mock", "part-3"],
    version: "0.1.0",
    status: "draft",
  },
];

export const PLACEMENT_IDS: Record<Skill, string[]> = {
  listening: ["L1", "L2", "L3", "L4", "L5"],
  reading: ["R1", "R2", "R3", "R4", "R5"],
  writing: ["W1", "W2"],
  speaking: ["S1", "S2", "S3", "S4", "S5"],
};

export const PRACTICE_IDS = ["P-L1", "P-R1", "P-W1", "P-S1", "P-G1", "P-R2"];

export const MOCKS: {
  id: string;
  scope: "full" | Skill;
  title: Bi;
  minutes: number;
  itemIds: string[];
  blurb: Bi;
}[] = [
  {
    id: "mock-mini-1",
    scope: "full",
    title: { fa: "آزمونک چهارمهارتی", en: "Four-skill mini-mock" },
    minutes: 25,
    itemIds: ["M-L1", "M-R1", "M-W1", "M-S1"],
    blurb: {
      fa: "نسخه کوتاه‌شده برای دیدن شکل گزارش. معادل آزمون کامل سه ساعته نیست.",
      en: "A shortened paper so you can inspect the report. It is not a three-hour exam.",
    },
  },
  {
    id: "mock-writing-1",
    scope: "writing",
    title: { fa: "آزمون تک‌مهارت نوشتن", en: "Writing-only mock" },
    minutes: 20,
    itemIds: ["M-W1", "W2"],
    blurb: {
      fa: "برای وقتی که یک مهارت باید جدا بررسی شود.",
      en: "Use this when one skill needs a separate check.",
    },
  },
  {
    id: "mock-listening-1",
    scope: "listening",
    title: { fa: "آزمون تک‌مهارت شنیدن", en: "Listening-only mock" },
    minutes: 12,
    itemIds: ["L1", "L3", "L5", "M-L1", "P-L1"],
    blurb: {
      fa: "تمرین تغییر اطلاعات و عدد. صوت، رونوشت مصنوعی است.",
      en: "Practice on changed details and numbers. Audio is a synthetic transcript.",
    },
  },
];

export function mockArchiveScope(mockId: string): "full" | Skill {
  return MOCKS.find((item) => item.id === mockId)?.scope ?? "full";
}

export function bankItem(id: string) {
  const item = BANK.find((entry) => entry.id === id);
  if (!item) throw new Error(`Missing bank item ${id}`);
  return item;
}

export const CHART_HOURS: { name: string; listening: number; reading: number; writing: number; speaking: number }[] = [
  { name: "Ava", listening: 3, reading: 4, writing: 5, speaking: 2 },
  { name: "Navid", listening: 5, reading: 3, writing: 2, speaking: 4 },
  { name: "Leila", listening: 2, reading: 2, writing: 6, speaking: 3 },
  { name: "Sam", listening: 4, reading: 5, writing: 3, speaking: 4 },
];

export const LEVEL_LABEL: Record<BankItem["level"], Bi> = {
  foundation: { fa: "پایه", en: "Foundation" },
  intermediate: { fa: "میانی", en: "Intermediate" },
  advanced: { fa: "پیشرفته", en: "Advanced" },
};

export const DIFFICULTY_LABEL: Record<Difficulty, Bi> = {
  foundation: { fa: "پایه", en: "Foundation" },
  core: { fa: "اصلی", en: "Core" },
  stretch: { fa: "کششی", en: "Stretch" },
};
