import { describe, expect, it } from "vitest";
import { OTP_LENGTH, backspaceAt, codeOf, emptyOtp, pasteAll, typeAt } from "@/components/features/bandora/panel/auth/otp-model";

describe("otp model", () => {
  it("starts empty with five boxes", () => {
    expect(OTP_LENGTH).toBe(5);
    expect(emptyOtp()).toEqual(["", "", "", "", ""]);
  });

  it("types a digit and advances", () => {
    const next = typeAt(emptyOtp(), 0, "7");
    expect(next.digits).toEqual(["7", "", "", "", ""]);
    expect(next.focus).toBe(1);
  });

  it("accepts Persian and Arabic digits", () => {
    expect(typeAt(emptyOtp(), 0, "۴").digits[0]).toBe("4");
    expect(typeAt(emptyOtp(), 2, "٣").digits[2]).toBe("3");
  });

  it("ignores non-digits", () => {
    const next = typeAt(emptyOtp(), 0, "x");
    expect(next.digits).toEqual(emptyOtp());
    expect(next.focus).toBe(0);
  });

  it("spreads a multi-digit autofill from the current box", () => {
    const next = typeAt(emptyOtp(), 0, "12345");
    expect(next.digits).toEqual(["1", "2", "3", "4", "5"]);
    expect(next.focus).toBe(4);
  });

  it("replaces an existing digit when a second one is typed into the same box", () => {
    const start = ["1", "", "", "", ""];
    expect(typeAt(start, 0, "12").digits[0]).toBe("2");
    expect(typeAt(start, 0, "21").digits[0]).toBe("2");
  });

  it("clears a box when its text is deleted", () => {
    const next = typeAt(["1", "2", "", "", ""], 1, "");
    expect(next.digits).toEqual(["1", "", "", "", ""]);
    expect(next.focus).toBe(1);
  });

  it("pastes five digits over everything, ignoring separators", () => {
    const next = pasteAll(["9", "", "", "", ""], " ۱۲-345 ");
    expect(next.digits).toEqual(["1", "2", "3", "4", "5"]);
    expect(next.focus).toBe(4);
  });

  it("pastes fewer digits and ignores extra ones", () => {
    expect(pasteAll(emptyOtp(), "12").digits).toEqual(["1", "2", "", "", ""]);
    expect(pasteAll(emptyOtp(), "1234567").digits).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("backspace clears the current box, or steps back and clears the previous one", () => {
    expect(backspaceAt(["1", "2", "", "", ""], 1)).toEqual({ digits: ["1", "", "", "", ""], focus: 1 });
    expect(backspaceAt(["1", "2", "", "", ""], 2)).toEqual({ digits: ["1", "", "", "", ""], focus: 1 });
    expect(backspaceAt(emptyOtp(), 0)).toEqual({ digits: emptyOtp(), focus: 0 });
  });

  it("joins the code", () => {
    expect(codeOf(["1", "2", "", "", ""])).toBe("12");
  });
});
