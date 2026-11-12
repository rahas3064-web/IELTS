import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/src/lib/api-client";
import { useFrame } from "@/components/features/bandora/panel/shell/frame-context";

export type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

type Page = { items: NotificationItem[]; nextCursor: string | null; unreadCount: number };
type ReadResult = { ok: boolean; unreadCount: number };

/** Notifications list with cursor paging; read actions refresh the header count. */
export function useNotifications() {
  const frame = useFrame();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const { setUnread } = frame;
  const load = useCallback(async (cursor: string | null) => {
    setLoading(true);
    setFailed(false);
    try {
      const path = cursor ? `/api/notifications?cursor=${encodeURIComponent(cursor)}` : "/api/notifications";
      const page = await api.get<Page>(path);
      if (!alive.current) return;
      setItems((current) => (cursor ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
      setUnread(page.unreadCount);
    } catch {
      if (alive.current) setFailed(true);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [setUnread]);

  useEffect(() => {
    void load(null);
  }, [load]);

  const afterRead = useCallback(
    async (result: ReadResult | null, patch: (item: NotificationItem) => NotificationItem) => {
      setItems((current) => current.map(patch));
      if (result) frame.setUnread(result.unreadCount);
      await frame.refetch();
    },
    [frame],
  );

  const markRead = useCallback(
    async (id: string) => {
      const stamp = new Date().toISOString();
      const result = await api.post<ReadResult>(`/api/notifications/${encodeURIComponent(id)}/read`);
      await afterRead(result, (item) => (item.id === id && !item.readAt ? { ...item, readAt: stamp } : item));
    },
    [afterRead],
  );

  const markAll = useCallback(async () => {
    const stamp = new Date().toISOString();
    const result = await api.post<ReadResult>("/api/notifications/read-all");
    await afterRead(result, (item) => (item.readAt ? item : { ...item, readAt: stamp }));
  }, [afterRead]);

  return {
    items,
    nextCursor,
    loading,
    failed,
    reload: () => load(null),
    loadMore: () => (nextCursor ? load(nextCursor) : Promise.resolve()),
    markRead,
    markAll,
  };
}
