import { Route, Routes, useParams } from "react-router-dom";
import Link from "@/components/link";
import {
  AssistantScreen,
  FeedbackScreen,
  HelpScreen,
  LabScreen,
  NotificationsScreen,
  PlansScreen,
  ProfileScreen,
  ReportsScreen,
} from "@/components/features/account";
import {
  AdminFeedbackScreen,
  AdminGate,
  AdminHome,
  AnalyticsScreen,
  ContentScreen,
  DesignSystemScreen,
  ExperimentsScreen,
  RoadmapAdminScreen,
  SettingsScreen,
  UsersScreen,
} from "@/components/features/admin";
import { ForgotScreen, LoginScreen, SignupScreen } from "@/components/features/auth";
import { DashboardScreen, PlanScreen, RoadmapScreen } from "@/components/features/home";
import { LandingPage } from "@/components/features/landing";
import { OnboardingScreen } from "@/components/features/onboarding";
import { PlacementHub, ReportScreen, SkillRunner } from "@/components/features/placement";
import { ArchiveScreen, ExerciseScreen, MockRunner, MocksScreen, PracticeScreen, ProgressScreen } from "@/components/features/study";
import { AppShell } from "@/components/shell/app-shell";
import { PublicFooter, PublicHeader } from "@/components/shell/public-header";

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">این صفحه در محصول نیست</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page is not part of the product.</p>
        <Link href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">بازگشت</Link>
      </div>
    </main>
  );
}

function PlansPage() {
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <PlansScreen />
      </main>
      <PublicFooter />
    </div>
  );
}

function PracticeRoute() {
  const { id } = useParams();
  return <ExerciseScreen id={id ?? ""} />;
}

function MockRoute() {
  const { id } = useParams();
  return <MockRunner id={id ?? ""} />;
}

function PlacementSkillRoute() {
  const { skill } = useParams();
  return <SkillRunner skill={skill ?? ""} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/signup" element={<SignupScreen />} />
      <Route path="/forgot-password" element={<ForgotScreen />} />
      <Route path="/plans" element={<PlansPage />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardScreen />} />
        <Route path="/roadmap" element={<RoadmapScreen />} />
        <Route path="/plan" element={<PlanScreen />} />
        <Route path="/practice" element={<PracticeScreen />} />
        <Route path="/practice/:id" element={<PracticeRoute />} />
        <Route path="/mocks" element={<MocksScreen />} />
        <Route path="/mocks/:id" element={<MockRoute />} />
        <Route path="/progress" element={<ProgressScreen />} />
        <Route path="/archive" element={<ArchiveScreen />} />
        <Route path="/notifications" element={<NotificationsScreen />} />
        <Route path="/assistant" element={<AssistantScreen />} />
        <Route path="/help" element={<HelpScreen />} />
        <Route path="/reports" element={<ReportsScreen />} />
        <Route path="/feedback" element={<FeedbackScreen />} />
        <Route path="/lab" element={<LabScreen />} />
        <Route path="/profile" element={<ProfileScreen />} />
        <Route path="/onboarding" element={<OnboardingScreen />} />
        <Route path="/placement" element={<PlacementHub />} />
        <Route path="/placement/report" element={<ReportScreen />} />
        <Route path="/placement/:skill" element={<PlacementSkillRoute />} />
        <Route path="/admin" element={<AdminGate path="/admin"><AdminHome /></AdminGate>} />
        <Route path="/admin/analytics" element={<AdminGate path="/admin/analytics"><AnalyticsScreen /></AdminGate>} />
        <Route path="/admin/content" element={<AdminGate path="/admin/content"><ContentScreen /></AdminGate>} />
        <Route path="/admin/design-system" element={<AdminGate path="/admin/design-system"><DesignSystemScreen /></AdminGate>} />
        <Route path="/admin/experiments" element={<AdminGate path="/admin/experiments"><ExperimentsScreen /></AdminGate>} />
        <Route path="/admin/feedback" element={<AdminGate path="/admin/feedback"><AdminFeedbackScreen /></AdminGate>} />
        <Route path="/admin/roadmap" element={<AdminGate path="/admin/roadmap"><RoadmapAdminScreen /></AdminGate>} />
        <Route path="/admin/settings" element={<AdminGate path="/admin/settings"><SettingsScreen /></AdminGate>} />
        <Route path="/admin/users" element={<AdminGate path="/admin/users"><UsersScreen /></AdminGate>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
