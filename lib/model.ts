import { clamp, todayIso, addDays, wordCount } from "@/lib/format";
import { PHASES, TASK_TEMPLATES } from "@/lib/plan-templates";
import { PLACEMENT_IDS, bankItem } from "@/lib/questions";
import { SCENARIOS, STRENGTH_COPY, WEAKNESS_COPY, type Scenario, type ScenarioId } from "@/lib/scenarios";
import type {
  Bi,
  ExamTiming,
  LabOverrides,
  PlacementState,
  PlanPath,
  Priority,
  Profile,
  Skill,
  SkillBands,
  TaskEdit,
  TaskStatus,
} from "@/lib/types";
import { SKILLS } from "@/lib/types";

export function roundBand(value: number) {
  const rounded = Math.round(clamp(value, 0, 9) * 2) / 2;
  return clamp(rounded, 0, 9);
}

export function overallBand(bands: SkillBands) {
  const total = SKILLS.reduce((sum, skill) => sum + bands[skill], 0);
  return roundBand(total / SKILLS.length);
}

export function emptyBands(value = 0): SkillBands {
  return { listening: value, reading: value, writing: value, speaking: value };
}

export function bandFromAccuracy(correct: number, total: number) {
  if (total <= 0) return 3;
  const ratio = correct / total;
  const table: [number, number][] = [
    [0.95, 8],
    [0.85, 7.5],
    [0.75, 7],
    [0.62, 6.5],
    [0.5, 6],
    [0.38, 5.5],
    [0.28, 5],
    [0.18, 4.5],
    [0.1, 4],
    [0, 3.5],
  ];
  const found = table.find(([min]) => ratio >= min);
  return found?.[1] ?? 3.5;
}

export function normaliseAnswer(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.]/g, "");
}

export function answerIsCorrect(itemId: string, raw: string | undefined) {
  if (!raw?.trim()) return false;
  const item = bankItem(itemId);
  if (!item.answer) return false;
  const given = normaliseAnswer(raw);
  const accepted = [item.answer, ...(item.accept ?? [])].map(normaliseAnswer);
  return accepted.includes(given);
}

export type Criterion = {
  id: string;
  label: Bi;
  score: number | null;
  note: Bi;
};

export type OpenFeedback = {
  band: number;
  confidence: number;
  method: "heuristic";
  simulated: true;
  criteria: Criterion[];
  patterns: Bi[];
};

const LINKERS = /\b(however|therefore|although|moreover|because|for example|on the other hand|firstly|secondly|finally|also)\b/gi;

