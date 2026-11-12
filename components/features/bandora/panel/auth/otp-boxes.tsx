import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { useT } from "@/src/i18n";
import {
  OTP_LENGTH,
  backspaceAt,
  codeOf,
  emptyOtp,
  pasteAll,
  typeAt,
  type OtpUpdate,
} from "@/components/features/bandora/panel/auth/otp-model";

type OtpBoxesProps = {
  /** Latin digits typed so far (0 to 5). */
  value: string;
  onChange: (value: string) => void;
  /** Called once when the fifth digit lands. */
  onComplete: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  /** Changing this puts focus back on the first box (after a wrong code). */
  resetKey?: number;
  describedBy?: string;
};

const toDigits = (value: string): string[] => {
  const digits = emptyOtp();
  [...value].slice(0, OTP_LENGTH).forEach((digit, index) => {
    digits[index] = digit;
  });
  return digits;
};

/** Five single-digit boxes: auto-advance, backspace, paste, one-time-code autofill, auto-submit at five. */
export function OtpBoxes({ value, onChange, onComplete, disabled, invalid, resetKey, describedBy }: OtpBoxesProps) {
  const { t, digits: show } = useT();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = toDigits(value);

  useEffect(() => {
    refs.current[0]?.focus();
  }, [resetKey]);

  function commit(update: OtpUpdate) {
    const before = codeOf(digits);
    const after = codeOf(update.digits);
    onChange(after);
    refs.current[update.focus]?.focus();
    if (after.length === OTP_LENGTH && before.length < OTP_LENGTH) onComplete(after);
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      commit(backspaceAt(digits, index));
    } else if (event.key === "ArrowLeft") {
      // The boxes read left to right in both locales.
      event.preventDefault();
      refs.current[Math.max(0, index - 1)]?.focus();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      refs.current[Math.min(OTP_LENGTH - 1, index + 1)]?.focus();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    commit(pasteAll(digits, event.clipboardData.getData("text")));
  }

  return (
    <div className="bd-otp" dir="ltr" role="group" aria-label={t("login.otp.label")} aria-describedby={describedBy}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          className="bd-input bd-otp__box"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={OTP_LENGTH}
          value={show(digit)}
          disabled={disabled}
          aria-label={t("login.otp.digit", { n: index + 1 })}
          aria-invalid={invalid ? true : undefined}
          onChange={(event) => commit(typeAt(digits, index, event.target.value))}
          onKeyDown={(event) => onKeyDown(index, event)}
          onPaste={onPaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
