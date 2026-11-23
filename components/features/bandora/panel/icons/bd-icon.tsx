import type { CSSProperties } from "react";

const files = import.meta.glob("./*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Names passed to `BdIcon`. Active nav art is selected with `active`. */
export const BD_ICON_NAMES = [
  "nav-home",
  "nav-assistant",
  "nav-practice",
  "skill-listening",
  "skill-reading",
  "skill-writing",
  "skill-speaking",
  "node-lesson",
  "node-practice",
  "node-challenge",
  "node-review",
  "node-checkpoint",
  "streak-flame",
  "daily-goal",
  "lock",
  "premium-crown",
  "check",
  "close",
  "mic",
  "play-once",
  "timer",
  "word-count",
  "ai-estimate",
  "plan-calendar",
  "settings",
  "back-rtl",
] as const;

export type BdIconName = (typeof BD_ICON_NAMES)[number];

const NAV = new Set<BdIconName>(["nav-home", "nav-assistant", "nav-practice"]);
const HEADER_STATS = new Set<BdIconName>(["streak-flame", "daily-goal"]);

/** Nav 22px, header stats 16px, close 18px, everything else 24px. */
export function bdIconSize(name: BdIconName): number {
  if (NAV.has(name)) return 22;
  if (name === "close") return 18;
  if (HEADER_STATS.has(name)) return 16;
  return 24;
}

function artwork(name: BdIconName, active: boolean): string {
  const file = active && NAV.has(name) ? `${name}-active` : name;
  const svg = files[`./${file}.svg`];
  if (!svg) throw new Error(`Unknown Bandora icon: ${file}`);
  return svg;
}

export function BdIcon({
  name,
  active = false,
  size,
}: {
  name: BdIconName;
  active?: boolean;
  size?: number;
}) {
  const px = size ?? bdIconSize(name);
  const html = artwork(name, active)
    .replace(/\bwidth="24"/, `width="${px}"`)
    .replace(/\bheight="24"/, `height="${px}"`);
  const style: CSSProperties = { display: "inline-flex", width: px, height: px, lineHeight: 0 };
  return <span data-bd-icon={active && NAV.has(name) ? `${name}-active` : name} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
