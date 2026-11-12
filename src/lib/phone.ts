// Client-side mirror of server/core/phone.js. The server stays the authority;
// this only gives instant feedback and sends the canonical 09xxxxxxxxx form.

const PERSIAN_ZERO = 0x06f0;
const ARABIC_INDIC_ZERO = 0x0660;
const SEPARATORS_RE = /[\s\-()\u200c\u200f\u200e]/g;
const MOBILE_RE = /^(?:\+98|0098|98|0)?(9\d{9})$/;

/** Persian/Arabic-Indic digits to Latin; strips spaces, dashes, parentheses and bidi marks. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[\u06f0-\u06f9]/g, (c) => String(c.charCodeAt(0) - PERSIAN_ZERO))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(SEPARATORS_RE, "");
}

/** @returns `09xxxxxxxxx`, or null when the input is not an Iranian mobile number. */
export function normalizePhone(input: string): string | null {
  const match = MOBILE_RE.exec(toLatinDigits(input));
  return match ? `0${match[1]}` : null;
}
