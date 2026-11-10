// In-app notifications (spec S2): creation API for other modules plus the reads the
// bell/list need. The list is keyset-paginated over (created_at, id), newest first.
import { Buffer } from "node:buffer";
import { ApiError } from "../core/errors.js";
import { fieldError } from "../core/validate.js";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
const MAX_KIND = 40;
const MAX_TITLE = 120;
const MAX_BODY = 500;
const MAX_LINK = 200;

const KIND_RE = /^[a-z][a-z0-9_.-]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Microsecond precision matters: a JS Date (milliseconds) would make the cursor skip rows.
const CURSOR_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const CURSOR_TS_SQL = `to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

export const isUuid = (value) => typeof value === "string" && UUID_RE.test(value);

/** @param {string} label @param {unknown} value @param {number} max */
function requireText(label, value, max) {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw new TypeError(`notify: ${label} must be a non-empty string of at most ${max} characters`);
  }
}

/**
 * Create a notification for a learner. Validates every field (these strings reach the
 * UI); `link` must be an in-app path. Safe to call inside a caller's transaction.
 * @param {{query: Function}} db
 * @param {string} userId
 * @param {{kind: string, title: string, body: string, link?: string|null}} input
 * @returns {Promise<string>} the new notification id
 */
export async function notify(db, userId, { kind, title, body, link = null } = /** @type {any} */ ({})) {
  if (typeof userId !== "string" || userId === "") throw new TypeError("notify: userId is required");
  requireText("kind", kind, MAX_KIND);
  if (!KIND_RE.test(kind)) throw new TypeError("notify: kind must look like 'plan.ready'");
  requireText("title", title, MAX_TITLE);
  requireText("body", body, MAX_BODY);
  if (link !== null) {
    const internal = typeof link === "string" && link.startsWith("/") && !link.startsWith("//");
    if (!internal || link.length > MAX_LINK) throw new TypeError("notify: link must be an in-app path");
  }
  const { rows } = await db.query(
    "insert into notifications (user_id, kind, title, body, link) values ($1, $2, $3, $4, $5) returning id",
    [userId, kind, title, body, link],
  );
  return rows[0].id;
}

const invalidCursor = () =>
  new ApiError(400, "validation_failed", {
    details: { field: "cursor", fields: { cursor: fieldError("invalid_format") } },
  });

/** @param {{ts: string, id: string}} position @returns {string} base64url */
export const encodeCursor = ({ ts, id }) => Buffer.from(`${ts}|${id}`, "utf8").toString("base64url");

/** @param {string} cursor @returns {{ts: string, id: string}} @throws {ApiError} 400 */
export function decodeCursor(cursor) {
  const [ts, id, ...extra] = Buffer.from(String(cursor), "base64url").toString("utf8").split("|");
  if (extra.length > 0 || !CURSOR_TS_RE.test(ts ?? "") || !isUuid(id)) throw invalidCursor();
  return { ts, id };
}

const toItem = (row) => ({
  id: row.id,
  kind: row.kind,
  title: row.title,
  body: row.body,
  link: row.link ?? null,
  readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
  createdAt: new Date(row.created_at).toISOString(),
});

/** @param {{query: Function}} db @param {string} userId @returns {Promise<number>} */
export async function unreadCount(db, userId) {
  const { rows } = await db.query(
    "select count(*)::int as n from notifications where user_id = $1 and read_at is null",
    [userId],
  );
  return rows[0].n;
}

/**
 * @param {{query: Function}} db
 * @param {string} userId
 * @param {{cursor?: string|null, limit?: number}} [options] limit is already validated (1..MAX_PAGE_SIZE)
 */
export async function listNotifications(db, userId, { cursor = null, limit = DEFAULT_PAGE_SIZE } = {}) {
  const position = cursor ? decodeCursor(cursor) : null;
  const { rows } = await db.query(
    `select id, kind, title, body, link, read_at, created_at, ${CURSOR_TS_SQL} as cursor_ts
     from notifications
     where user_id = $1 ${position ? "and (created_at, id) < ($3::timestamptz, $4::uuid)" : ""}
     order by created_at desc, id desc
     limit $2`,
    position ? [userId, limit + 1, position.ts, position.id] : [userId, limit + 1],
  );
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last ? encodeCursor({ ts: last.cursor_ts, id: last.id }) : null;
  return { items: page.map(toItem), nextCursor, unreadCount: await unreadCount(db, userId) };
}

/**
 * Mark one of the learner's own notifications read (idempotent: the first read time stays).
 * @returns {Promise<boolean>} false when the id does not exist or belongs to someone else
 */
export async function markRead(db, userId, notificationId, at) {
  if (!isUuid(notificationId)) return false;
  const { rows } = await db.query(
    "update notifications set read_at = coalesce(read_at, $3) where id = $1 and user_id = $2 returning id",
    [notificationId, userId, at],
  );
  return rows.length > 0;
}

/** Mark every unread notification of the learner read. */
export async function markAllRead(db, userId, at) {
  await db.query("update notifications set read_at = $2 where user_id = $1 and read_at is null", [userId, at]);
}
