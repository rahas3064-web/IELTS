import { useEffect, useState } from "react";
import { api } from "@/src/lib/api-client";

/**
 * Whether SMS.ir OTP is configured. Null until the server answers.
 * A failed lookup stays on the password path, which is the live-site fallback.
 */
export function useSmsOtp(): boolean | null {
  const [smsOtp, setSmsOtp] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    api
      .get<{ smsOtp?: boolean }>("/api/auth/options", { handleAuth: false })
      .then((result) => {
        if (active) setSmsOtp(result?.smsOtp === true);
      })
      .catch(() => {
        if (active) setSmsOtp(false);
      });
    return () => {
      active = false;
    };
  }, []);
  return smsOtp;
}
