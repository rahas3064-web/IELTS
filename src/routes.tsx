import { Navigate, Route, Routes } from "react-router-dom";
import Link from "@/components/link";
import { LandingPage } from "@/components/features/bandora/landing-page";
import { BandoraDashboard } from "@/components/features/bandora/panel/dashboard";
import { BandoraPanelShell, PanelPlaceholder } from "@/components/features/bandora/panel/shell";

function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">این صفحه وجود ندارد</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page is not part of the product.</p>
        <Link href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">بازگشت</Link>
      </div>
    </main>
  );
}

function LoginPlaceholder() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center" dir="rtl">
      <div>
        <h1 className="text-2xl font-semibold">صفحه ورود به‌زودی</h1>
        <Link href="/" className="mt-4 inline-block text-primary underline-offset-4 hover:underline">بازگشت به صفحه اصلی</Link>
      </div>
    </main>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPlaceholder />} />
      <Route path="/signup" element={<Navigate to="/login" replace />} />
      <Route path="/app" element={<BandoraPanelShell />}>
        <Route index element={<BandoraDashboard />} />
        <Route path="placement" element={<PanelPlaceholder />} />
        <Route path="plan" element={<PanelPlaceholder />} />
        <Route path="practice" element={<PanelPlaceholder />} />
        <Route path="feedback" element={<PanelPlaceholder />} />
        <Route path="progress" element={<PanelPlaceholder />} />
        <Route path="mock" element={<PanelPlaceholder />} />
        <Route path="profile" element={<PanelPlaceholder />} />
        <Route path="subscription" element={<PanelPlaceholder />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
