import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/src/lib/api-client";

export type FrameData = {
  unreadCount: number;
  streak: { current: number; best: number; activeToday: boolean };
  examCountdown: {
    days: number | null;
    date: string | null;
    precision: "exact" | "approx" | "unknown" | null;
    past?: boolean;
  };
  planToday: { total: number; done: number };
};

export type FrameValue = {
  data: FrameData | null;
  loading: boolean;
  failed: boolean;
  /** Re-read GET /api/frame (after notification actions, for example). */
  refetch: () => Promise<void>;
  /** Show a fresh unread count straight away, before the refetch lands. */
  setUnread: (count: number) => void;
};

const FrameContext = createContext<FrameValue | null>(null);

/** Header data (unread count, streak, exam countdown) from GET /api/frame, shared by the whole shell. */
export function FrameProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FrameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refetch = useCallback(async () => {
    try {
      setData(await api.get<FrameData>("/api/frame"));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const setUnread = useCallback((count: number) => {
    setData((current) => (current ? { ...current, unreadCount: Math.max(0, count) } : current));
  }, []);

  const value = useMemo(() => ({ data, loading, failed, refetch, setUnread }), [data, loading, failed, refetch, setUnread]);
  return <FrameContext.Provider value={value}>{children}</FrameContext.Provider>;
}

export function useFrame(): FrameValue {
  const value = useContext(FrameContext);
  if (!value) throw new Error("useFrame must be used inside FrameProvider");
  return value;
}
