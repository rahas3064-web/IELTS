# Bandora UX architecture

Status: 2026-11-05. Page behavior below is what the code does now, then the production rule where it differs. Do not add pages to make the diagram symmetrical. The routes in `src/routes.tsx` are the map.

Visual source of truth: `docs/design-system.md` and `app/globals.css`. This file adds rules. It does not replace the token list.

## 1. Experience principles

- One primary action per screen. The primary action is the next study step, not a decoration.
- The unofficial label is part of the score, not a footnote that can be dropped.
- Persian is RTL. English is LTR. Exam passages stay LTR inside an RTL page.
- Light theme is the default. Dark theme uses the same components.
- Motion is optional. Reduced motion removes float, glow animation, and entrance travel. The sentence remains.
- NOVI speaks in three places only: dashboard, study plan, placement report. Timed work is silent.
- Loading, empty, error, and success are different. An empty plan is not an error.

## 2. Visual rules

| Topic | Rule |
| --- | --- |
| Type | Vazirmatn for UI and headings. Newsreader (`.exam-serif`, `lang="en"`) for English exam text only. Page title, then one lede, then sections. Do not introduce a third font |
| Space | Use the existing page padding and `gap` scale. Do not invent a new spacing system. Cards keep a hairline border and the `0.8rem` radius |
| Grid | Public pages use the current `max-w-5xl` column. The app shell keeps its current navigation plus content column. Dashboard content stacks on small screens and may sit in two columns only when the score and the plan are both readable |
| Cards | One subject per card. NOVI’s card is a welcome, not a second dashboard |
| Buttons | One solid primary button for the path action. Secondary actions use the existing outline or ghost styles. Destructive actions are visually separate and require a confirm step in production |
| Forms | Labels are visible. Errors sit on the field and use `aria-invalid`. The password rule is stated before submit |
| Navigation | Primary: dashboard, roadmap, plan, practice, progress, mocks. Secondary in the same shell: reports, assistant, notices, archive, lab, feedback, help, profile, plans, admin. Admin is hidden in a public production build until server authorization exists |
| Charts | Indigo family only, plus a data table of the same numbers. Meaning is not color alone |
| Feedback | Success, warning, and error keep green, amber, and red. A band estimate uses neutral type plus the unofficial label, not a success color |
| Motion | CSS only. No WebGL. NOVI float is a few pixels. Glow uses the existing `--glow` token and stays low |
| NOVI art | `object-fit: contain`. Do not crop, stretch, or recolor. Do not render `novi-master-reference.jpg`. If the requested still has no file, show the sentence without an image |

## 3. NOVI

NOVI is a still plus one sentence. It is not navigation, not the toast system, and not the model.

Artwork that exists: `character/idle.png` for happy at rest, eleven expression files, eight action files. Blink, wing, and ribbon layers do not exist, so those animations stay off. A mixed expression and action has no file and must not be faked. Happy plus a non-idle action may use the action file. Any other mix stays unavailable.

| | Dashboard `/dashboard` | Study plan `/plan` | Placement report `/placement/report` |
| --- | --- | --- | --- |
| Purpose | Welcome and name the single next action | Encourage the edit without competing with the task list | Explain the finding and point at the next step |
| Status | IMPLEMENTED | IMPLEMENTED | NOT IMPLEMENTED |
| Personality | Friendly, brief, serious about the gap | Calm, supportive | Clear and modest. Never celebratory about an unofficial number |
| Allowed expressions | No view: encouraging. Bottleneck: concerned. Next open task: encouraging. Otherwise happy. Action stays `idle` | No view: encouraging. Concerned only when the trailing skill’s minutes fell against the unedited plan. Otherwise encouraging. Action `idle`. Proud is not used | Locked: encouraging, and the sentence only says to finish four skills. Open with a bottleneck: concerned. Open without one: encouraging and the next task. Proud is not used. Action `idle` |
| Message length | Welcome plus one sentence. Two sentences maximum | One sentence under 140 characters in English, or the Persian equivalent | One sentence that names the weakest skill or the locked state |
| Interaction | None. The primary button elsewhere on the page is the action | None. The task list receives clicks | None. The link to the plan or the next task is the action |
| Size | Large welcome, beside the sentence from 768px up, stacked below that | Small, at the top of the page, not repeated on each task | Small, under the title and above the numbers |
| Silent when | Never removed from this route. On the empty dashboard, one sentence only, so it does not repeat the empty-block paragraph | While focus stays inside the task table, including moves between its controls, keep the sentence. Release it only when focus leaves the table. There is no drag interaction | Never removed from this route. The locked page still shows NOVI, with no band and no score language |
| Reduced motion | No float, no animated glow. Image and text remain | Same | Same |
| Accessibility | The section has an accessible name. The image is decorative because the sentence carries the meaning | Same | Same |

