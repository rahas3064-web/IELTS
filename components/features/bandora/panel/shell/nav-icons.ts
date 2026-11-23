import type { BdIconName } from "@/components/features/bandora/panel/icons/bd-icon";
import type { NavId } from "@/components/features/bandora/panel/shell/nav-items";

/** Bandora SVGs for every nav id. The three tabs use the nav-* art, including -active. */
export const NAV_ICONS: Record<NavId, BdIconName> = {
  dashboard: "nav-home",
  assistant: "nav-assistant",
  practice: "nav-practice",
  plan: "plan-calendar",
  mock: "node-challenge",
  progress: "daily-goal",
  feedback: "skill-writing",
  profile: "settings",
  subscription: "premium-crown",
};
