import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { AppFrame } from "@/components/features/bandora/panel/ui/app-frame";
import { SessionReplaced } from "@/components/features/bandora/panel/auth/session-replaced";
import { AuthProvider, useAuth } from "@/src/auth/auth-provider";
import { I18nProvider } from "@/src/i18n";

/** Locale = `users.locale` once signed in, `fa` before. Never read from browser storage. */
function LocaleBridge({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  return <I18nProvider locale={me?.user.locale ?? "fa"}>{children}</I18nProvider>;
}

function Screen() {
  const { status } = useAuth();
  return <AppFrame>{status === "replaced" ? <SessionReplaced /> : <Outlet />}</AppFrame>;
}

/** Route layout for /login and /app/*: session, language, tokens and fonts. The landing page stays outside it. */
export function AuthLayout() {
  return (
    <AuthProvider>
      <LocaleBridge>
        <Screen />
      </LocaleBridge>
    </AuthProvider>
  );
}
