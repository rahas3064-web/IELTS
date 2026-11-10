// Rule E: every "day", "week" and "month" in Bandora is a Tehran-time notion.
// Day derivation uses Intl with an explicit timeZone, so it never depends on
// the server's TZ. Month bounds use the fixed +03:30 offset (Iran abolished DST
// in 2022, so this is exact for all current and future dates).

export const TEHRAN_TZ = "Asia/Tehran";

const TEHRAN_OFFSET_MS = (3 * 60 + 30) * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TEHRAN_TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * @param {Date|string|number} ts
 * @returns {Date}
 */
function toDate(ts) {
  const ok = ts instanceof Date || typeof ts === "string" || typeof ts === "number";
  const date = ok ? new Date(ts) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid timestamp");
  }
  return date;
}

/**
 * @param {Date|string|number} ts
 * @returns {{year:string, month:string, day:string, hour:string, minute:string}}
 */
function tehranParts(ts) {
  const out = {};
  for (const { type, value } of partsFormatter.formatToParts(toDate(ts))) {
    out[type] = value;
  }
  return out;
}

/**
 * Parse a 'YYYY-MM-DD' string into a UTC-midnight epoch (validates the calendar date).
 * @param {string} day
 * @returns {number}
 */
function dayToEpoch(day) {
  const match = typeof day === "string" ? DAY_RE.exec(day) : null;
  if (!match) throw new TypeError("Invalid day, expected YYYY-MM-DD");
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const epoch = Date.UTC(y, m - 1, d);
  const check = new Date(epoch);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) {
    throw new TypeError("Invalid calendar day");
  }
  return epoch;
}

/**
 * @param {number} epoch UTC-midnight epoch
 * @returns {string}
 */
function epochToDay(epoch) {
  return new Date(epoch).toISOString().slice(0, 10);
}

/**
 * Tehran calendar day of an instant.
 * @param {Date|string|number} ts
 * @returns {string} 'YYYY-MM-DD'
 */
export function tehranDay(ts) {
  const p = tehranParts(ts);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * @param {string} day 'YYYY-MM-DD'
 * @param {number} n whole number of days (may be negative)
 * @returns {string}
 */
export function addDays(day, n) {
  if (!Number.isInteger(n)) throw new TypeError("n must be an integer");
  return epochToDay(dayToEpoch(day) + n * MS_PER_DAY);
}

/**
 * 0 = Saturday ... 6 = Friday (Iranian week).
 * @param {string} day 'YYYY-MM-DD'
 * @returns {number}
 */
export function weekdayIndex(day) {
  const sundayBased = new Date(dayToEpoch(day)).getUTCDay(); // 0 = Sunday
  return (sundayBased + 1) % 7;
}

/**
 * Saturday of the Tehran week containing the instant.
 * @param {Date|string|number} ts
 * @returns {string} 'YYYY-MM-DD'
 */
export function tehranWeekStart(ts) {
  const day = tehranDay(ts);
  return addDays(day, -weekdayIndex(day));
}

/**
 * Gregorian month in Tehran time.
 * @param {Date|string|number} ts
 * @returns {string} 'YYYY-MM'
 */
export function tehranMonthKey(ts) {
  const p = tehranParts(ts);
  return `${p.year}-${p.month}`;
}

/**
 * UTC instants of the Tehran month start (inclusive) and next month start (exclusive).
 * @param {Date|string|number} ts
 * @returns {{start: Date, end: Date}}
 */
export function tehranMonthBounds(ts) {
  const p = tehranParts(ts);
  const year = Number(p.year);
  const monthIndex = Number(p.month) - 1;
  return {
    start: new Date(Date.UTC(year, monthIndex, 1) - TEHRAN_OFFSET_MS),
    end: new Date(Date.UTC(year, monthIndex + 1, 1) - TEHRAN_OFFSET_MS),
  };
}

/**
 * @param {Date|string|number} ts
 * @returns {{day: string, hour: number, minute: number}}
 */
export function tehranNow(ts) {
  const p = tehranParts(ts);
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute) };
}
