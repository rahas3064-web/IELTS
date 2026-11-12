// Role → permission map for /api/admin (spec S12). The server is the guard.

export const ADMIN_ROLES = Object.freeze(["super_admin", "content_manager", "reviewer", "support_agent"]);

export const PERMISSIONS = Object.freeze([
  "content.generate",
  "content.review",
  "content.manage",
  "users.read",
  "users.write",
  "finance.read",
  "finance.write",
  "sms.send",
  "admins.manage",
  "audit.read",
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
const ROLE_PERMISSIONS = Object.freeze({
  super_admin: PERMISSIONS,
  content_manager: Object.freeze(["content.generate", "content.manage"]),
  reviewer: Object.freeze(["content.review"]),
  support_agent: Object.freeze(["users.read", "finance.read"]),
});

/** @param {string} role @returns {readonly string[]} */
export function permissionsFor(role) {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** @param {string} role @param {string} permission */
export function hasPermission(role, permission) {
  return permissionsFor(role).includes(permission);
}

export const isAdminRole = (role) => ADMIN_ROLES.includes(role);