NOVI is absent on `/`, auth pages, `/onboarding`, `/placement`, `/placement/:skill`, `/practice`, `/practice/:id`, `/mocks`, `/mocks/:id`, `/progress`, `/archive`, `/notifications`, `/assistant`, `/help`, `/reports`, `/feedback`, `/lab`, `/profile`, `/plans`, and every `/admin` route.

`/reports` is an export tool and stays without NOVI. Confirmed 2026-11-05. Findings stay on `/placement/report`.

## 4. Shell behavior

`AppShell` redirects to `/login?next=` when no account is stored, and to `/onboarding` until onboarding is done. That is a local gate, not a session.

Production keeps the same redirects, backed by the server session. A 401 during use returns the person to login and keeps the typed placement draft only if it was already saved on the server.

The lab and the admin link are prototype tools. They are not part of the public navigation once a public build exists.

## 5. Public pages

### Landing `/`

| | |
| --- | --- |
| Purpose | Explain the unofficial estimate and offer a start |
| Goal | Begin signup or open the sample learner |
| Information | Value, method, preview, FAQ, disclaimer |
| Hierarchy | Title, disclaimer, primary start, supporting detail |
| Primary | Start signup |
| Secondary | Sample learner, plans, language |
| Components | Public header and footer |
| Navigation | Public only |
| Loading | Page is static |
| Empty | Not used |
| Error | Not used |
| Success | Leaves for signup or the sample dashboard |
| Responsive | Single column on small screens |
| Accessibility | One h1. Disclaimer is text, not only color |
| NOVI | None |

### Login `/login`

| | |
| --- | --- |
| Purpose | Enter an account that already exists in this browser |
| Goal | Reach onboarding or the previous `next` path |
| Information | Email, password, the sentence that the password is not stored |
| Hierarchy | Title, honesty line, fields, submit |
| Primary | Sign in |
| Secondary | Signup, password recovery, sample learner, sample admin |
| Loading | Immediate. There is no network auth |
| Empty | Not used |
| Error | Invalid email, or an email that is not in this browser |
| Success | Account object is set and the shell opens |
| Responsive | Narrow form |
| Accessibility | Labels, `aria-invalid`, password autocomplete |
| NOVI | None |
| Production | The honesty line is replaced by a real session. Errors stay generic and do not reveal whether the email exists |

### Signup `/signup`

| | |
| --- | --- |
| Purpose | Create a local learner record |
| Goal | Land in onboarding |
| Information | Name, email, phone, age, password |
| Primary | Create account |
| Secondary | Login |
| Error | Field-level. Password rule: 8 characters and one digit |
| Success | `signUp` stores the account without the password and clears onboarding |
| NOVI | None |
| Production | Same fields. The server returns the profile and sets the session cookie. The password never returns |

### Password recovery `/forgot-password`

| | |
| --- | --- |
| Purpose | Show the recovery path |
| Status | SIMULATED. Copy says no email is sent |
| Primary | Submit email |
| Error | Invalid email, or the simulated offline state |
| Success | A local confirmation that nothing was sent |
| NOVI | None |
| Production | Always show the same confirmation so the screen does not reveal whether the email exists. Send one reset message through the chosen provider (Q-03) |

### Plans `/plans`

| | |
| --- | --- |
| Purpose | Compare Free and Pro |
| Status | SIMULATED. No purchase button |
| Primary | Return to study. There is no buy action |
| NOVI | None |
| Production MVP | Keep the comparison only if it does not imply a purchase. Taking payment is out of scope |

