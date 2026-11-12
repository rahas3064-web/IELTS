import { toLatinDigits } from "@/src/lib/phone";

export const OTP_LENGTH = 5;

export type OtpDigits = readonly string[];
export type OtpUpdate = { digits: string[]; focus: number };

export const emptyOtp = (): string[] => Array.from({ length: OTP_LENGTH }, () => "");

const onlyDigits = (raw: string) => toLatinDigits(raw).replace(/\D/g, "");

const clampFocus = (index: number) => Math.min(index, OTP_LENGTH - 1);

/** Text typed, autofilled or cleared in box `index`. */
export function typeAt(digits: OtpDigits, index: number, raw: string): OtpUpdate {
  let typed = onlyDigits(raw);
  const next = [...digits];
  if (typed === "") {
    if (raw === "") next[index] = "";
    return { digits: next, focus: index };
  }
  // A filled box that gets one more digit keeps only the new one.
  const old = digits[index];
  if (old && typed.length === 2 && (typed[0] === old || typed[1] === old)) {
    typed = typed[0] === old ? typed[1] : typed[0];
  }
  let cursor = index;
  for (const digit of typed) {
    if (cursor >= OTP_LENGTH) break;
    next[cursor] = digit;
    cursor += 1;
  }
  return { digits: next, focus: clampFocus(cursor) };
}

/** Pasted text replaces the whole code. */
export function pasteAll(_digits: OtpDigits, raw: string): OtpUpdate {
  const typed = onlyDigits(raw).slice(0, OTP_LENGTH);
  const next = emptyOtp();
  [...typed].forEach((digit, position) => {
    next[position] = digit;
  });
  return { digits: next, focus: clampFocus(typed.length) };
}

export function backspaceAt(digits: OtpDigits, index: number): OtpUpdate {
  const next = [...digits];
  if (next[index]) {
    next[index] = "";
    return { digits: next, focus: index };
  }
  if (index > 0) {
    next[index - 1] = "";
    return { digits: next, focus: index - 1 };
  }
  return { digits: next, focus: 0 };
}

export const codeOf = (digits: OtpDigits): string => digits.join("");
