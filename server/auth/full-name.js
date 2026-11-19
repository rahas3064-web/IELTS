/** Stored in last_name when the person typed a single word. The columns reject a blank. */
export const LAST_NAME_SENTINEL = "-";
const MAX_PART = 60;

/**
 * Split a full name on the first space.
 * One word: the word is first_name and last_name is the sentinel.
 * @param {unknown} raw
 * @returns {{firstName: string, lastName: string}|null}
 */
export function splitFullName(raw) {
  const name = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!name) return null;
  const space = name.indexOf(" ");
  const firstName = space === -1 ? name : name.slice(0, space);
  const lastName = space === -1 ? LAST_NAME_SENTINEL : name.slice(space + 1).trim();
  if (!firstName || !lastName || firstName.length > MAX_PART || lastName.length > MAX_PART) return null;
  return { firstName, lastName };
}

/** Show a one-word name once. The sentinel is not part of the person's name. */
export function displayName(firstName, lastName) {
  const first = String(firstName ?? "").trim();
  const last = String(lastName ?? "").trim();
  if (!last || last === LAST_NAME_SENTINEL) return first;
  return `${first} ${last}`.trim();
}
