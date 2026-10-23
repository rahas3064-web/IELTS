import type { Role } from "@/lib/types";

export const ROLE_LABEL: Record<Role, { fa: string; en: string }> = {
  learner: { fa: "زبان‌آموز", en: "Learner" },
  content_manager: { fa: "مدیر محتوا", en: "Content manager" },
  system_admin: { fa: "مدیر سیستم", en: "System admin" },
  support_agent: { fa: "پشتیبان", en: "Support agent" },
};

const ALL_ADMIN = [
  "/admin",
  "/admin/analytics",
  "/admin/content",
  "/admin/users",
  "/admin/feedback",
  "/admin/experiments",
  "/admin/roadmap",
  "/admin/settings",
  "/admin/design-system",
];

export const ROLE_ROUTES: Record<Role, string[]> = {
  learner: [],
  content_manager: ["/admin", "/admin/content", "/admin/feedback"],
  support_agent: ["/admin", "/admin/feedback"],
  system_admin: ALL_ADMIN,
};

export function canOpen(role: Role, path: string) {
  if (!path.startsWith("/admin")) return true;
  return ROLE_ROUTES[role].some((route) => path === route || (route !== "/admin" && path.startsWith(route)));
}
