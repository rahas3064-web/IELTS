import { readdirSync, readFileSync } from "node:fs";
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

describe("bandora panel tokens and icons", () => {
  const tokens = readFileSync(new URL("../components/features/bandora/panel/tokens.css", import.meta.url), "utf8");
  const frame = readFileSync(new URL("../components/features/bandora/panel/ui/app-frame.tsx", import.meta.url), "utf8");
  const landing = readFileSync(new URL("../components/features/bandora/landing-page.tsx", import.meta.url), "utf8");
  const iconDir = new URL("../components/features/bandora/panel/icons/", import.meta.url);
  const svgs = readdirSync(iconDir).filter((name) => name.endsWith(".svg")).sort();

  it("matches the approved panel palette", () => {
    expect(tokens).toContain("--bd-bg: #F6F1E7");
    expect(tokens).toContain("--bd-surface: #FBF8F1");
    expect(tokens).toContain("--bd-ink: #1A2238");
    expect(tokens).toContain("--bd-navy: #1F2E54");
    expect(tokens).toContain("--bd-navy-hover: #2C4073");
    expect(tokens).toContain("--bd-gold: #B08D4A");
    expect(tokens).toContain("--bd-gold-deep: #7A5C1E");
    expect(tokens).toContain("--bd-border: #D9CFBB");
    expect(tokens).toContain("--bd-body: #3F465C");
    expect(tokens).toContain("--bd-muted: #6B6757");
    expect(tokens).toContain("--bd-item: #EFE8D8");
    expect(tokens).toContain("--bd-wash: #F3EBD8");
    expect(tokens).toContain("--bd-select: #E4D3AC");
    expect(tokens).toContain("--bd-green: #4E7B62");
    expect(tokens).toContain("--bd-green-bg: #E7DFCD");
    expect(tokens).toContain("--bd-check-fill: #D5E0D8");
    expect(tokens).toContain("--bd-tint: #C9CEDC");
    expect(tokens).toContain("--bd-nav-inactive: #E8E2D4");
    expect(tokens).toContain("--bd-danger: #8C3B2F");
    expect(tokens).toContain("--bd-wrong-bg: #F7F0EB");
    expect(tokens).toContain("--bd-wrong-edge: #E8D8CF");
    expect(tokens).toContain("--bd-radius: 6px");
    expect(tokens).toContain("--bd-radius-sm: 4px");
    expect(tokens).toContain('--bd-font-en: Newsreader, Georgia, serif');
    expect(tokens).toContain('--bd-font-logo: "Playfair Display", Georgia, serif');
  });

  it("loads Newsreader in the panel and leaves the landing alone", () => {
    expect(frame).toContain("family=Newsreader");
    expect(landing).not.toContain("Newsreader");
  });

  it("ships 29 original icons at 24px with a 1.75 stroke", () => {
    expect(svgs).toHaveLength(29);
    expect(readFileSync(new URL("./NOTICE.txt", iconDir), "utf8")).toContain("back-rtl");
    for (const name of svgs) {
      const svg = readFileSync(new URL(`./${name}`, iconDir), "utf8");
      expect(svg).toContain('viewBox="0 0 24 24"');
      expect(svg).toContain('width="24"');
      expect(svg).toContain('height="24"');
      expect(svg).toContain('fill="none"');
      expect(svg).toContain('aria-hidden="true"');
      const stroked = svg.match(/<[^>]*\sstroke="[^"]+"[^>]*>/g) ?? [];
      expect(stroked.length).toBeGreaterThan(0);
      for (const tag of stroked) {
        expect(tag).toContain('stroke-width="1.75"');
        expect(tag).toContain('stroke-linecap="round"');
        expect(tag).toContain('stroke-linejoin="round"');
      }
    }
    const home = readFileSync(new URL("./nav-home.svg", iconDir), "utf8");
    const homeActive = readFileSync(new URL("./nav-home-active.svg", iconDir), "utf8");
    expect(home).toContain('fill="#E8E2D4"');
    expect(home).toContain('stroke="#6B6757"');
    expect(homeActive).toContain('fill="#C9CEDC"');
    expect(homeActive).toContain('stroke="#1F2E54"');
    expect(readFileSync(new URL("./check.svg", iconDir), "utf8")).toContain('stroke="#4E7B62"');
    expect(readFileSync(new URL("./streak-flame.svg", iconDir), "utf8")).toContain('fill="#B08D4A"');
    expect(readFileSync(new URL("./premium-crown.svg", iconDir), "utf8")).toContain('fill="#7A5C1E"');
    expect(readFileSync(new URL("./back-rtl.svg", iconDir), "utf8")).toContain("M9.2 5.6 16.4 12 9.2 18.4");
    for (const name of svgs) {
      const svg = readFileSync(new URL(`./${name}`, iconDir), "utf8");
      const gold = name === "streak-flame.svg" || name === "premium-crown.svg";
      expect(svg.includes("#B08D4A")).toBe(gold);
      expect(svg.includes("#7A5C1E")).toBe(name === "premium-crown.svg");
      expect(svg.includes("#4E7B62")).toBe(name === "check.svg");
    }
  });
});
