import { useCallback } from "react";
import { toast } from "sonner";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";

/** The single logout: ends the session on the server, then the guards send the visitor to /login. */
export function useLogout() {
  const { logout } = useAuth();
  const { t } = useT();
  return useCallback(async () => {
    try {
      await logout();
    } catch {
      toast.error(t("logout.error"));
    }
  }, [logout, t]);
}
