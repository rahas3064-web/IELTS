# Bandora MVP scope

Status: 2026-11-05. The production MVP includes real model feedback. A working prototype screen is not, by itself, a finished MVP item.

Legend for current status: IMPLEMENTED, PARTIALLY IMPLEMENTED, SIMULATED, PLANNED, NOT IMPLEMENTED.

## A. Existing prototype

What a person can already do in this browser. Source of the labels: `lib/capabilities.ts` plus the routes and modules cited.

| Feature | Current status | Evidence | What a demo may claim |
| --- | --- | --- | --- |
| Landing, login, signup, forgot-password, plans | IMPLEMENTED as pages. Auth and payment SIMULATED | `src/routes.tsx`, `components/features/auth.tsx` | “This is a local demo account.” |
| Persian, English, RTL, theme, text size, reduced motion | IMPLEMENTED | `lib/capabilities.ts` | The interface is bilingual |
| Onboarding gate | IMPLEMENTED locally | `components/shell/app-shell.tsx` | The shell blocks the app until a goal exists |
| Four-skill placement and locked report | IMPLEMENTED | `components/features/placement.tsx` | The report waits for four skills |
| Unofficial band, range, readiness | IMPLEMENTED on the client | `lib/model.ts` | The math runs. It is not official |
| Writing and speaking heuristic, cap 7, pronunciation unscored | IMPLEMENTED and marked simulated inside the result | `assessWriting`, `assessSpeaking` | This is a rule of thumb, not a model |
| Dashboard gap, trend, next task | IMPLEMENTED | `components/features/home.tsx` | The next task is computed |
| NOVI dashboard welcome | IMPLEMENTED | `components/novi/dashboard-novi.tsx` | One sentence and one still |
| Editable plan and coverage | IMPLEMENTED | `taskEdits`, capability `plan` | Edits change coverage here |
| Practice, mocks, progress, archive | IMPLEMENTED on sample content | `components/features/study.tsx` | Items are educational |
| CSV of local history, print | IMPLEMENTED | `ReportsScreen` | The file is from this browser |
| In-app notices | IMPLEMENTED | capability `push` note | Nothing is emailed |
| Assistant | SIMULATED | `AssistantScreen`, `assistantReply` | It is not a language model |
| Listening audio and speech | SIMULATED | capability `audio` | Pronunciation is not scored |
| Plans comparison | SIMULATED | capability `pay` | There is no checkout |
| Admin and role switch | SIMULATED | `AdminGate` | The button is not real access control |
| Scenario lab | IMPLEMENTED | capability `lab` | Sample data, labeled when it is fictional |
| Health JSON | IMPLEMENTED | `GET /api/health` | `database: not_configured` unless `DATABASE_URL` is set. That flag does not prove a connection |
| PostgreSQL schema file | PLANNED artifact, not applied | `db/migrations/001_initial.sql` | Do not claim data is stored |
| NOVI on plan and placement report | NOT IMPLEMENTED | Only `home.tsx` mounts NOVI | Do not claim a product-wide companion |
| Model provider | NOT IMPLEMENTED | No SDK in `package.json` | Do not claim AI |

Tests that exist: `lib/model.test.ts`, `lib/novi.test.ts`, via `npm test`. No browser end-to-end script is defined.

## B. MVP production requirements

These must be real before the product is a usable MVP. Priority P0 is launch-blocking for that MVP. P1 can ship immediately after if the P0 path is honest.

