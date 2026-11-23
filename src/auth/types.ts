import type { Locale } from "@/src/i18n";

export type MeUser = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  hasPassword?: boolean;
  phoneVerified?: boolean;
  role: string;
  locale: Locale;
  status: string;
};

export type ExamPrecision = "exact" | "approx" | "unknown";

export type Profile = {
  examType: "academic" | "general";
  targetBand: number | null;
  examDate: string | null;
  examDatePrecision: ExamPrecision | null;
  dailyMinutes: number | null;
  studyDays: number[];
  placementMode?: "quick" | "full" | null;
  planPath?: string;
  reminderSmsEnabled?: boolean;
  reminderTime?: string;
};

export type OnboardingState = { completed: boolean; step: 1 | 2 | 3 | null };

/** The GET /api/me payload (also returned by PUT /api/onboarding). */
export type Me = {
  user: MeUser;
  profile: Profile | null;
  onboarding: OnboardingState;
  /** True after a placement attempt is completed. Absent only on older cached payloads. */
  placementCompleted?: boolean;
  subscription: { plan: string; endsAt: string | null };
  emailCardDismissed: boolean;
};

export type AuthStatus = "loading" | "authed" | "anon" | "replaced";
