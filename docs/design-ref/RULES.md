# Bandora panel rebuild — standing rules

This file is `docs/design-ref/RULES.md`. Do only the current step. Read only the files that step names. No full-project review, drive-by refactors, or extra features. There is no mockup PNG/HTML pack in the repo — follow the visual specs in each step.

Repo: `https://github.com/rahas3064-web/IELTS`, branch `bandora-panel-rebuild`. Stack: React 19, Vite 7, TypeScript, Express 4, raw `pg`, Vitest, Supabase Postgres. The panel already exists — rebuild it to match the approved specs; do not start from a blank app. Do not revive rejected looks (v6–v8, concepts, locked-home, p4/p5, learn-v1–v3).

Icons live in `components/features/bandora/panel/icons/` after step 01.

## After every step

Run the tests that step names. After **04**, **08**, and **10**, also run full `npm test` and `npm run typecheck`. Report in **≤10 lines** (files changed, tests, screenshots vs that step’s visual specs, blockers). Then **STOP**. Do not start the next step. Do not commit, push, or merge unless Raha explicitly approved that commit.

## Do not touch / do not leak

- **Landing is frozen** except already-approved Premium price text, auth modal, and eNamad. No landing colour, layout, or copy changes. Do not edit `components/features/bandora/landing-page.tsx`.
- Keep auth, OTP, billing and `plan_prices`, premium gating, assistant, and legal pages unless a step names a specific change.
- Secrets only in `.env` or host env. Never print keys. `AUTH_DEV_BYPASS` must never be true in production.
- Never deploy to the Liara app `rahaielts`. Never delete the Liara DB or `liara_archive`. Liara is DNS only.
- Never commit `UserDataNode.js`, `design-preview.html`, `docs/HANDOFF.md`, `docs/bandora-next-phase-prompt.md`, `docs/DEPLOY-SUPABASE-RAILWAY.md`, or `.cursor/**`.

## Official IELTS and content

Task 1 = 150 words / 20 minutes; Task 2 = 250 words / 40 minutes. Invent nothing about official timing or scoring. All questions, texts, and audio must be **original** — do not copy Cambridge or official IELTS samples (a text link to an official page is OK). Do not use official IELTS logos. Official free samples may not be copied, embedded, or republished in a commercial app without written Partner permission.

## UI (do not reopen)

RTL Persian, informal «تو», Persian digits (decimal ٫). Fonts: Vazirmatn body, Estedad display, Newsreader for English snippets, Playfair for the logo only. Tokens: bg `#F6F1E7`, surface `#FBF8F1`, ink `#1A2238`, navy `#1F2E54` (hover `#2C4073`), gold `#B08D4A` accents only (not primary button fills), gold-deep `#7A5C1E` for gold text, border `#D9CFBB`, body `#3F465C`, muted `#6B6757`, item `#EFE8D8`, wash `#F3EBD8`, select `#E4D3AC`, sage `#4E7B62` only for done/correct — **not** as small text on cream, sage-bg `#E7DFCD` / check-fill `#D5E0D8`, tint `#C9CEDC`, nav-inactive fill `#E8E2D4`, danger `#8C3B2F`, wrong-note bg `#F7F0EB` / `#E8D8CF`. Buttons `4px`, cards `6px`, hairline borders — not soft-rounded. Primary buttons navy. No XP. No live official band in headers (label scores تخمین or «نمره‌ی آخرین آزمون»). Honour `prefers-reduced-motion`. Do not build a fake phone status bar. Wrong-answer feedback is muted terracotta, not harsh danger-red body text.

## Product (do not reopen)

- Placement is skippable («فعلاً نه، برو به صفحه‌ی اصلی»). Home then shows «هنوز تعیین سطح ندادی».
- Skill order: Listening → Reading → Writing → Speaking.
- Bandora placement times (not official exam times): Full ~۵۵ min (12 / 16 / 15 / 12); Quick ~۲۰ min (5 / 6 / 5 / 4).
- Target band 5.0–9.0 in 0.5 steps; exam date or «هنوز نمی‌دانم».
- Result is an estimate. Overall = official average-and-round of four half-bands (.25 up to next half, .75 up to next whole).
- Study plan updates **only** when the learner taps «به‌روزرسانی برنامه‌ی من».
- Weekly default: ۳ درس، ۵–۱۰ دقیقه، ۵ روز. Chapters named by band step, e.g. «فصل ۱: از ۵٫۵ به ۶», mid-path «فصل ۲: از ۵ به ۵٫۵».
- Mocks: free half-mock every 7 Tehran days; premium full mock at most once per Tehran day. (Code today: free none, premium 4/month — step 04 changes this; do not change `plan_prices`.)
- Mobile bottom nav: خانه / دستیار / تمرین. Keep plan, mock, profile, subscription, notifications reachable (header / More).
- Demo fixtures only (not a live official score): Academic, target ۶٫۵, exam ۱۵ اسفند ۱۴۰۵, Full; estimate overall ۵٫۵ from L 6.0 / R 5.5 / W 5.0 / S 5.5.
- Example lesson (original): Writing · «ساختار پاراگراف», stages یاد بگیر / تمرین کن / به‌کار ببر / مرور.

## Existing paths (reuse)

- Routes: `src/routes.tsx` — `/`, login, `/app/onboarding`, `/app/placement/intro`, `/app` (`home-page.tsx`), `/app/placement`, `/app/practice`, `/app/assistant`, `/app/mock`, `/app/plan` (placeholder), `/app/subscription`, `/app/profile`.
- Tokens: `components/features/bandora/panel/tokens.css`, `base.css`, `panel.css`, `shell.css`. Panel fonts: `panel/ui/app-frame.tsx` (Vazirmatn, Estedad, Playfair; add Newsreader in step 01).
- Onboarding: `panel/onboarding/*`, `server/routes/onboarding.js` (today 3 steps, bands 5.5–8.5, habits required to complete).
- Placement: `panel/placement/placement-page.tsx`, `server/routes/placement.js`, `db/migrations/003_placement.sql`.
- Nav: `panel/shell/nav-items.ts`, `bottom-nav.tsx` (today dashboard / plan / practice).
- Guards: `src/auth/guards.tsx` — `/app/*` requires completed onboarding. Skip must still complete onboarding (step 02).
- Streak: `server/services/streak.js`. Tests: `npm test` (Vitest), `npm run typecheck`; siblings often `*.test.ts(x)` or `server/routes/*.test.js`.

## Step order (do not skip ahead)

01 tokens + icons → 02 placement intake + skip → 03 in-test L/R/W/S → 04 result + plan (full tests) → 05 home path + nav → 06 node sheets/locks → 07 lesson stages → 08 lesson complete / streak (full tests) → 09 motion → 10 final QA (full tests).
