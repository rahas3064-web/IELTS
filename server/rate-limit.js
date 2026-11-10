export function clientAddress(req) {
  const trusted = Boolean(req.app?.get?.("trust proxy"));
  if (trusted) return String(req.ip || "unknown");
  return String(req.socket?.remoteAddress || "unknown");
}

export async function consumeLimit(db, bucket, limit, windowSeconds) {
  try {
    const result = await db.query(
      `insert into rate_limits (bucket, window_start, hits)
       values ($1, to_timestamp(floor(extract(epoch from now()) / $2::double precision) * $2::double precision), 1)
       on conflict (bucket, window_start) do update set hits = rate_limits.hits + 1
       returning hits`,
      [String(bucket).slice(0, 200), windowSeconds],
    );
    const hits = Number(result.rows[0]?.hits);
    if (!Number.isInteger(hits)) return { ok: false, unavailable: true };
    return { ok: hits <= limit, unavailable: false };
  } catch {
    return { ok: false, unavailable: true };
  }
}

export async function resetLimits(db) {
  if (db) await db.query("delete from rate_limits");
}
