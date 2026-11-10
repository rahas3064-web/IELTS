# Bandora Panel Rebuild: Master Plan

> **For agentic workers:** execute one phase at a time with `subagent-driven-development` or `executing-plans`. Write the task-level plan for a phase (via `writing-plans`) just before starting it, not all up front. Steps use checkbox syntax.

**Goal:** Rebuild the learner panel (`/app`) and admin panel (`/admin`) as specified in `C:\Users\mjh\Downloads\bandora-cursor-prompt.md`, with the landing page left unchanged.

**Architecture:** Keep the stack (React 19, Vite 7, react-router 7, Tailwind 4, Express 4, Postgres/PGlite). Clean-slate migrations. Server is the source of truth. Content flows AI draft, then teacher review, then publish. Learner APIs return only published content.

**Spec:** `C:\Users\mjh\Downloads\bandora-cursor-prompt.md` (the "Spec"; it wins over this plan).

## Global Constraints

- RULE A: official IELTS format and scoring only. No heuristic scores. No hard-coded or seeded learner questions.
- RULE B: content statuses `draft`, `in_review`, `published`, `rejected`. Filter `status='published'` in SQL.
- RULE C: no `localStorage` or `sessionStorage` for app state, including locale.
- RULE D: no secrets, template ids or phone numbers in code. Mask phones in logs.
- RULE E: all day boundaries use `Asia/Tehran`. Week starts Saturday.
- RULE F: tokens come from the landing code. The landing files in `components/features/bandora/*` (except `panel/`) stay byte-identical. Only a link target may change.
- Tokens: bg `#F6F1E7`, surface `#FBF8F1`, ink `#1A2238`, navy `#1F2E54`, gold `#B08D4A`, gold-deep `#7A5C1E`, border `#D9CFBB`, border-soft `#E1D8C2`, green `#4E7B62`, green-bg `#E7DFCD`. Radius 4 to 6px, 1px borders.
- Every `[DEFAULT — adjustable]` item is implemented as written, kept configurable, and listed in the final summary.
- Workspace rules: TDD (RED then GREEN), 80%+ coverage on new code, files under 800 lines, immutable updates.

## Skills used (from `claude-skills-share.zip`)

All 97 skills in the zip are already installed in `.cursor/skills/` (verified by name). None needed copying. Mapping:

| Need | Skill |
|---|---|
| Plan and execute | `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents` |
| Per-task discipline | `test-driven-development`, `tdd-workflow`, `verification-before-completion`, `systematic-debugging` |
| Backend and frontend patterns | `backend-patterns`, `frontend-patterns`, `coding-standards` |
| UX flows (onboarding, OTP, runners) | `ux-flow-designer`, `persian-rtl-ui`, `rtl-farsi` |
| Security (auth, payment, admin) | `security-review`, `owasp-top-10-testing`, `api-security-testing`, `web-app-penetration-testing` |
| AI scoring quality | `eval-harness` |
| Review and finish | `requesting-code-review`, `receiving-code-review`, `finishing-a-development-branch`, `using-git-worktrees` |

Deliberately **not** applied: `taste-skill*`, `redesign-skill`, `brutalist-skill`, `minimalist-skill`, `soft-skill`, `impeccable`, `stitch-skill`, `imagegen-frontend-*`. They push a new visual style, which RULE F forbids. `brandkit` is used only to read the existing landing tokens, not to define new ones.

## Findings that change the plan

1. **Uncommitted work.** The tree has many modified and untracked files, including `components/novi/*`, `components/features/billing.tsx` and the current `panel/*`. Phase 0 deletes some of them. A snapshot commit or branch is needed first.
2. **Single-session index vs admin session.** `sessions_one_active on sessions(user_id) where revoked_at is null` would stop an admin from holding a learner session and an admin session. Add `kind text check (kind in ('learner','admin'))` and make the index `(user_id, kind)`.
3. **`citext`.** PGlite needs the citext extension loaded explicitly. Use `text` with `unique (lower(email))` instead. Same behavior on both engines.
4. **No questions exist until teachers publish some.** Placement, practice and mocks stay empty in dev until Phase 2 works with a valid `AVALAI_API_KEY`. `db:seed:dev` fixtures (flagged `is_dev_fixture`, blocked in production) cover local testing only.
5. **Audio storage.** Liara's disk is ephemeral. Production needs S3-compatible storage (`STORAGE_*`). Dev uses a local folder.
6. **Estedad font.** The landing names `Estedad` first, but nothing loads it (only Vazirmatn from Google Fonts). Rule F says match the landing, so panel uses the same stack and the same loading. Say so if you want Estedad actually bundled, since that would change the landing look.
7. **Unverified external facts** (to confirm before launch, as the Spec already says): AvalAI support for `whisper-1` with `timestamp_granularities[]=word`; Bale `inquireTransaction`, invoice-link and refund method names; SMS.ir template parameter names; official band tables (A.3 matches the commonly published values; re-verify against ielts.org).
8. **New dependencies** (to approve): `zod`, `node-cron`, `multer` (or `busboy`), `@aws-sdk/client-s3`, `recharts` (or hand-rolled SVG), a Jalali date library (`jalaali-js`). `openai` SDK is optional because the existing `fetch` wrapper can be extended.

