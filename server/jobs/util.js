/** Jobs receive either a clock function (job runner) or a fixed Date (tests, one-off runs). */
export function resolveNow(now) {
  const value = typeof now === "function" ? now() : now;
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new TypeError("now must be a valid Date or a function returning one");
  return value;
}
