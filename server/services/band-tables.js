// Official-style raw (out of 40) to band. Ranges do not overlap.
export const BAND_RANGES = Object.freeze({
  listening: [
    [0, 1, 1], [2, 3, 2], [4, 5, 2.5], [6, 7, 3], [8, 10, 3.5], [11, 12, 4],
    [13, 15, 4.5], [16, 17, 5], [18, 22, 5.5], [23, 25, 6], [26, 29, 6.5],
    [30, 31, 7], [32, 34, 7.5], [35, 36, 8], [37, 38, 8.5], [39, 40, 9],
  ],
  reading_academic: [
    [0, 1, 1], [2, 3, 2], [4, 5, 2.5], [6, 7, 3], [8, 9, 3.5], [10, 12, 4],
    [13, 14, 4.5], [15, 18, 5], [19, 22, 5.5], [23, 26, 6], [27, 29, 6.5],
    [30, 32, 7], [33, 34, 7.5], [35, 36, 8], [37, 38, 8.5], [39, 40, 9],
  ],
});

export const BAND_TABLE_VERSION = "public-range-1";

/** Scale a short placement/practice paper onto the 40-point table. */
export function scaleRaw(correct, total) {
  if (!total || total < 1) return 0;
  return Math.max(0, Math.min(40, Math.round((correct / total) * 40)));
}

export function bandForRaw(ranges, raw) {
  const hit = ranges.find(([min, max]) => raw >= min && raw <= max);
  return hit ? hit[2] : null;
}

export async function ensureBandTables(db) {
  const existing = await db.query("select 1 from band_conversion_tables where version = $1 limit 1", [BAND_TABLE_VERSION]);
  if (existing.rows.length) return;
  for (const [skill, ranges] of Object.entries(BAND_RANGES)) {
    for (const [rawMin, rawMax, band] of ranges) {
      await db.query(
        `insert into band_conversion_tables (skill, raw_min, raw_max, band, source, version)
         values ($1, $2, $3, $4, $5, $6)`,
        [skill, rawMin, rawMax, band, "Public raw-score ranges used as an estimate, not a live test form.", BAND_TABLE_VERSION],
      );
    }
  }
}

export async function lookupBand(db, skill, raw) {
  const key = skill === "reading" ? "reading_academic" : skill;
  const { rows } = await db.query(
    `select band from band_conversion_tables
     where skill = $1 and version = $2 and raw_min <= $3 and raw_max >= $3
     limit 1`,
    [key, BAND_TABLE_VERSION, raw],
  );
  return rows[0] ? Number(rows[0].band) : null;
}
