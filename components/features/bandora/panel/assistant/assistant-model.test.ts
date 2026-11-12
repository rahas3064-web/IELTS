import { describe, expect, it } from "vitest";
import { countWords, parseInline, parseMarkdown } from "./assistant-model";

describe("assistant model", () => {
  it("counts words like the server", () => {
    expect(countWords("  one two\nthree — ")).toBe(3);
    expect(countWords("")).toBe(0);
  });

  it("parses inline bold, code and emphasis", () => {
    expect(parseInline("Use **in contrast**, not `on contrast` here")).toEqual([
      { type: "text", text: "Use " },
      { type: "strong", text: "in contrast" },
      { type: "text", text: ", not " },
      { type: "code", text: "on contrast" },
      { type: "text", text: " here" },
    ]);
  });

  it("parses headings, numbered and bullet lists, code and paragraphs", () => {
    const blocks = parseMarkdown("### Estimated band\nOverall 6.0\n\n1. \"people thinks\" → \"people think\"\n2. second\n- tip\n```\ncode\n```");
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "list", "code"]);
    const ordered = blocks[2];
    expect(ordered.type === "list" && ordered.ordered && ordered.items.length).toBe(2);
  });
});
