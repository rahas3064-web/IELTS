import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type SessionValue = {
  me: unknown;
  ready: boolean;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then(async (response) => {
        if (!active) return;
        setMe(response.ok ? await response.json() : null);
        setReady(true);
      })
      .catch(() => {
        if (!active) return;
        setMe(null);
        setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<SessionValue>(() => ({
    me,
    ready,
    signOut: async () => {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (response.ok) setMe(null);
    },
  }), [me, ready]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside the Bandora panel");
  return value;
}