## 6. Learner pages

### Onboarding `/onboarding`

| | |
| --- | --- |
| Purpose | Save a goal the person can still edit |
| Goal | Leave with `onboardingDone` and a profile |
| Information | Exam type, target, minutes, days, exam timing |
| Primary | Save and continue to placement |
| Secondary | Edit a suggestion rather than accept it blindly |
| Empty | Required fields block continue |
| Error | Field errors. No score yet |
| Success | Profile stored in this browser |
| NOVI | None. The form is the task |
| Production | `PATCH /v1/me` from `docs/api.md` |

### Placement hub `/placement`

| | |
| --- | --- |
| Purpose | Show four skills and which are submitted |
| Primary | Continue the unfinished skill |
| Empty | All four open |
| Success | Link to the report only after four submissions |
| NOVI | None |

### Placement skill `/placement/:skill`

| | |
| --- | --- |
| Purpose | Answer one skill |
| Primary | Submit this skill |
| Information | Items, timer, connection state |
| Loading | Slow-connection simulation waits. Production uses the real network state |
| Error | Missing answers named on the field. Offline blocks submit and keeps the answers |
| Success | Skill marked done, return to the hub |
| NOVI | None. No glow, no float, no figure beside a timer |
| Accessibility | Timer is text. It does not rely on animation |

### Placement report `/placement/report`

| | |
| --- | --- |
| Purpose | Show the unofficial result after four skills |
| Information | Overall, range, confidence, skill bands, evidence lines, bottleneck |
| Hierarchy | Unofficial eyebrow, title, NOVI sentence, numbers, evidence, next action |
| Primary | Open the plan or the named next task |
| Loading | Prototype: no network wait. Production: title stays, and no zero band is shown while the report loads |
| Empty / locked | Fewer than four skills: locked title, link back, NOVI encouraging sentence. No band |
| Error | If the model explanation fails later, the deterministic report still shows |
| Success | Report visible and labeled unofficial or simulated |
| NOVI | See section 3. Not present today |
| Special | A fictional scenario may show before the person’s own placement is done, and the page must say the data is fictional |

### Dashboard `/dashboard`

| | |
| --- | --- |
| Purpose | One picture of gap, readiness, trend, and next task |
| Primary | Open the next incomplete task |
| Information | NOVI sentence, bottleneck callout, readiness, skills, trend, plan link |
| Hierarchy | Welcome, the gap, the next action, then supporting numbers |
| Secondary | Plan, practice, placement |
| Loading | Prototype: no network wait. Production: title and NOVI wait state, never a zero band |
| Empty | No view: NOVI encouraging sentence plus the empty block and “Start the placement” |
| Error | Numbers do not render if there is no view. Do not show a zero band as if it were a result |
| Success | The next task is identifiable without reading every card |
| NOVI | IMPLEMENTED. `DashboardNovi` |
| Responsive | Sentence beside the figure from 768px. Stacked below that. The figure is contained, not cropped |

### Roadmap `/roadmap`

| | |
| --- | --- |
| Purpose | Show the path over time |
| Primary | Return to the plan |
| NOVI | None |
| Note | This is a learner roadmap, not the admin delivery board |

### Study plan `/plan`

| | |
| --- | --- |
| Purpose | Edit this week’s work and see coverage move |
| Primary | Prototype: pick a path or edit a row. Each change is stored immediately. There is no save button |
| Information | Tasks, status, priority, skill coverage |
| Loading | Prototype: no network wait. Production: the last saved plan stays visible until the new one arrives. A failed save keeps the previous plan and says it was not stored |
| Empty | No view: send the person to placement. Do not show an editable fake plan |
| Error | Adherence under 75 shows the existing warning callout. The coverage section always states the cost if the trailing skill loses minutes. That note is not a failed save |
| Success | Coverage numbers update from `coverageBySkill` on the same page |
| NOVI | Built. One line above the editors. The 8rem figure is its own row and does not share a column with the path buttons, the adherence callout, or the task table |

### Practice `/practice` and `/practice/:id`

