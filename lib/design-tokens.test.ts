import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const entry = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");

function block(selector: string) {
  const start = css.indexOf(selector);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function token(source: string, name: string) {
  const match = source.match(new RegExp(`${name}:\\s*([^;]+)`));
  return match?.[1].trim() ?? "";
}

describe("institutional editorial tokens", () => {
  const light = block(":root {");
  const dark = block(".dark {");

  it("keeps the approved light palette", () => {
    expect(token(light, "--background")).toBe("#F4EFE6");
    expect(token(light, "--foreground")).toBe("#1A2332");
    expect(token(light, "--primary")).toBe("#1A2332");
    expect(token(light, "--primary-foreground")).toBe("#F4EFE6");
    expect(token(light, "--secondary")).toBe("#E7DFD2");
    expect(token(light, "--accent")).toBe("#3F5C4B");
    expect(token(light, "--accent-foreground")).toBe("#F4EFE6");
    expect(token(light, "--card")).toBe("#FBF8F3");
    expect(token(light, "--muted-foreground")).toBe("#5C564E");
    expect(token(light, "--border")).toBe("#B7AA98");
  });

  it("inverts the same inks for dark mode", () => {
    expect(token(dark, "--background")).toBe("#141B26");
    expect(token(dark, "--foreground")).toBe("#F4EFE6");
    expect(token(dark, "--card")).toBe("#1C2533");
    expect(token(dark, "--primary")).toBe("#F4EFE6");
    expect(token(dark, "--primary-foreground")).toBe("#1A2332");
    expect(token(dark, "--accent")).toBe("#7F9278");
    expect(token(dark, "--accent-foreground")).toBe("#1A2332");
    expect(token(dark, "--muted-foreground")).toBe("#D4C8B8");
    expect(token(dark, "--border")).toBe("#6A5E52");
  });

  it("sets Newsreader for English prose and drops the indigo brand", () => {
    expect(token(light, "--font-newsreader")).toBe("Newsreader");
    expect(token(css, "--font-serif")).toContain("font-newsreader");
    expect(entry).toContain("@fontsource/newsreader/");
    expect(entry).not.toContain("literata");
    expect(css.toLowerCase()).not.toContain("#30247d");
    expect(css.toLowerCase()).not.toContain("#b9a5ff");
    expect(css.toLowerCase()).not.toContain("#17143f");
  });
});
