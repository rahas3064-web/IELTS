// Objective answer matching only. This module never estimates a band: converting a
// raw score to a band uses the official tables in server/core/band.js (Rule A).

const TRAILING_PUNCTUATION = /[\s.,;:!?]+$/u;

/**
 * Case-insensitive, whitespace-collapsed, trailing-punctuation-stripped form.
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAnswer(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/gu, " ")
    .trim()
    .replace(TRAILING_PUNCTUATION, "");
}

/**
 * @param {unknown} answer
 * @param {ReadonlyArray<unknown>} acceptedVariants
 * @returns {boolean} false for an empty answer
 */
export function matchesAccepted(answer, acceptedVariants) {
  const given = normalizeAnswer(answer);
  if (given === "") return false;
  return acceptedVariants.some((variant) => normalizeAnswer(variant) === given);
}

/** @param {unknown} key @param {string} id */
function assertKey(key, id) {
  const correct = key?.correct;
  const validSingle = typeof correct === "string" && normalizeAnswer(correct) !== "";
  const validMulti = Array.isArray(correct) && correct.length > 0
    && correct.every((entry) => typeof entry === "string" && normalizeAnswer(entry) !== "");
  if (!validSingle && !validMulti) {
    throw new TypeError(`scoreObjective: item ${id} has an invalid answer_key.correct`);
  }
  if (key.accepted !== undefined && !(Array.isArray(key.accepted) && key.accepted.every((entry) => typeof entry === "string"))) {
    throw new TypeError(`scoreObjective: item ${id} has an invalid answer_key.accepted`);
  }
}

/** @param {unknown} answer */
function isAnswered(answer) {
  if (Array.isArray(answer)) return answer.some((entry) => normalizeAnswer(entry) !== "");
  return normalizeAnswer(answer) !== "";
}

/**
 * @param {ReadonlyArray<string>} correct
 * @param {unknown} answer
 */
function multiMatches(correct, answer) {
  if (!Array.isArray(answer)) return false;
  const given = new Set(answer.map(normalizeAnswer).filter((entry) => entry !== ""));
  const expected = new Set(correct.map(normalizeAnswer));
  return given.size === expected.size && [...expected].every((entry) => given.has(entry));
}

/**
 * Score objective items. `correct` as an array means multi-select (set equality,
 * no partial credit); a string means a single choice or a gap-fill, where
 * `accepted` lists extra accepted variants.
 * @param {ReadonlyArray<{id: string, answer_key: {correct: string|string[], accepted?: string[]}}>} items
 * @param {Record<string, unknown>} answers keyed by item id
 * @returns {{raw: number, max: number, perItem: Array<{id: string, answered: boolean, correct: boolean}>}}
 */
export function scoreObjective(items, answers) {
  const perItem = items.map((item) => {
    assertKey(item.answer_key, item.id);
    const { correct, accepted = [] } = item.answer_key;
    const answer = answers?.[item.id];
    const isCorrect = Array.isArray(correct)
      ? multiMatches(correct, answer)
      : typeof answer !== "object" && matchesAccepted(answer, [correct, ...accepted]);
    return { id: item.id, answered: isAnswered(answer), correct: isCorrect };
  });
  return {
    raw: perItem.filter((entry) => entry.correct).length,
    max: items.length,
    perItem,
  };
}
