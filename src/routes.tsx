import { Navigate, Route, Routes } from "react-router-dom";
import Link from "@/components/link";
import { LandingPage } from "@/components/features/bandora/landing-page";
import { LoginPage } from "@/components/features/bandora/panel/auth/login-page";
import { HomePage } from "@/components/features/bandora/panel/home-page";
import { OnboardingPage } from "@/components/features/bandora/panel/onboarding/onboarding-page";
import { PlacementIntro } from "@/components/features/bandora/panel/onboarding/placement-intro";
import { AppShell } from "@/components/features/bandora/panel/shell";
import { NotificationsPage } from "@/components/features/bandora/panel/shell/notifications-page";
import { ProfilePage, SubscriptionPage, UnpublishedSection } from "@/components/features/bandora/panel/account-pages";
import { AdminReviewPage } from "@/components/features/bandora/panel/admin/admin-review-page";
import { PlacementPage } from "@/components/features/bandora/panel/placement/placement-page";
import { PracticePage } from "@/components/features/bandora/panel/practice/practice-page";
import { AssistantPage } from "@/components/features/bandora/panel/assistant/assistant-page";
import { MockPage } from "@/components/features/bandora/panel/mock/mock-page";
import { PagePlaceholder } from "@/components/features/bandora/panel/ui/states";
import { AuthLayout } from "@/src/auth/auth-layout";
import { AdminHome } from "@/components/features/bandora/panel/admin/admin-home";
import { AdminLoginPage } from "@/components/features/bandora/panel/admin/admin-login-page";
import { GuestOnly, RequireAuth } from "@/src/auth/guards";

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">این صفحه وجود ندارد</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page is not part of the product.</p>
        <Link href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">
          بازگشت
        </Link>
      </div>
    </main>
  );
}

function Placeholder({ titleKey }: { titleKey: string }) {
  return <PagePlaceholder titleKey={titleKey} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/admin/review" element={<AdminReviewPage />} />
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            <GuestOnly>
              <LoginPage />
            </GuestOnly>
          }
        />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route
          path="/app/onboarding"
          element={
            <RequireAuth onboarding="incomplete">
              <OnboardingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/app/placement/intro"
          element={
            <RequireAuth>
              <PlacementIntro />
            </RequireAuth>
          }
        />
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="placement" element={<PlacementPage />} />
          <Route path="plan" element={<Placeholder titleKey="nav.plan" />} />
          <Route path="practice" element={<PracticePage />} />
          <Route path="feedback" element={<UnpublishedSection titleKey="nav.feedback" />} />
          <Route path="progress" element={<UnpublishedSection titleKey="nav.progress" />} />
          <Route path="mock" element={<MockPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="assistant" element={<AssistantPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
