import type { ReactNode } from "react";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";
import { FullPageSkeleton } from "@/components/features/bandora/panel/ui/states";
import { useAuth } from "@/src/auth/auth-provider";
import { loginHref, safeNext } from "@/src/lib/safe-next";

type RequireAuthProps = {
  children: ReactNode;
  /**
   * `complete` (default): /app/* needs a finished onboarding, else go to the wizard.
   * `incomplete`: the wizard itself; finished users are sent to /app.
   */
  onboarding?: "complete" | "incomplete";
};

export function RequireAuth({ children, onboarding = "complete" }: RequireAuthProps) {
  const { status, me, loggedOut, justOnboarded } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullPageSkeleton />;
  if (status !== "authed" || !me) {
    // `replaced` is rendered by AuthLayout before any guard runs.
    if (status === "replaced") return null;
    const here = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={loggedOut ? "/login" : loginHref(here)} replace />;
  }
  if (onboarding === "complete" && !me.onboarding.completed) return <Navigate to="/app/onboarding" replace />;
  if (onboarding === "incomplete" && me.onboarding.completed) {
    // Right after the third step the visitor goes on to the placement intro; a returning user goes to the panel.
    return <Navigate to={justOnboarded ? "/app/placement/intro" : "/app"} replace />;
  }
  return <>{children}</>;
}

/** /login for visitors only: a signed-in user goes on to `?next=` (or /app). */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [params] = useSearchParams();
  if (status === "loading") return <FullPageSkeleton />;
  if (status === "authed") return <Navigate to={safeNext(params.get("next"))} replace />;
  return <>{children}</>;
}
