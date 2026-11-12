import type { Locale } from "@/src/i18n";

export type MeUser = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  hasPassword?: boolean;
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
  subscription: { plan: string; endsAt: string | null };
  emailCardDismissed: boolean;
};

export type AuthStatus = "loading" | "authed" | "anon" | "replaced";
