import copy from "./copy.json";

export const RING = 138.2;
export const CHECK_PATH = "M20 6L9 17l-5-5";

const TRUST_PATHS = [
  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M12 12h.01",
  "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15",
  "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z M8 9h8 M8 13h5",
];

export const CTA = {
  signup: "/signup",
  login: "/login",
  philosophy: "#philosophy",
  how: "#how-it-works",
  pricing: "#pricing",
} as const;

export const NAV = copy.nav;
export const FAQ = copy.faqRows;
export const TRUST = copy.trustRows;
export const STEPS = copy.steps;
export const FREE_FEATURES = copy.free;
export const PREMIUM_FEATURES = copy.premium;

export const HERO = {
  kicker: "IELTS Preparation, in one place",
  title: copy.heroTitle,
  body: copy.heroBody,
};

export const PHILOSOPHY = {
  kicker: "Our Philosophy",
  title: copy.philosophyTitle,
  body: copy.philosophyBody,
};

export const FEATURES_HEAD = {
  kicker: "Core Features",
  title: copy.featuresTitle,
};

export const HOW_HEAD = {
  kicker: "How It Works",
  title: copy.howTitle,
};

export const PRICING_HEAD = {
  kicker: "Pricing",
  title: copy.pricingTitle,
};

export const FAQ_HEAD = {
  kicker: "FAQ",
  title: "سؤالات متداول",
};

export const FINAL_CTA = copy.finalTitle;
export const FOOTER_TAG = "آمادگی آیلتس، با یک مسیر مشخص و هدفمند.";
export const AI_FEEDBACK = copy.ai;

export function toFa(value: number | string): string {
  return String(value).replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit);
}

export function skillDash(percent: number): string {
  return ((percent / 100) * RING).toFixed(1) + " 138.2";
}

const SKILL_ROWS = [
  ["Listening", 6.5, 72],
  ["Reading", 6.0, 64],
  ["Writing", 5.5, 52],
  ["Speaking", 5.5, 48],
] as const;

export const SKILLS = SKILL_ROWS.map(([name, band, percent]) => ({
  name,
  band: band.toFixed(1),
  dash: skillDash(percent),
}));

export const FEATURES = copy.features.map((feature) => ({
  n: toFa(feature.n),
  en: feature.en,
  title: feature.title,
  desc: feature.desc,
  d: feature.d,
}));

export const TASKS = copy.tasks.map((task) => ({
  label: task.label,
  bc: task.done ? "#4E7B62" : "#CBBF9F",
  bg: task.done ? "#4E7B62" : "transparent",
  ic: task.done ? "#fff" : "transparent",
  fg: task.done ? "#6B6757" : "#1A2238",
  td: task.done ? "line-through" : "none",
}));

export type Lang = "FA" | "EN";

export function langColors(lang: Lang) {
  const fa = lang === "FA";
  return {
    faBg: fa ? "#1F2E54" : "transparent",
    faFg: fa ? "#F6F1E7" : "#1A2238",
    enBg: fa ? "transparent" : "#1F2E54",
    enFg: fa ? "#1A2238" : "#F6F1E7",
  };
}

export function menuIcon(open: boolean): string {
  return open ? "M18 6L6 18M6 6l12 12" : "M4 6h16M4 12h16M4 18h16";
}

export function trustViews(mobile: boolean) {
  return TRUST.map((item, index) => ({
    title: item.title,
    desc: item.desc,
    d: TRUST_PATHS[index] ?? "",
    bt: mobile && index ? "1px solid #D9CFBB" : "0",
    bs: !mobile && index ? "1px solid #D9CFBB" : "0",
  }));
}

export type Timeline = {
  fill: number[];
  active: boolean[];
};

export function timelineFromCenters(centers: number[], cy: number): Timeline {
  const fill = centers.map((value, index) => {
    if (index >= centers.length - 1) return 0;
    const next = centers[index + 1] ?? value;
    return Math.max(0, Math.min(1, (cy - value) / (next - value)));
  });
  return { fill, active: centers.map((value) => cy >= value) };
}

export function timelineKey(timeline: Timeline): string {
  return timeline.fill.map((value) => value.toFixed(3)).join() + timeline.active.join();
}

export function stepViews(timeline: Timeline | null) {
  return STEPS.map((step, index, all) => {
    const on = timeline ? Boolean(timeline.active[index]) : index === 0;
    const amount = timeline ? timeline.fill[index] ?? 0 : 0;
    const connected = index < all.length - 1;
    return {
      n: toFa(index + 1),
      en: step.en,
      title: step.title,
      desc: step.desc,
      pb: connected ? "44px" : "0",
      line: connected ? "#E1D8C2" : "transparent",
      fill: (amount * 100).toFixed(1) + "%",
      bg: on ? "#B08D4A" : "#F6F1E7",
      fg: on ? "#1A2238" : "#7A5C1E",
      sc: on ? "scale(1)" : "scale(.88)",
      op: on ? 1 : 0.5,
    };
  });
}

export function nextFaq(open: number, index: number): number {
  return open === index ? -1 : index;
}

export function faqView(open: number) {
  return FAQ.map((item, index) => {
    const isOpen = open === index;
    return {
      q: item.q,
      a: item.a,
      open: isOpen,
      rot: isOpen ? "rotate(180deg)" : "none",
      rows: isOpen ? "1fr" : "0fr",
    };
  });
}

export function isMobileWidth(width: number): boolean {
  return width < 900;
}
