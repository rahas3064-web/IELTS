// Default runtime configuration (reference data, never learner content).
// Rows are inserted only when missing, so values an admin has changed survive a re-seed.

export const SYSTEM_SETTINGS = Object.freeze([
  // Spec S2: plain consecutive days; rest-day exemption stays off by default.
  Object.freeze({ key: "streak_skip_rest_days", value: false }),
  // Spec S2: SMS study reminders only inside this Tehran-time window.
  Object.freeze({ key: "reminder_window", value: Object.freeze({ start: "08:00", end: "22:00" }) }),
  // Spec S1: 5-digit code, 2 min lifetime, 60 s resend, 5 wrong tries lock for 15 min.
  Object.freeze({
    key: "otp",
    value: Object.freeze({ length: 5, ttlSec: 120, resendSec: 60, maxAttempts: 5, lockMinutes: 15 }),
  }),
]);
