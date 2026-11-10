import { describe, expect, it } from "vitest";
import { maskPhone, normalizePhone, toLatinDigits } from "./phone.js";

describe("toLatinDigits", () => {
  it("converts Persian and Arabic-Indic digits and strips separators", () => {
    expect(toLatinDigits("۰۹۱۲ ۳۴۵-۶۷۸۹")).toBe("09123456789");
    expect(toLatinDigits("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
    expect(toLatinDigits("(0912) 345-6789")).toBe("09123456789");
    expect(toLatinDigits("+98 912")).toBe("+98912");
  });

  it("returns '' for non-strings", () => {
    expect(toLatinDigits(null)).toBe("");
    expect(toLatinDigits(undefined)).toBe("");
  });
});

describe("normalizePhone", () => {
  it.each([
    "09123456789",
    "+989123456789",
    "00989123456789",
    "989123456789",
    "9123456789",
    "۰۹۱۲۳۴۵۶۷۸۹",
    "+۹۸۹۱۲۳۴۵۶۷۸۹",
    "٠٩١٢٣٤٥٦٧٨٩",
    "0912 345 6789",
    "0912-345-6789",
    "(0912) 345 6789",
    " +98 912 345 6789 ",
  ])("normalizes %s", (input) => {
    expect(normalizePhone(input)).toBe("09123456789");
  });

  it.each([
    "02112345678",
    "0912345678",
    "091234567890",
    "08123456789",
    "+19123456789",
    "+449123456789",
    "abc",
    "",
    "09a23456789",
    "0912345678x",
    "++989123456789",
  ])("rejects %s", (input) => {
    expect(normalizePhone(input)).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone(9123456789)).toBeNull();
    expect(normalizePhone({})).toBeNull();
  });
});

describe("maskPhone", () => {
  it("keeps first 4 and last 4", () => {
    expect(maskPhone("09123456789")).toBe("0912***6789");
  });

  it("works for any input", () => {
    expect(maskPhone(null)).toBe("");
    expect(maskPhone(undefined)).toBe("");
    expect(maskPhone("")).toBe("");
    expect(maskPhone("123")).toBe("***");
    expect(maskPhone("12345678")).toBe("***");
    expect(maskPhone("123456789")).toBe("1234***6789");
    expect(maskPhone(9123456789)).toBe("9123***6789");
  });
});
