export type NavId =
  | "dashboard"
  | "plan"
  | "practice"
  | "mock"
  | "progress"
  | "feedback"
  | "assistant"
  | "profile"
  | "subscription";

export type NavItem = {
  id: NavId;
  href: string;
  /** Dictionary key for the sidebar / header title. */
  labelKey: string;
  /** Shorter dictionary key for the mobile bottom bar, when one exists. */
  shortKey?: string;
};

const item = (id: NavId, href: string, shortKey?: string): NavItem => ({ id, href, labelKey: `nav.${id}`, shortKey });

const dashboard = item("dashboard", "/app");
const plan = item("plan", "/app/plan", "nav.plan.short");
const practice = item("practice", "/app/practice");
const mock = item("mock", "/app/mock");
const progress = item("progress", "/app/progress");
const feedback = item("feedback", "/app/feedback");
const assistant = item("assistant", "/app/assistant");
const profile = item("profile", "/app/profile");
const subscription = item("subscription", "/app/subscription");

export type NavGroup = { id: "main" | "analysis"; labelKey: string; items: readonly NavItem[] };

// Placement is deliberately absent: it is reached from the dashboard card.
export const SIDEBAR_GROUPS: readonly NavGroup[] = [
  { id: "main", labelKey: "nav.group.main", items: [dashboard, plan, practice, mock] },
  { id: "analysis", labelKey: "nav.group.analysis", items: [progress, feedback, assistant] },
];

export const SIDEBAR_BOTTOM: readonly NavItem[] = [profile, subscription];

export const NAV_ITEMS: readonly NavItem[] = [...SIDEBAR_GROUPS.flatMap((group) => group.items), ...SIDEBAR_BOTTOM];

/** Three shortcuts; the fourth bottom-bar slot is the "More" button. */
export const BOTTOM_NAV_ITEMS: readonly NavItem[] = [dashboard, plan, practice];

const SHORTCUT_IDS = new Set(BOTTOM_NAV_ITEMS.map((entry) => entry.id));

export const MORE_ITEMS: readonly NavItem[] = NAV_ITEMS.filter((entry) => !SHORTCUT_IDS.has(entry.id));

export function isNavActive(pathname: string, href: string): boolean {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (href === "/app") return path === "/app";
  return path === href || path.startsWith(`${href}/`);
}

export function pageTitleKey(pathname: string): string {
  if (isNavActive(pathname, "/app/notifications")) return "nav.notifications";
  const match = NAV_ITEMS.find((entry) => isNavActive(pathname, entry.href));
  return match ? match.labelKey : "app.name";
}
