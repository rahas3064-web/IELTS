// Pure IELTS band helpers (Appendix A.4). Raw-score -> band tables live elsewhere.

/**
 * Round half-up to the nearest 0.5: x.25 -> x.5, x.75 -> next whole band,
 * x.125 -> x.0, x.625 -> x.5. The epsilon guards against float representation noise.
 * @param {number} value
 * @returns {number}
 */
export function roundHalf(value) {
  return Math.floor(value * 2 + 0.5 + 1e-9) / 2;
}

/**
 * Overall band = mean of the four skill bands, rounded to the nearest half band.
 * @param {ReadonlyArray<number|null|undefined>} skillBands exactly four finite numbers
 * @returns {number|null} null when the input is not four finite numbers
 */
export function overallBand(skillBands) {
  if (!Array.isArray(skillBands) || skillBands.length !== 4) return null;
  if (!skillBands.every((band) => typeof band === "number" && Number.isFinite(band))) return null;
  const mean = skillBands.reduce((sum, band) => sum + band, 0) / 4;
  return roundHalf(mean);
}
