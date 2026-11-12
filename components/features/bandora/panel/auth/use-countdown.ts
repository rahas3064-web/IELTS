import { useCallback, useEffect, useState } from "react";

/** Whole seconds left until a deadline, ticking only while it is in the future. */
export function useCountdown(initialSeconds: number) {
  const [deadline, setDeadline] = useState(() => Date.now() + initialSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (Date.now() >= deadline) return;
    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [deadline]);

  const restart = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setDeadline(current + seconds * 1000);
  }, []);

  return { remaining: Math.max(0, Math.ceil((deadline - now) / 1000)), restart };
}