export function assessWriting(task1: string, task2: string): OpenFeedback {
  const words1 = wordCount(task1);
  const words2 = wordCount(task2);
  const paragraphs = task2.split(/\n\s*\n/).filter((part) => part.trim().length > 40).length || (words2 > 0 ? 1 : 0);
  const linkers = task2.match(LINKERS)?.length ?? 0;
  const tokens = task2.toLowerCase().match(/[a-z']+/g) ?? [];
  const variety = tokens.length ? new Set(tokens).size / tokens.length : 0;

  let task = 4;
  if (words2 >= 250) task += 1.5;
  else if (words2 >= 180) task += 0.8;
  else if (words2 >= 80) task += 0.2;
  else task -= 0.5;
  if (words1 >= 150) task += 0.7;
  else if (words1 >= 80) task += 0.3;
  else if (words1 === 0) task -= 0.4;

  let coherence = 4;
  if (paragraphs >= 4) coherence += 1.4;
  else if (paragraphs >= 3) coherence += 0.8;
  else if (paragraphs >= 2) coherence += 0.3;
  if (linkers >= 4) coherence += 0.6;
  else if (linkers >= 2) coherence += 0.3;

  let lexical = 4.5;
  if (variety > 0.62 && tokens.length > 120) lexical += 1;
  else if (variety > 0.5 && tokens.length > 70) lexical += 0.5;
  else if (tokens.length < 40) lexical -= 0.5;

  let grammar = 4.5;
  if (paragraphs >= 3 && linkers >= 2) grammar += 0.6;
  if (words2 < 100) grammar -= 0.4;

  const cap = (value: number) => Math.min(7, roundBand(value));
  const criteria: Criterion[] = [
    {
      id: "task",
      label: { fa: "تحقق تکلیف / پاسخ به سؤال", en: "Task Achievement / Task Response" },
      score: cap(task),
      note: {
        fa: words2 >= 250 ? "حجم Task 2 به حداقل نمایشی رسیده است." : "حجم Task 2 هنوز به ۲۵۰ کلمه نرسیده و این سقف نمره را پایین نگه می‌دارد.",
        en: words2 >= 250 ? "Task 2 meets the demo minimum length." : "Task 2 is still under 250 words, which holds the score down.",
      },
    },
    {
      id: "coherence",
      label: { fa: "انسجام و پیوستگی", en: "Coherence and Cohesion" },
      score: cap(coherence),
      note: {
        fa: paragraphs >= 3 ? "پاراگراف‌بندی دیده می‌شود." : "متن به پاراگراف‌های جدا تقسیم نشده است.",
        en: paragraphs >= 3 ? "Paragraphing is visible." : "The text is not split into separate paragraphs.",
      },
    },
    {
      id: "lexical",
      label: { fa: "منبع واژگانی", en: "Lexical Resource" },
      score: cap(lexical),
      note: {
        fa: "تنوع واژه فقط با شمارش تکرار سنجیده شده، نه با داوری انسانی.",
        en: "Variety is counted from repetition, not judged by a person.",
      },
    },
    {
      id: "grammar",
      label: { fa: "گستره و دقت دستوری", en: "Grammatical Range and Accuracy" },
      score: cap(grammar),
      note: {
        fa: "خطاهای دستوری تشخیص داده نمی‌شوند؛ نمره از طول و ساختار کلی آمده است.",
        en: "Grammar errors are not detected. The mark comes from length and rough structure.",
      },
    },
  ];
  const averaged = roundBand(criteria.reduce((sum, item) => sum + (item.score ?? 0), 0) / criteria.length);
  const band = words2 < 20 ? Math.min(averaged, 3.5) : averaged;
  const patterns: Bi[] = [];
  if (words2 < 250) {
    patterns.push({
      fa: "پاسخ Task 2 کوتاه‌تر از حداقل معمول است.",
      en: "Task 2 is shorter than the usual minimum.",
    });
  }
  if (paragraphs < 3) {
    patterns.push({
      fa: "ایده‌ها در یک بلوک آمده‌اند و جدا نشده‌اند.",
      en: "Ideas sit in one block instead of separate paragraphs.",
    });
  }
  if (linkers < 2) {
    patterns.push({
      fa: "پیوندهای روشن بین جمله‌ها کم است.",
      en: "There are few clear links between sentences.",
    });
  }
  if (!patterns.length) {
    patterns.push({
      fa: "قاعده نمایشی الگوی خطای واضحی در طول و پاراگراف ندید. این به معنی بی‌خطا بودن متن نیست.",
      en: "The demo rules found no obvious length or paragraph pattern. That does not mean the text is error-free.",
    });
  }
  return { band: Math.min(band, 7), confidence: 34, method: "heuristic", simulated: true, criteria, patterns };
}

export function assessSpeaking(texts: string[]): OpenFeedback {
  const joined = texts.join("\n\n");
  const words = wordCount(joined);
  const linkers = joined.match(LINKERS)?.length ?? 0;
  let fluency = 4;
  if (words >= 180) fluency += 1.5;
  else if (words >= 100) fluency += 0.8;
  else if (words >= 40) fluency += 0.2;
  else fluency -= 0.5;
  if (texts.filter((item) => wordCount(item) > 12).length >= 4) fluency += 0.4;

  let lexical = 4.5;
  if (words > 140) lexical += 0.6;
  let grammar = 4.5;
  if (linkers >= 3) grammar += 0.5;
  const cap = (value: number) => Math.min(7, roundBand(value));
  const criteria: Criterion[] = [
    {
      id: "fluency",
      label: { fa: "روانی و انسجام", en: "Fluency and Coherence" },
      score: cap(fluency),
      note: {
        fa: "فقط از روی طول رونوشت تخمین زده شده است. مکث و سرعت شنیده نشده‌اند.",
        en: "Estimated from transcript length only. Pauses and speed were not heard.",
      },
    },
    {
      id: "lexical",
      label: { fa: "منبع واژگانی", en: "Lexical Resource" },
      score: cap(lexical),
      note: { fa: "دقت واژگانی ارزیابی انسانی نشده است.", en: "Word choice was not judged by a person." },
    },
    {
      id: "grammar",
      label: { fa: "گستره و دقت دستوری", en: "Grammatical Range and Accuracy" },
      score: cap(grammar),
      note: { fa: "ساختارها شمرده نشده‌اند؛ این عدد محافظه‌کارانه است.", en: "Structures were not parsed. This number stays conservative." },
    },
    {
      id: "pronunciation",
      label: { fa: "تلفظ", en: "Pronunciation" },
      score: null,
      note: {
        fa: "بدون تحلیل صوت، تلفظ نمره نمی‌گیرد.",
        en: "Pronunciation is not scored without speech analysis.",
      },
    },
  ];
  const scored = criteria.filter((item) => item.score != null);
  const band = roundBand(scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length);
  const patterns: Bi[] = [];
  if (words < 80) {
    patterns.push({
      fa: "پاسخ‌ها برای سنجش روانی کوتاه‌اند.",
      en: "The answers are too short to say much about fluency.",
    });
  }
  patterns.push({
    fa: "تلفظ در شواهد این گزارش نیست.",
    en: "Pronunciation is absent from the evidence in this report.",
  });
  return { band: Math.min(band, 7), confidence: 30, method: "heuristic", simulated: true, criteria, patterns };
}

export type ObjectiveScore = {
  bands: SkillBands;
  confidenceBySkill: SkillBands;
  writing: OpenFeedback;
  speaking: OpenFeedback;
  objectiveCorrect: { listening: number; reading: number; listeningTotal: number; readingTotal: number };
};

export function scorePlacement(placement: PlacementState): ObjectiveScore | null {
  const done = SKILLS.every((skill) => placement.done[skill]);
  if (!done) return null;
  const count = (ids: string[]) => ids.filter((id) => answerIsCorrect(id, placement.answers[id])).length;
  const listeningCorrect = count(PLACEMENT_IDS.listening);
  const readingCorrect = count(PLACEMENT_IDS.reading);
  const writing = assessWriting(placement.writing1, placement.writing2);
  const speaking = assessSpeaking(PLACEMENT_IDS.speaking.map((id) => placement.speaking[id] ?? ""));
  return {
    bands: {
      listening: bandFromAccuracy(listeningCorrect, PLACEMENT_IDS.listening.length),
      reading: bandFromAccuracy(readingCorrect, PLACEMENT_IDS.reading.length),
      writing: writing.band,
      speaking: speaking.band,
    },
    confidenceBySkill: { listening: 48, reading: 48, writing: writing.confidence, speaking: speaking.confidence },
    writing,
    speaking,
    objectiveCorrect: {
      listening: listeningCorrect,
      reading: readingCorrect,
      listeningTotal: PLACEMENT_IDS.listening.length,
      readingTotal: PLACEMENT_IDS.reading.length,
    },
  };
}

export function hoursForHalfBand(current: number) {
  if (current < 5) return 55;
  if (current < 6) return 42;
  if (current < 7) return 48;
  return 60;
}

export function hoursBetween(current: number, target: number) {
  let hours = 0;
  let cursor = current;
  while (cursor + 0.01 < target) {
    const step = Math.min(0.5, target - cursor);
    hours += hoursForHalfBand(cursor) * (step / 0.5);
    cursor += step;
  }
  return hours;
}

export type HourEstimate = {
  rawHours: number;
  lowHours: number;
  highHours: number;
  weeklyHours: number;
  weeksLow: number | null;
  weeksHigh: number | null;
  bySkill: SkillBands;
};

export function estimateHours(bands: SkillBands, targets: SkillBands, dailyMinutes: number, daysPerWeek: number): HourEstimate {
  const bySkill = emptyBands();
  for (const skill of SKILLS) {
    bySkill[skill] = Math.round(hoursBetween(bands[skill], Math.max(bands[skill], targets[skill])));
  }
  const raw = Object.values(bySkill).reduce((sum, value) => sum + value, 0) * 0.9;
  const low = Math.round(raw * 0.75);
  const high = Math.round(raw * 1.45);
  const weekly = (dailyMinutes / 60) * daysPerWeek;
  return {
    rawHours: Math.round(raw),
    lowHours: low,
    highHours: high,
    weeklyHours: Math.round(weekly * 10) / 10,
    weeksLow: weekly > 0 ? Math.ceil(low / weekly) : null,
    weeksHigh: weekly > 0 ? Math.ceil(high / weekly) : null,
    bySkill,
  };
}

export function suggestOverall(input: {
  bands: SkillBands;
  reason: Profile["reason"];
  weeklyHours: number;
  weeks: number | null;
}) {
  const reasonFloor: Record<Profile["reason"], number> = {
    university: 7,
    migration: 6.5,
    work: 6.5,
    personal: 6,
    other: 6,
  };
  const current = overallBand(input.bands);
  let suggested = Math.max(current, reasonFloor[input.reason]);
  if (input.weeks != null && input.weeklyHours > 0) {
    const capacity = input.weeks * input.weeklyHours;
    let cursor = current;
    let guard = 0;
    while (guard < 12) {
      const next = roundBand(cursor + 0.5);
      const cost = hoursBetween(cursor, next) * 2.2;
      if (cost > capacity * 1.2 || next > 8) break;
      cursor = next;
      guard += 1;
    }
    suggested = Math.min(suggested, Math.max(current, cursor));
  }
  if (suggested === current && current < 8) suggested = roundBand(current + 0.5);
  return clamp(suggested, 4, 8);
}

export function weeksFromTiming(timing: ExamTiming, today: string) {
  if (timing.kind === "unknown") return null;
  if (timing.kind === "window") return timing.months * 4;
  const target = new Date(`${timing.date}T12:00:00`).getTime();
  const start = new Date(`${today}T12:00:00`).getTime();
  return Math.max(0, Math.round((target - start) / (7 * 86_400_000)));
}

export function daysFromTiming(timing: ExamTiming, today: string) {
  if (timing.kind === "unknown") return null;
  if (timing.kind === "window") return timing.months * 30;
  const target = new Date(`${timing.date}T12:00:00`).getTime();
  const start = new Date(`${today}T12:00:00`).getTime();
  return Math.round((target - start) / 86_400_000);
}

export type ReadinessPart = { id: "skills" | "stability" | "trend" | "adherence" | "confidence"; weight: number; score: number };

export function readinessIndex(input: {
  bands: SkillBands;
  targets: SkillBands;
  stability: number;
  trend: number;
  adherence: number;
  confidence: number;
}) {
  const gaps = SKILLS.map((skill) => Math.max(0, input.targets[skill] - input.bands[skill]));
  const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / SKILLS.length;
  const skillScore = clamp(100 - (averageGap / 3) * 100, 0, 100);
  const trendScore = clamp(50 + input.trend * 40, 0, 100);
  const parts: ReadinessPart[] = [
    { id: "skills", weight: 0.4, score: skillScore },
    { id: "stability", weight: 0.15, score: clamp(input.stability, 0, 100) },
    { id: "trend", weight: 0.15, score: trendScore },
    { id: "adherence", weight: 0.15, score: clamp(input.adherence, 0, 100) },
    { id: "confidence", weight: 0.15, score: clamp(input.confidence, 0, 100) },
  ];
  const score = Math.round(parts.reduce((sum, part) => sum + part.weight * part.score, 0));
  return { score, parts, averageGap };
}

export type Weakness = {
  id: string;
  skill: Skill;
  gap: number;
  severity: "high" | "medium" | "low";
  title: Bi;
  evidence: Bi;
};

export function deriveWeaknesses(bands: SkillBands, targets: SkillBands): Weakness[] {
  const order = ["writing-task", "writing-coherence", "reading-speed", "listening-detail", "speaking-fluency", "grammar-range"];
  const gaps = Object.fromEntries(SKILLS.map((skill) => [skill, Math.max(0, targets[skill] - bands[skill])])) as SkillBands;
  const chosen: string[] = [];
  if (gaps.writing >= 0.5) chosen.push("writing-task", "writing-coherence");
  if (gaps.reading >= 0.5) chosen.push("reading-speed");
  if (gaps.listening >= 0.5) chosen.push("listening-detail");
  if (gaps.speaking >= 0.5) chosen.push("speaking-fluency");
  if (gaps.writing >= 1 || gaps.speaking >= 1) chosen.push("grammar-range");
  if (!chosen.length) {
    const weakest = [...SKILLS].sort((a, b) => bands[a] - bands[b])[0];
    if (weakest === "writing") chosen.push("writing-coherence");
    if (weakest === "reading") chosen.push("reading-speed");
    if (weakest === "listening") chosen.push("listening-detail");
    if (weakest === "speaking") chosen.push("speaking-fluency");
  }
  return order
    .filter((id) => chosen.includes(id))
    .map((id) => {
      const meta = WEAKNESS_COPY[id];
      const gap = gaps[meta.skill];
      const severity = gap >= 1.5 ? "high" : gap >= 0.5 ? "medium" : "low";
      return { id, skill: meta.skill, gap, severity, title: meta.title, evidence: meta.evidence };
    });
}

export function deriveStrengths(bands: SkillBands, targets: SkillBands) {
  return SKILLS.filter((skill) => targets[skill] - bands[skill] <= 0).map((skill) => ({
    skill,
    text: STRENGTH_COPY[skill],
  }));
}

export type PlanTask = {
  id: string;
  weaknessId: string;
  skill: Skill;
  title: Bi;
  objective: Bi;
  minutes: number;
  difficulty: "foundation" | "core" | "stretch";
  priority: Priority;
  success: Bi;
  phase: 1 | 2 | 3 | 4;
  day: number;
  status: TaskStatus;
};

const DAY_CYCLE = [6, 0, 1, 2, 3, 4, 5];

export function choosePath(input: { bands: SkillBands; targets: SkillBands; daysLeft: number | null }): PlanPath {
  if (input.daysLeft != null && input.daysLeft <= 21) return "sprint";
  const gaps = SKILLS.map((skill) => targetsGap(input.bands, input.targets, skill));
  const max = Math.max(...gaps);
  const small = gaps.filter((gap) => gap <= 0.5).length;
  if (max >= 1 && small >= 3) return "bottleneck";
  return "balanced";
}

function targetsGap(bands: SkillBands, targets: SkillBands, skill: Skill) {
  return Math.max(0, targets[skill] - bands[skill]);
}

export function buildPlan(input: {
  bands: SkillBands;
  targets: SkillBands;
  overall: number;
  dailyMinutes: number;
  daysPerWeek: number;
  daysLeft: number | null;
  path: PlanPath | "auto";
  edits: Record<string, TaskEdit>;
  scope: string;
}): { tasks: PlanTask[]; path: PlanPath; phases: typeof PHASES } {
  const path = input.path === "auto" ? choosePath(input) : input.path;
  const weaknesses = deriveWeaknesses(input.bands, input.targets).map((item) => item.id);
  let templates = TASK_TEMPLATES.filter((template) => weaknesses.includes(template.weaknessId) || template.id === "maintain-mixed");
  if (input.overall >= 5.5) templates = templates.filter((template) => template.phase !== 1 || template.priority === "high");
  if (path === "sprint") {
    templates = templates.filter((template) => template.priority !== "low" && template.phase !== 1);
  }
  if (path === "bottleneck") {
    const focus = deriveWeaknesses(input.bands, input.targets)[0]?.skill;
    templates = templates.filter((template) => template.skill === focus || template.priority === "high");
  }
  if (input.dailyMinutes <= 40) {
    templates = templates.filter((template) => template.priority !== "low").slice(0, 6);
  }
  const unique: typeof templates = [];
  for (const template of templates) {
    if (!unique.some((item) => item.id === template.id)) unique.push(template);
  }
  const days = DAY_CYCLE.slice(0, Math.max(1, Math.min(7, input.daysPerWeek)));
  const tasks: PlanTask[] = unique.slice(0, 8).map((template, index) => {
    const id = `${input.scope}:${template.id}`;
    const edit = input.edits[id] ?? {};
    const minutes = clamp(edit.minutes ?? (input.dailyMinutes <= 40 ? Math.min(template.minutes, 20) : template.minutes), 10, 90);
    return {
      id,
      weaknessId: template.weaknessId,
      skill: template.skill,
      title: template.title,
      objective: template.objective,
      minutes,
      difficulty: template.difficulty,
      priority: edit.priority ?? template.priority,
      success: template.success,
      phase: template.phase,
      day: edit.day ?? days[index % days.length],
      status: edit.status ?? "todo",
    };
  });
  return { tasks, path, phases: PHASES };
}

export type HistoryPoint = { date: string; bands: SkillBands; overall: number };

export function buildHistory(input: {
  bands: SkillBands;
  skillTrend: SkillBands;
  points: number;
  spanDays: number;
  today: string;
}): HistoryPoint[] {
  const count = Math.max(1, input.points);
  return Array.from({ length: count }, (_, index) => {
    const fraction = count === 1 ? 1 : index / (count - 1);
    const bands = emptyBands();
    for (const skill of SKILLS) {
      const start = input.bands[skill] - input.skillTrend[skill];
      bands[skill] = roundBand(start + input.skillTrend[skill] * fraction);
    }
    const dayOffset = Math.round(-input.spanDays * (1 - fraction));
    return { date: addDays(input.today, dayOffset), bands, overall: overallBand(bands) };
  });
}

export type LearnerSource = {
  id: string;
  fictional: boolean;
  person: Bi;
  summary: Bi;
  examType: Profile["examType"];
  reason: Profile["reason"];
  reasonNote: Bi;
  mockCount: number;
  bands: SkillBands;
  targetOverall: number;
  targetSkills: SkillBands;
  suggestedOverall: number;
  dailyMinutes: number;
  daysPerWeek: number;
  timing: ExamTiming;
  adherence: number;
  trend: number;
  stability: number;
  confidence: number;
  confidenceBySkill: SkillBands;
  history: HistoryPoint[];
  exercisesDone: number;
  tasksDone: number;
  streakDays: number;
  objective: ObjectiveScore | null;
  hasEstimate: boolean;
};

export function scenarioTiming(offset: number | null, today: string): ExamTiming {
  if (offset == null) return { kind: "unknown" };
  return { kind: "date", date: addDays(today, offset) };
}

export function sourceFromScenario(scenario: Scenario, overrides: LabOverrides | null, today: string): LearnerSource {
  const bands = overrides?.bands ?? scenario.bands;
  const targetSkills = overrides?.targetSkills ?? scenario.targetSkills;
  const targetOverall = overrides?.targetOverall ?? scenario.targetOverall;
  const dailyMinutes = overrides?.dailyMinutes ?? scenario.dailyMinutes;
  const daysPerWeek = overrides?.daysPerWeek ?? scenario.daysPerWeek;
  const offset = overrides && "examOffsetDays" in overrides ? overrides.examOffsetDays ?? null : scenario.examOffsetDays;
  const skillTrend = scenario.skillTrend;
  return {
    id: scenario.id,
    fictional: true,
    person: scenario.person,
    summary: scenario.summary,
    examType: scenario.examType,
    reason: scenario.reason,
    reasonNote: scenario.reasonNote,
    mockCount: scenario.mockIds.length,
    bands,
    targetOverall,
    targetSkills,
    suggestedOverall: scenario.suggestedOverall,
    dailyMinutes,
    daysPerWeek,
    timing: scenarioTiming(offset, today),
    adherence: overrides?.adherence ?? scenario.adherence,
    trend: overrides?.trend ?? scenario.trend,
    stability: overrides?.stability ?? scenario.stability,
    confidence: overrides?.confidence ?? scenario.confidence,
    confidenceBySkill: {
      listening: overrides?.confidence ?? scenario.confidence,
      reading: overrides?.confidence ?? scenario.confidence,
      writing: Math.min(overrides?.confidence ?? scenario.confidence, 46),
      speaking: Math.min(overrides?.confidence ?? scenario.confidence, 42),
    },
    history: buildHistory({
      bands,
      skillTrend,
      points: scenario.historyPoints,
      spanDays: scenario.historySpanDays,
      today,
    }),
    exercisesDone: scenario.exercisesDone,
    tasksDone: scenario.tasksDone,
    streakDays: scenario.streakDays,
    objective: null,
    hasEstimate: true,
  };
}

export function sourceFromSelf(input: {
  profile: Profile;
  placement: PlacementState;
  overrides: LabOverrides | null;
  today: string;
  exerciseCount: number;
  mockCount: number;
}): LearnerSource | null {
  const score = scorePlacement(input.placement);
  if (!input.profile || !score) return null;
  const bands = input.overrides?.bands ?? score.bands;
  const targets = input.overrides?.targetSkills ?? input.profile.targetSkills;
  const confidence = input.overrides?.confidence ?? Math.round(SKILLS.reduce((sum, skill) => sum + score.confidenceBySkill[skill], 0) / 4 + Math.min(8, input.mockCount * 4));
  const trend = input.overrides?.trend ?? 0;
  return {
    id: "self",
    fictional: false,
    person: { fa: input.profile.name, en: input.profile.name },
    summary: {
      fa: "این برآورد از پاسخ‌های همین مرورگر ساخته شده و هنوز یک نمونه رسمی نیست.",
      en: "This estimate is built from answers in this browser. It is still not an official result.",
    },
    examType: input.profile.examType,
    reason: input.profile.reason,
    reasonNote: { fa: input.profile.reasonNote, en: input.profile.reasonNote },
    mockCount: input.mockCount,
    bands,
    targetOverall: input.overrides?.targetOverall ?? input.profile.targetOverall,
    targetSkills: targets,
    suggestedOverall: input.profile.suggestedOverall,
    dailyMinutes: input.overrides?.dailyMinutes ?? input.profile.dailyMinutes,
    daysPerWeek: input.overrides?.daysPerWeek ?? input.profile.daysPerWeek,
    timing: input.overrides && "examOffsetDays" in input.overrides && input.overrides.examOffsetDays != null
      ? scenarioTiming(input.overrides.examOffsetDays, input.today)
      : input.profile.timing,
    adherence: input.overrides?.adherence ?? 0,
    trend,
    stability: input.overrides?.stability ?? (input.mockCount > 0 ? 55 : 36),
    confidence,
    confidenceBySkill: score.confidenceBySkill,
    history: buildHistory({
      bands,
      skillTrend: emptyBands(0),
      points: 1,
      spanDays: 0,
      today: input.today,
    }),
    exercisesDone: input.exerciseCount,
    tasksDone: 0,
    streakDays: input.exerciseCount > 0 ? 1 : 0,
    objective: score,
    hasEstimate: true,
  };
}

export type LearnerView = {
  source: LearnerSource;
  overall: number;
  range: { low: number; high: number };
  readiness: ReturnType<typeof readinessIndex>;
  hours: HourEstimate;
  daysLeft: number | null;
  weeksLeft: number | null;
  weaknesses: Weakness[];
  strengths: ReturnType<typeof deriveStrengths>;
  bottleneck: Weakness | null;
  plan: ReturnType<typeof buildPlan>;
  timePressure: "unknown" | "enough" | "tight" | "short";
  points: number;
  badges: { id: string; title: Bi; earned: boolean }[];
  unrealisticTarget: boolean;
};

export function buildView(source: LearnerSource, input: { path: PlanPath | "auto"; edits: Record<string, TaskEdit>; today: string }): LearnerView {
  const overall = overallBand(source.bands);
  const spread = source.confidence < 45 ? 1 : 0.5;
  const readiness = readinessIndex({
    bands: source.bands,
    targets: source.targetSkills,
    stability: source.stability,
    trend: source.trend,
    adherence: source.adherence,
    confidence: source.confidence,
  });
  const hours = estimateHours(source.bands, source.targetSkills, source.dailyMinutes, source.daysPerWeek);
  const daysLeft = daysFromTiming(source.timing, input.today);
  const weeksLeft = weeksFromTiming(source.timing, input.today);
  const weaknesses = deriveWeaknesses(source.bands, source.targetSkills);
  const plan = buildPlan({
    bands: source.bands,
    targets: source.targetSkills,
    overall,
    dailyMinutes: source.dailyMinutes,
    daysPerWeek: source.daysPerWeek,
    daysLeft,
    path: input.path,
    edits: input.edits,
    scope: source.id,
  });
  const doneTasks = plan.tasks.filter((task) => task.status === "done").length;
  const tasksDone = source.id === "self" ? doneTasks : source.tasksDone;
  const adherence = source.id === "self" && plan.tasks.length
    ? Math.round((doneTasks / plan.tasks.length) * 100)
    : source.adherence;
  const readinessAdjusted = source.id === "self"
    ? readinessIndex({
        bands: source.bands,
        targets: source.targetSkills,
        stability: source.stability,
        trend: source.trend,
        adherence,
        confidence: source.confidence,
      })
    : readiness;
  let timePressure: LearnerView["timePressure"] = "unknown";
  if (weeksLeft == null) timePressure = "unknown";
  else if (hours.weeksHigh != null && weeksLeft >= hours.weeksHigh) timePressure = "enough";
  else if (hours.weeksLow != null && weeksLeft >= hours.weeksLow) timePressure = "tight";
  else timePressure = "short";
  const points = 40 + source.exercisesDone * 15 + tasksDone * 10 + source.mockCount * 25 + source.streakDays * 5;
  const badges = [
    { id: "placement", title: { fa: "تعیین سطح کامل شد", en: "Placement finished" }, earned: source.hasEstimate },
    { id: "streak3", title: { fa: "سه روز پیوسته", en: "Three-day streak" }, earned: source.streakDays >= 3 },
    { id: "streak7", title: { fa: "هفت روز پیوسته", en: "Seven-day streak" }, earned: source.streakDays >= 7 },
    { id: "mock", title: { fa: "یک آزمونک ثبت شد", en: "A mini-mock was logged" }, earned: source.mockCount > 0 },
    { id: "focus", title: { fa: "تمرکز روی مهارت عقب", en: "Focus on the trailing skill" }, earned: plan.path !== "balanced" },
  ];
  const bottleneck = [...weaknesses].sort((a, b) => b.gap - a.gap)[0] ?? null;
  return {
    source: { ...source, adherence, tasksDone },
    overall,
    range: { low: clamp(roundBand(overall - spread), 0, 9), high: clamp(roundBand(overall + spread), 0, 9) },
    readiness: readinessAdjusted,
    hours,
    daysLeft,
    weeksLeft,
    weaknesses,
    strengths: deriveStrengths(source.bands, source.targetSkills),
    bottleneck: bottleneck && bottleneck.gap >= 0.5 ? bottleneck : null,
    plan,
    timePressure,
    points,
    badges,
    unrealisticTarget: source.targetOverall - source.suggestedOverall >= 0.5 || timePressure === "short",
  };
}

export function coverageBySkill(tasks: PlanTask[]) {
  const totals = emptyBands();
  for (const task of tasks) {
    if (task.status === "skipped") continue;
    totals[task.skill] += task.minutes;
  }
  return totals;
}

export function placementProgress(placement: PlacementState) {
  return SKILLS.filter((skill) => placement.done[skill]).length;
}

export function gradeItems(ids: string[], answers: Record<string, string>) {
  const objective = ids.filter((id) => bankItem(id).kind !== "writing" && bankItem(id).kind !== "speaking");
  const correct = objective.filter((id) => answerIsCorrect(id, answers[id])).length;
  return { correct, total: objective.length, unanswered: objective.filter((id) => !answers[id]?.trim()).length };
}

export function scenarioById(id: ScenarioId) {
  return SCENARIOS[id];
}

export function evidenceLines(view: LearnerView): Bi[] {
  const lines: Bi[] = [
    {
      fa: "تعیین سطح نمایشی کوتاه است و جدول خام آزمون رسمی استفاده نشده.",
      en: "The placement is a short demo and does not use official raw-score tables.",
    },
  ];
  if (view.source.objective) {
    lines.push({
      fa: `شنیدن ${view.source.objective.objectiveCorrect.listening} از ${view.source.objective.objectiveCorrect.listeningTotal} و خواندن ${view.source.objective.objectiveCorrect.reading} از ${view.source.objective.objectiveCorrect.readingTotal} پاسخ درست داشت.`,
      en: `Listening had ${view.source.objective.objectiveCorrect.listening} of ${view.source.objective.objectiveCorrect.listeningTotal} correct, and reading had ${view.source.objective.objectiveCorrect.reading} of ${view.source.objective.objectiveCorrect.readingTotal}.`,
    });
  } else {
    lines.push({
      fa: "نمره‌های این صفحه از سناریوی ساختگی آمده‌اند، نه از یک آزمون زنده.",
      en: "Bands on this page come from a fictional scenario, not a live test.",
    });
  }
  lines.push({
    fa: "نوشتن و صحبت کردن با قاعده طول و ساختار تخمین زده می‌شوند. مدل زبانی متصل نیست.",
    en: "Writing and speaking use length and structure rules. No language model is connected.",
  });
  if (view.timePressure === "short") {
    lines.push({
      fa: "ساعت مطالعه تا تاریخ آزمون از کف برآورد ساعت کمتر است.",
      en: "Study hours before the exam date are below the low end of the hour estimate.",
    });
  }
  return lines;
}

export { todayIso };
