// Learner registration: user row, optional referral attribution, session and audit
// row are committed together or not at all.
import { audit } from "../core/audit.js";
import { clientAddress } from "../rate-limit.js";
import { toPublicUser } from "./me-payload.js";

const REFERRAL_RE = /^[A-Z0-9]{5,12}$/;

/** @returns {Promise<string|null>} id of an active referral code, or null */
async function findReferralCodeId(tx, raw) {
  const code = raw.trim().toUpperCase();
  if (!REFERRAL_RE.test(code)) return null;
  const { rows } = await tx.query("select id from referral_codes where code = $1 and is_active", [code]);
  return rows[0]?.id ?? null;
}

/**
 * @param {ReturnType<import("../auth/context.js").createAuthContext>} ctx
 * @param {import("express").Request} req
 * @param {{phone: string, firstName: string, lastName: string, referralCode?: string}} input
 */
export async function registerLearner(ctx, req, { phone, firstName, lastName, referralCode }) {
  const at = ctx.now();
  const ip = clientAddress(req);
  return ctx.db.transaction(async (tx) => {
    const { rows } = await tx.query(
      `insert into users (phone, phone_verified_at, first_name, last_name)
       values ($1, $2, $3, $4)
       returning id, phone, first_name, last_name, email, role, locale, status, false as has_password`,
      [phone, at, firstName, lastName],
    );
    const row = rows[0];

    let referral = null;
    if (referralCode !== undefined && referralCode.trim() !== "") {
      const codeId = await findReferralCodeId(tx, referralCode);
      if (codeId) {
        await tx.query("insert into referral_attributions (code_id, referred_user_id) values ($1, $2)", [codeId, row.id]);
      }
      referral = { accepted: codeId !== null };
    }

    const started = await ctx.sessions.startIn(tx, {
      userId: row.id,
      kind: "learner",
      userAgent: req.get("user-agent"),
      ip,
      actorRole: row.role,
    });
    await audit(tx, {
      actorId: row.id,
      actorRole: row.role,
      action: "auth_register",
      targetType: "user",
      targetId: row.id,
      ipHash: ctx.ipHash(req),
      meta: { phone, referralAccepted: referral?.accepted ?? null },
    });
    return { user: toPublicUser(row), referral, started };
  });
}
