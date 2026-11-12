import { useEffect, useState } from "react";
import { api } from "@/src/lib/api-client";

/**
 * Whether the local AUTH_DEV_BYPASS switch is on (the server decides; never true in production).
 * Starts false, so the normal SMS code path is shown unless the server says otherwise.
 */
export function useDevBypass(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .get<{ enabled?: boolean }>("/api/auth/dev-bypass", { handleAuth: false })
      .then((result) => {
        if (active) setEnabled(result?.enabled === true);
      })
      .catch(() => {
        // Unknown means off: the SMS code path stays.
      });
    return () => {
      active = false;
    };
  }, []);
  return enabled;
}