| Feature | Current status | MVP priority | Required production behavior | Dependencies | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| Browser prototype remains runnable | IMPLEMENTED | P0 | `npm run dev` still serves the React app while backend work is unfinished | None | Existing model and NOVI unit tests pass |
| Product identity and disclaimer | IMPLEMENTED | P0 | Bandora, NOVI, unofficial-score wording on every band | `lib/brand.ts` | A report screen contains the disclaimer meaning and the word unofficial or its Persian equivalent |
| Server session | SIMULATED | P0 | Register, login, logout, httpOnly session, hashed password | PostgreSQL, Q-02 host, Q-03 email for reset | 401 without a session. Password absent from responses. PR-06 in `docs/PRODUCT_SPEC.md` |
| Profile and goal | IMPLEMENTED locally | P0 | Server profile matching onboarding fields | Session | Refresh on another browser with the same session shows the same goal |
| Placement attempt and four skills | IMPLEMENTED locally | P0 | Attempt, incremental answers, submit only when four skills are done | Session, existing scoring rules | Locked report until submit. Answers survive refresh |
| Unofficial scoring service | IMPLEMENTED on the client | P0 | Same rules as `lib/model.ts`, run on the server for stored attempts. Heuristic writing stays labeled heuristic | Placement rows | A fixture from `lib/model.test.ts` produces the same band on the server |
| Dashboard and next task | IMPLEMENTED locally | P0 | Built from server data through one view function, the same contract as `buildView` | Scoring, plan | Empty placement shows the empty state, not a zero band |
| Study plan edits | IMPLEMENTED locally | P0 | Server plan and tasks. Coverage updates. Version conflict returns 409 | Profile, scores | Two saves of a stale version do not silently overwrite |
| Sample practice and mocks | IMPLEMENTED locally | P0 | Attempts stored for the signed-in user. Content may stay the educational bank | Session | History shows the attempt after refresh |
| NOVI dashboard | IMPLEMENTED | P0 | Keep current rules | View model | Concerned still when a bottleneck exists. Sheet file is not the `src` |
| NOVI on dashboard, plan, and placement report only | Plan and report NOT IMPLEMENTED. Dashboard IMPLEMENTED | P0 | One still and one sentence, idle action. Present on `/dashboard`, `/plan`, and `/placement/report` even when the report is locked. Absent everywhere else, including `/reports` and timers | Dashboard component | Those three routes show one NOVI message. `/reports` and the timed routes show none |
| Writing model feedback | NOT IMPLEMENTED | P0 | Server use case AI-01. Preliminary estimate. Fallback | Q-01 provider, usage policy | Client bundle has no provider key. Failure still shows the plan |
| Typed speaking model feedback | NOT IMPLEMENTED | P0 | AI-02. No pronunciation score | Q-01 | The result says pronunciation was not assessed |
| Mistake explanation | NOT IMPLEMENTED | P0 | AI-03 after submit, must agree with the bank | Q-01, question items | On disagreement, the bank answer remains and the model text is hidden |
| Recommendation and assistant | SIMULATED assistant | P0 | AI-04 and AI-05 through the same model port. Template only as a labeled fallback | Q-01, stored plan | A guaranteed-score request is refused |
| Usage limits, validation, privacy | NOT IMPLEMENTED | P0 | Daily cap, max length, logs without essay text or keys, account delete removes turns | Provider | Over-cap does not call the provider |
| Persian, English, themes, motion | IMPLEMENTED | P0 | Preserved | None | Reduced motion stops NOVI animation |
| In-app notices and CSV | IMPLEMENTED locally | P1 | Notices from server events. CSV from server rows | Attempts | Export matches the signed-in user’s rows only |
| Password reset email | SIMULATED | P1 | One expiring message. Identical on-screen confirmation | Q-03 | No send when the local demo path is what is running |
| Account deletion | PARTIALLY IMPLEMENTED | P1 | Server cascade delete | Session | Subsequent login fails and study text is gone |
| Question versioning | PLANNED | P1 | A published edit does not change the item a past attempt stored | Content process | Old attempt still displays the old stem |
| Hide NOVI preference | NOT IMPLEMENTED | P1 | Profile switch. Default on | NOVI component | Off removes the figure. The next step remains in the page’s own text |
| Admin | SIMULATED | Release constraint | Not in the learner MVP. Before public release: server authorization and audit, or routes removed | Phase 5 | Production client has no `setRole("system_admin")` control |

## C. Post-MVP

Postpone these. They are not required to call the MVP usable.

| Feature | Why it waits |
| --- | --- |
| Card payment and subscriptions | The brief does not require payment. `/plans` stays a comparison |
| Official IELTS audio | Not required for the typed speaking estimate |
| Pronunciation scoring | The product currently refuses to invent one, and no audio pipeline exists |
| Push and marketing email | In-app notices are enough. Reset email is the exception, and it is P1 above |
| Full question-bank administration | The educational bank can ship if it stays labeled unofficial. Versioning is P1, a content studio is later |
| Multi-device conflict beyond the 409 plan rule | Basic session use is enough |
| NOVI on any page outside the three approved places | Extra figures compete with the task |
| Combined expression-action art, blink layers, ribbons | Files do not exist. Do not fake them |
| Extra UI languages | Persian and English are the product |
| Gamification | Not part of the problem statement |
| A separate public marketing site | The current landing is sufficient |
| Rewriting the React app | The current client already contains the learner paths |

## D. Release gate

The MVP is not public until:

1. Every P0 row in section B meets its acceptance criteria.
2. Admin is either server-enforced or absent.
3. A writing result cannot be confused with an official IELTS score.
4. Host, backups, and the provider ceiling in Q-01 and Q-02 are chosen. They are not chosen in this document.
