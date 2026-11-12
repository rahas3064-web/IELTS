import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/src/auth/auth-provider";
import type { Locale } from "@/src/i18n";
import { translate } from "@/src/i18n";
import { api } from "@/src/lib/api-client";

/**
 * Switch the interface language. `users.locale` is the only store: the screen
 * flips at once (optimistic) and is put back if the server refuses.
 */
export function useSetLocale() {
  const { me, setMe } = useAuth();
  const current = me?.user.locale;
  return useCallback(
    async (next: Locale) => {
      if (!current || current === next) return;
      const apply = (locale: Locale) =>
        setMe((state) => (state ? { ...state, user: { ...state.user, locale } } : state));
      apply(next);
      try {
        await api.put("/api/me/locale", { locale: next });
      } catch {
        apply(current);
        toast.error(translate(current, "locale.error"));
      }
    },
    [current, setMe],
  );
}
