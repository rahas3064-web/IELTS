export const SKILLS = ["listening", "reading", "writing", "speaking"] as const;
export type Skill = (typeof SKILLS)[number];

export const LOCALES = ["fa", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const PLANNED_LOCALES = ["es", "fr", "de", "ar"] as const;

export type Role = "learner" | "content_manager" | "system_admin" | "support_agent";
export type ExamType = "academic" | "general";
export type Reason = "migration" | "university" | "work" | "personal" | "other";
export type ExamTiming =
  | { kind: "date"; date: string }
  | { kind: "window"; months: number }
  | { kind: "unknown" };

export type SkillBands = Record<Skill, number>;

export type TextScale = "sm" | "md" | "lg";
export type Connection = "online" | "slow" | "offline";
export type PlanPath = "balanced" | "bottleneck" | "sprint";
export type TaskStatus = "todo" | "doing" | "done" | "skipped";
export type Priority = "high" | "medium" | "low";
export type Difficulty = "foundation" | "core" | "stretch";
export type PublishStatus = "draft" | "in_review" | "published" | "retired";
export type DeliveryStatus = "backlog" | "ready" | "in_progress" | "review" | "blocked" | "done";

export type Bi = { fa: string; en: string };

export type Profile = {
  name: string;
  email: string;
  phone: string;
  age: number;
  examType: ExamType;
  reason: Reason;
  reasonNote: string;
  selfBand: number | null;
  previousOverall: number | null;
  targetOverall: number;
  targetSkills: SkillBands;
  timing: ExamTiming;
  dailyMinutes: number;
  daysPerWeek: number;
  suggestedOverall: number;
};

export type PlacementState = {
  startedAt: string | null;
  answers: Record<string, string>;
  writing1: string;
  writing2: string;
  speaking: Record<string, string>;
  speakingRecorded: Record<string, number>;
  done: Partial<Record<Skill, string>>;
};

export type TaskEdit = {
  status?: TaskStatus;
  minutes?: number;
  day?: number;
  priority?: Priority;
};

export type LabOverrides = {
  bands?: SkillBands;
  targetOverall?: number;
  targetSkills?: SkillBands;
  dailyMinutes?: number;
  daysPerWeek?: number;
  examOffsetDays?: number | null;
  adherence?: number;
  trend?: number;
  stability?: number;
  confidence?: number;
};

export type Account = {
  name: string;
  email: string;
  phone: string;
  age: number;
  role: Role;
};

export type ExerciseAttempt = {
  id: string;
  exerciseId: string;
  skill: Skill;
  at: string;
  correct: number;
  total: number;
};

export type MockAttempt = {
  id: string;
  mockId: string;
  at: string;
  bands: SkillBands;
  correct: number;
  total: number;
  answers: Record<string, string>;
};

export type Ticket = {
  id: string;
  kind: "feedback" | "bug" | "support" | "rating";
  page: string;
  topic: string;
  body: string;
  status: "open" | "triage" | "waiting" | "resolved";
  createdAt: string;
  rating?: number;
};

export type ProductEvent = {
  name: string;
  at: string;
  props: Record<string, string | number | boolean>;
};

export type SecurityEvent = {
  name: "login" | "logout" | "export" | "delete_local" | "consent_change";
  at: string;
  detail: string;
};

export type SavedLab = {
  id: string;
  name: string;
  base: "self" | "A" | "B" | "C";
  overrides: LabOverrides;
};

export type AppState = {
  locale: Locale;
  textScale: TextScale;
  reducedMotion: boolean;
  account: Account | null;
  accounts: Account[];
  onboardingDone: boolean;
  profile: Profile | null;
  dataSource: "self" | "A" | "B" | "C";
  placement: PlacementState;
  labOverrides: LabOverrides | null;
  savedLabs: SavedLab[];
  planPath: PlanPath | "auto";
  taskEdits: Record<string, TaskEdit>;
  exerciseAttempts: ExerciseAttempt[];
  mockAttempts: MockAttempt[];
  notificationReads: string[];
  notificationPrefs: {
    motivation: boolean;
    daily: boolean;
    plan: boolean;
    performance: boolean;
  };
  tickets: Ticket[];
  questionStatus: Record<string, PublishStatus>;
  deliveryStatus: Record<string, DeliveryStatus>;
  events: ProductEvent[];
  securityEvents: SecurityEvent[];
  connection: Connection;
  consentAnalytics: boolean;
  consentAt: string | null;
};
