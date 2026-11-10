/* global console */
// Wires the job handlers into the job runner (spec 4.2). server.js starts the
// scheduler only when shouldStartJobs() says so; the schedules live in JOB_SCHEDULES.
import { runOtpCleanup } from "./otp-cleanup.js";
import { runStudyReminders } from "./study-reminders.js";

/**
 * The in-process scheduler runs in production, or locally when ENABLE_JOBS=1.
 * @param {Record<string, unknown>} config validated environment (validateEnv().config)
 */
export const shouldStartJobs = (config) => config.NODE_ENV === "production" || String(config.ENABLE_JOBS) === "1";

/**
 * @param {{register: Function}} runner from createJobRunner()
 * @param {{sms: {sendTemplate: Function}, logger?: any}} deps
 */
export function registerJobs(runner, { sms, logger = console }) {
  runner.register("study-reminders", {
    handler: ({ db, now }) => runStudyReminders({ db, now, sms, logger }),
  });
  runner.register("otp-cleanup", { handler: ({ db, now }) => runOtpCleanup({ db, now }) });
  return runner;
}
