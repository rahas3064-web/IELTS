# Phase 0 impact map (read-only analysis, 2026-11-10)

Source: import-graph analysis of the tree at the start of the rebuild. Re-run the checks (typecheck, vitest, `vite build`) after each deletion step, because string-based reads do not show up in TypeScript.

## Blockers that must be fixed before deleting

| Delete candidate | Blocking importer | Fix |
|---|---|---|
| `lib/store.tsx` | `components/providers.tsx` (loaded by `src/main.tsx`) | Remove `StoreProvider` from providers |
| `lib/questions.ts`, `lib/scenarios.ts` | `lib/model.ts` | Reduce `lib/model.ts` to `overallBand` (panel `model.ts` imports it) or move it into the panel |
| `lib/novi-behavior.ts` | `lib/types.ts` (`NoviPrefs`) | Remove `NoviPrefs` |
| `components/product/lead-action.tsx` | `components/shell/public-header.tsx` | Delete `public-header.tsx` together with the old `/plans` page, or rebuild it in Phase 1 |
| `lib/signals.ts` | `components/product/bits.tsx` | Delete `bits.tsx` (orphaned too) |
| `server/bank.js` | `server.js` (lines 74-76), `api.js` (line 113, runs at boot), `score-attempt.js` | Remove from `api.js` and `server.js` first. `bank.js` reads `lib/questions.ts` as text, so typecheck will not catch this |
| `server/score-attempt.js` | `api.js` (lines 342, 421) | Remove routes `/api/placement`, `/api/mocks/:id` |
| `features/landing.tsx` | `src/routes.tsx` | Import `bandora/landing-page` directly |

Other facts:
- `panel/learner.tsx` imports `server/learner.js` from client code. Both go away or move in the rewrite.
- `design-tokens.test.ts` reads `app/globals.css` and `src/main.tsx` as text.
- Landing CTAs point to `/signup` and `/login` (`content.ts`, asserted in `content.test.ts`). They 404 until Phase 1 builds `/login`. Spec: `/signup` redirects to `/login`. Landing files stay unchanged, so no edit is needed.
- `/app/placement` currently does `Navigate to="/placement"`, which is deleted.

## Needed by the landing page (keep)

`src/main.tsx`, `src/error-boundary.tsx`, `src/routes.tsx`, `app/globals.css`, `components/providers.tsx` (minus store), `components/ui/tooltip.tsx`, `components/ui/sonner.tsx`, `components/link.tsx`, `components/features/bandora/*` (all landing files), `@fontsource` packages, `vite.config.ts`, `vitest.config.ts`, `index.html`. The landing itself imports nothing from `lib/*`.

## Orphaned after deletion (suggested extra deletions)

`lib/api.ts`, `access.ts`, `delivery.ts`, `capabilities.ts`, `navigation.ts`, `plan-templates.ts`, `format.ts`, `types.ts`, `brand.ts`, `utils.ts`, `model.ts` (keep `overallBand` only), `components/ui/*` except tooltip and sonner, `public/assets/novi/*`, `.novi*` rules in `app/globals.css` (lines about 198-360), `server/classify.js`, `three`, `@types/three`, `@base-ui/react`, `class-variance-authority`. Keep `lucide-react`.

## Server references to rewrite with the new migrations

- `migrate.js`: `PRESERVED` list and hard-coded `MIGRATIONS` 001-007. `server.js` 70-92 aborts on preserved-row drift, which is wrong for a fresh schema.
- `api.js`: `display_name` (53, 65, 187-189, 210), `learner_sheets` (141, 155), `profiles.payload` and `placement_attempts.summary` (240-373, 407-455), `bank`/`score-attempt`/`classify` use.
- `admin.js`: `system_admin` role (6, 88-95), `admin_audit_logs` (16, 251), `display_name` (39-57).
- `authz.js`: `PRIVILEGED = {"system_admin"}`, `admin_audit_logs` insert.
- `billing-db.js`: `admin_audit_logs` (214, 233). The billing, quota, referral and credit logic itself is kept and cleaned.
- `provision-admin.js`: replace with the bootstrap CLI (Spec S1).
- Tests to rewrite or remove: `security`, `recovery`, `subscription-db`, `migrate`, `score-attempt`, `bank`, `classify`, `objective`. Two of them (`recovery`, `subscription-db`) already fail at baseline because of the old migration chain.

## localStorage / sessionStorage

`lib/store.tsx` (deleted with the store), `components/novi/homepage-novi.tsx` (deleted with novi), `components/features/bandora/panel/locale.tsx` (must be rewritten to use `users.locale`).

## Safe order

1. Fix shared roots: rewrite `src/routes.tsx`, strip the store from providers, trim `types.ts` and `model.ts`.
2. Delete old features and shell.
3. Delete novi, lead-action, public-header, product bits.
4. Delete the lib tests, then the lib modules.
5. Server: strip `bank`/`score-attempt`/`classify` from `api.js` and `server.js`, then delete those files and trim `objective.js`.
6. Rewrite migrations, `migrate.js`, seeds.
7. Delete `signup.json`, novi assets and CSS, unused packages.
8. Run typecheck, tests and build after every step.
