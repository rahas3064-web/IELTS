import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiClientError, api, setApiHandlers } from "@/src/lib/api-client";
import type { AuthStatus, Me } from "@/src/auth/types";

type AuthState = { status: AuthStatus; me: Me | null; loggedOut: boolean; justOnboarded: boolean };

export type AuthValue = {
  status: AuthStatus;
  me: Me | null;
  /** True after an explicit logout, so the redirect to /login carries no `next`. */
  loggedOut: boolean;
  /** True once this session saw onboarding go from unfinished to finished (the guard then lands on the placement intro). */
  justOnboarded: boolean;
  /** Re-read /api/me. Resolves to the fresh payload, or null when there is no session. */
  refresh: () => Promise<Me | null>;
  /** Replace or patch the cached payload (e.g. with a PUT /api/onboarding response). */
  setMe: (next: Me | ((current: Me | null) => Me | null)) => void;
  logout: () => Promise<void>;
  /** Leave the session-replaced screen: forget the dead session so /login is reachable. */
  acknowledgeReplaced: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

const INITIAL: AuthState = { status: "loading", me: null, loggedOut: false, justOnboarded: false };
const SIGNED_OUT: AuthState = { status: "anon", me: null, loggedOut: true, justOnboarded: false };

function withMe(current: AuthState, me: Me): AuthState {
  const finished = current.me !== null && !current.me.onboarding.completed && me.onboarding.completed;
  return { status: "authed", me, loggedOut: false, justOnboarded: current.justOnboarded || finished };
}

/** Loads /api/me once and owns the session state; the server stays the source of truth. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL);

  const probe = useCallback(async (): Promise<Me | "replaced" | null> => {
    try {
      return await api.get<Me>("/api/me", { handleAuth: false });
    } catch (error) {
      return error instanceof ApiClientError && error.code === "session_replaced" ? "replaced" : null;
    }
  }, []);

  const apply = useCallback((result: Me | "replaced" | null) => {
    setState((current) => {
      if (result === "replaced") return { ...INITIAL, status: "replaced" };
      if (result === null) return { ...INITIAL, status: "anon" };
      return withMe(current, result);
    });
  }, []);

  useEffect(() => {
    let active = true;
    void probe().then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [probe, apply]);

  useEffect(
    () =>
      setApiHandlers({
        onSessionReplaced: () => apply("replaced"),
        onUnauthenticated: () => apply(null),
      }),
    [apply],
  );

  const refresh = useCallback(async () => {
    const result = await probe();
    apply(result);
    return typeof result === "object" && result !== null ? result : null;
  }, [probe, apply]);

  const setMe = useCallback<AuthValue["setMe"]>((next) => {
    setState((current) => {
      const me = typeof next === "function" ? next(current.me) : next;
      return me ? withMe(current, me) : { ...current, me: null };
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (error) {
      // An already-dead session is as good as logged out; anything else leaves the user signed in.
      if (!(error instanceof ApiClientError && error.status === 401)) throw error;
    }
    setState(SIGNED_OUT);
  }, []);

  const acknowledgeReplaced = useCallback(() => setState(SIGNED_OUT), []);

  const value = useMemo<AuthValue>(
    () => ({ ...state, refresh, setMe, logout, acknowledgeReplaced }),
    [state, refresh, setMe, logout, acknowledgeReplaced],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
