import { describe, expect, it } from "vitest";
import { normalizePhone as serverNormalize } from "@/server/core/phone.js";
import { normalizePhone, toLatinDigits } from "@/src/lib/phone";

describe("toLatinDigits", () => {
  it("converts Persian and Arabic-Indic digits and strips separators", () => {
    expect(toLatinDigits("۰۹۱۲ ۳۴۵-۶۷۸۹")).toBe("09123456789");
    expect(toLatinDigits("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
    expect(toLatinDigits("(0912) 345\u200c6789")).toBe("09123456789");
  });
});

describe("normalizePhone", () => {
  it.each([
    ["09123456789", "09123456789"],
    ["9123456789", "09123456789"],
    ["+989123456789", "09123456789"],
    ["00989123456789", "09123456789"],
    ["989123456789", "09123456789"],
    ["۰۹۱۲۳۴۵۶۷۸۹", "09123456789"],
    ["+۹۸ ۹۱۲ ۳۴۵ ۶۷۸۹", "09123456789"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "0912345678", "091234567890", "02112345678", "+14155550123", "abcdefghijk", "08123456789"])(
    "rejects %s",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );

  it("agrees with the server rules on a sample of inputs", () => {
    const samples = ["09123456789", "+989123456789", "00989123456789", "۰۹۱۲۳۴۵۶۷۸۹", "9123456789", "0912", "+441234567890", ""];
    for (const sample of samples) {
      expect(normalizePhone(sample)).toBe(serverNormalize(sample));
    }
  });
});
