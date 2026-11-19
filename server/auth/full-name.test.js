import { describe, expect, it } from "vitest";
import { LAST_NAME_SENTINEL, displayName, splitFullName } from "./full-name.js";

describe("splitFullName", () => {
  it("puts the first word in first_name and the rest in last_name", () => {
    expect(splitFullName("  Sara   Ahmadi Karimi ")).toEqual({ firstName: "Sara", lastName: "Ahmadi Karimi" });
    expect(splitFullName("رها")).toEqual({ firstName: "رها", lastName: LAST_NAME_SENTINEL });
  });

  it("rejects an empty name and a part longer than 60 characters", () => {
    expect(splitFullName("   ")).toBeNull();
    expect(splitFullName("a".repeat(61))).toBeNull();
  });
});

describe("displayName", () => {
  it("hides the sentinel", () => {
    expect(displayName("رها", LAST_NAME_SENTINEL)).toBe("رها");
    expect(displayName("Sara", "Ahmadi")).toBe("Sara Ahmadi");
  });
});
