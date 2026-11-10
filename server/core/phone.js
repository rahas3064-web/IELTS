// Iranian mobile number helpers. Canonical form: '09xxxxxxxxx' (11 digits).

const PERSIAN_ZERO = 0x06f0; // ۰
const ARABIC_INDIC_ZERO = 0x0660; // ٠
const SEPARATORS_RE = /[\s\-()\u200c\u200f\u200e]/g;
const MOBILE_RE = /^(?:\+98|0098|98|0)?(9\d{9})$/;

/**
 * Convert Persian/Arabic-Indic digits to Latin and strip spaces, dashes,
 * parentheses and bidi/zero-width marks.
 * @param {unknown} str
 * @returns {string}
 */
export function toLatinDigits(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - PERSIAN_ZERO))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(SEPARATORS_RE, "");
}

/**
 * @param {unknown} input
 * @returns {string|null} '09xxxxxxxxx' or null when not an Iranian mobile number
 */
export function normalizePhone(input) {
  const match = MOBILE_RE.exec(toLatinDigits(input));
  return match ? `0${match[1]}` : null;
}

/**
 * Mask a phone for logs/audit: first 4 digits, '***', last 4 digits.
 * Inputs too short to mask meaningfully collapse to '***'; null/undefined -> ''.
 * @param {unknown} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (phone === null || phone === undefined) return "";
  const s = String(phone);
  if (s === "") return "";
  if (s.length <= 8) return "***";
  return `${s.slice(0, 4)}***${s.slice(-4)}`;
}