| | |
| --- | --- |
| Purpose | Run a sample exercise and record the attempt |
| Primary | Start, then submit |
| Empty | No items in the filter |
| Error | Unanswered required items |
| Success | Score for objective items from the bank. Writing uses the heuristic until AI-01 exists, and must say so |
| NOVI | None |
| Production | Objective explanation may call AI-03 after submit, below the result, never during the timer |

### Mocks `/mocks` and `/mocks/:id`

| | |
| --- | --- |
| Purpose | A fuller timed paper, still sample content |
| Primary | Start, then submit |
| Error | Disconnect keeps the clock running and holds submit |
| Success | `scoreMockPaper` result, labeled unofficial |
| NOVI | None |

### Progress `/progress`

| | |
| --- | --- |
| Purpose | History of attempts and the trend |
| Empty | No attempts: explain that placement or practice creates the first point |
| NOVI | None |

### Reports `/reports`

| | |
| --- | --- |
| Purpose | Export |
| Information | Date filter, history table, CSV, print |
| Primary | Download CSV |
| Empty | “No point in this range” |
| Success | The page says the CSV came from this browser |
| NOVI | None |
| Production | CSV is generated from server rows. PDF remains print until a job exists. A job is P1, not P0 |

### Archive `/archive`

| | |
| --- | --- |
| Purpose | Older attempts |
| Empty | No archived items |
| NOVI | None |

### Notifications `/notifications`

| | |
| --- | --- |
| Purpose | In-app notices and preferences |
| Status | IMPLEMENTED in the app. Email and push are not sent |
| NOVI | None |

### Assistant `/assistant`

| | |
| --- | --- |
| Purpose | Ask about the plan and the gap |
| Status | SIMULATED. The first line states it is not a language model |
| Primary | Send a message |
| Empty | Sample questions |
| Error | No view: tell the person to finish placement |
| Success | A template reply tied to current numbers |
| NOVI | None. The assistant must not wear NOVI in a way that implies the template is a model |
| Production | AI-05. The screen drops the “not a language model” line only after the server route is live, and keeps the unofficial-score refusal |

### Help `/help`

| | |
| --- | --- |
| Purpose | Capability honesty |
| Information | Live, simulated, and planned rows from `lib/capabilities.ts` |
| NOVI | None |

### Feedback `/feedback`

| | |
| --- | --- |
| Purpose | A local ticket |
| Success | Ticket id stored in this browser |
| NOVI | None |

### Profile `/profile`

| | |
| --- | --- |
| Purpose | Language, theme, text size, motion, sign out, local delete |
| Primary | Save a preference |
| Destructive | `deleteLocalAccount` clears the storage key |
| NOVI | None. A later preference to hide NOVI is P1 and is not built |
| Production | Preferences that are visual may stay on the device. Account deletion calls `DELETE /v1/me` |

### Lab `/lab`

| | |
| --- | --- |
| Purpose | Switch sample scenarios and overrides |
| Status | IMPLEMENTED prototype tool |
| NOVI | None |
| Production | Removed from the public shell |

## 7. Admin

Current state, all SIMULATED:

`AdminGate` checks `canOpen` in `lib/access.ts`. A learner who fails the check sees a button, `setRole("system_admin")`, which writes the role into the same browser state. The page says the limit is only in the interface.

Routes: `/admin`, analytics, content, users, feedback, experiments, roadmap, settings, design-system.

Production rule before any public release:

- Those routes are absent, or they require a server role.
- The client cannot grant itself `system_admin`.
- Content publish, user inspection, and settings changes write an audit record: who, when, what.
- Analytics responses contain aggregates, not answer text. This matches the note already in `docs/api.md`.

Admin is not part of the learner MVP. It is a release constraint.

## 8. Responsive and accessibility

- Design the narrow screen first. The dashboard welcome stacks. Plan editors are full width.
- Hit targets stay at least the current button height.
- Focus uses the existing outline and ring.
- Charts have a table equivalent, already required by `docs/design-system.md`.
- The placement timer and form errors are readable with motion off.
- Do not communicate the gap by the concerned expression alone. The sentence names it.