## Phases

Each phase ends with: its section acceptance lists ticked, `npm run typecheck`, `npm run lint`, `npm test` green, a code review pass, and a ledger line.

### Phase 0: Cleanup and foundation
- [ ] Snapshot current tree (commit on a safety branch) and create `bandora-panel-rebuild` branch.
- [ ] Delete old routes, shell, feature screens, `components/novi/*`, old `lib/*`, `signup.json`, hard-coded banks, heuristic scoring (Spec §2.1). Check imports first. Keep what the landing needs.
- [ ] Replace `db/migrations/001-007` with a clean ordered set; `db:seed` (reference data only); `db:seed:dev` (flagged fixtures, refuses in production).
- [ ] Foundation modules, each with tests first: `tehranDay` and Saturday-week helper, env validation, error envelope, `audit()` helper, rate limiter extension, job runner with advisory lock and `job_runs`, i18n dictionaries and RTL provider (server-backed locale), design tokens in `panel.css` read from landing values.
- Verify: fresh migrate on Postgres and PGlite; `rg localStorage` clean; `git diff` shows landing files unchanged.

### Phase 1: S1 account and S2 panel frame
- OTP request/verify/register, hashed codes (HMAC with `OTP_PEPPER`), 60 s resend, 5 wrong then 15 min lock, SMS.ir adapter with dev console fallback.
- Sessions with replacement and `session_replaced`, optional email and password, 3-step onboarding, `admin:bootstrap` CLI replacing `provision-admin.js`.
- `AppShell` (sidebar, 4-item bottom nav, header, bell, streak, countdown, assistant button), notifications API, streak service, `study-reminders` job.

### Phase 2: Content pipeline (S12 core)
- Roles and `requirePermission`, admin login (OTP plus second password), content data model, AI generation with schema validation, review queue with learner-view preview, content bank, media upload, audit viewer.

### Phase 3: S3 placement, S7 scoring engine, Whisper
- Placement attempts and 15-day retake rule, once-only audio, `SpeakingRecorder`, `band_descriptors`, `score.js` with versioned prompts and schema validation, speaking fluency metrics.
- Use `eval-harness` for scoring consistency checks.

### Phase 4: S6 practice, S5 plan, S4 dashboard
- Shared `QuestionRenderer`, `completeAttempt()` transaction, server-side `buildPlan`, weekly job, `/api/dashboard`.

### Phase 5: S8 progress, S9 mock
- Band snapshots, honest forecast, heatmap, full-screen `ExamLayout`, server-driven section transitions, resume with remaining time.

### Phase 6: S11 subscription and Bale, S10 profile
- Quota service (reserve/commit/release), provider adapter, Bale test-mode flow with verification before activation, invoices, reminders, account export and deletion with 14-day undo.

### Phase 7: remaining admin, assistant, hardening
- Users, finance, messaging, dashboard metrics, assistant, jobs hardening, accessibility pass, security pass (`security-review`, `owasp-top-10-testing`), Liara deploy check.

## Review Focus

- Day-boundary bugs around 20:30 to 24:00 UTC and Friday to Saturday (Tehran).
- Two devices logging in at the same moment (one active session must survive).
- Duplicate payment webhooks and a webhook arriving before `successful_payment` is stored.
- AI returns invalid JSON, an out-of-range band, or times out (quota must be released, no score shown).
- A learner requesting an unpublished item id directly, or answer keys before submission.
- Audio reload mid-listening (must resume without replay).
- Persian digits and `+98`/`0098` phone forms in every phone and number input.

## Execution ledger

Create `.superpowers/sdd/2026-11-10-bandora-panel-rebuild/progress.md` when execution starts. First line: `# SDD ledger — plan: docs/superpowers/plans/2026-11-10-bandora-panel-rebuild.md`.
