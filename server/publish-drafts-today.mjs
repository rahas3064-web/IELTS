/* global console, process */
// One-off, local: publish the original drafts marked bandora-draft-2026-11-12 (approved by
// the owner for the local demo). Goes through the content bank: items first, then each
// practice set, then the placement version; the bank's integrity checks still apply.
// Publishes nothing else. Safe to run again. Prints counts only.
// Usage (server stopped, PGlite allows one process): node server/publish-drafts-today.mjs
import { loadDotEnv } from "./env-file.js";
import { openDb } from "./db.js";
import { createContentBank } from "./services/content-bank.js";

const MARK = "bandora-draft-2026-11-12";

loadDotEnv();
const db = await openDb({ databaseUrl: process.env.DATABASE_URL, env: process.env });
try {
  const bank = createContentBank(db);
  // Reviewer of record: the existing super_admin if there is one, otherwise the operator CLI.
  const admin = await db.query("select id, role from users where role = 'super_admin' and status = 'active' order by created_at limit 1");
  const reviewer = admin.rows[0] ?? { id: null, role: "cli" };

  const items = await db.query(
    "select id from content_items where explanation_en = $1 and status = 'in_review' and not is_dev_fixture order by created_at",
    [MARK],
  );
  let itemsPublished = 0;
  for (const { id } of items.rows) {
    if (await bank.decide(reviewer, id, "approved")) itemsPublished += 1;
  }

  const sets = await db.query(
    `select distinct s.id, s.created_at from practice_sets s
     join practice_set_items psi on psi.set_id = s.id
     join content_items i on i.id = psi.item_id
     where i.explanation_en = $1 and s.status = 'in_review' and not s.is_dev_fixture
     order by s.created_at`,
    [MARK],
  );
  let setsPublished = 0;
  for (const { id } of sets.rows) {
    await bank.approvePracticeSet(reviewer, id);
    setsPublished += 1;
  }

  const versions = await db.query(
    `select distinct v.id, v.created_at from placement_versions v
     join placement_sections s on s.version_id = v.id
     join placement_section_items psi on psi.section_id = s.id
     join content_items i on i.id = psi.item_id
     where i.explanation_en = $1 and v.status = 'in_review' and not v.is_dev_fixture
     order by v.created_at`,
    [MARK],
  );
  let versionsPublished = 0;
  for (const { id } of versions.rows) {
    await bank.approvePlacementVersion(reviewer, id);
    versionsPublished += 1;
  }

  const totals = await db.query(
    `select
       (select count(*)::int from content_items where explanation_en = $1 and status = 'published') as items,
       (select count(*)::int from content_items where explanation_en = $1 and status <> 'published') as items_unpublished,
       (select count(distinct s.id)::int from practice_sets s join practice_set_items psi on psi.set_id = s.id
          join content_items i on i.id = psi.item_id where i.explanation_en = $1 and s.status = 'published') as sets,
       (select count(distinct v.id)::int from placement_versions v join placement_sections s on s.version_id = v.id
          join placement_section_items psi on psi.section_id = s.id join content_items i on i.id = psi.item_id
          where i.explanation_en = $1 and v.status = 'published') as versions`,
    [MARK],
  );
  console.log(JSON.stringify({
    reviewer: reviewer.id ? "super_admin" : "cli",
    publishedNow: { items: itemsPublished, sets: setsPublished, placementVersions: versionsPublished },
    publishedTotal: totals.rows[0],
  }));
} finally {
  await db.close();
}
