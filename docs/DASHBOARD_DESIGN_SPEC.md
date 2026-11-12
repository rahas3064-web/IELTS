# Dashboard design specification

Status: design only, 2026-11-05. This file specifies `/dashboard`. It does not change the app.

Facts are what the code does today. Recommendations are the target layout. A developer implements only the recommendations, and only after this spec is approved.

Related rules already accepted: `docs/UX_ARCHITECTURE.md` section 3, `docs/PRODUCT_SPEC.md` PR-18, `docs/design-system.md`. This file is more specific for the dashboard and wins on dashboard layout if they differ. It does not move NOVI onto any other route. `/reports` stays without NOVI.

## 1. Verified facts

Route: `/dashboard` renders `DashboardScreen` in `components/features/home.tsx`, inside `AppShell`.

There is no dashboard-specific loading or error view. Until `localStorage` state is ready, the shell shows the sentence “Preparing your space” and no scores. Incomplete placement is `view === null`. That is the empty dashboard, not a locked report. The locked report lives on `/placement/report`.

When `view` exists, the page renders, in this order:

1. `PageIntro`. Eyebrow is “Sample scenario” or “Estimate from this browser”. The `h1` is the person name for the active locale. The lede is `view.source.summary`.
2. `DashboardNovi`. Large still, soft glow, soft float, action `idle`.
3. A warning callout if `view.bottleneck` is set. The model sets that only when the largest skill gap is at least 0.5 (`lib/model.ts`).
4. A two-column band from `lg`: overall band, target, range, confidence, days to the exam, and a nested “Next suggestion” box linking to `/plan`. Beside it, `ReadinessFigure`.
5. `SkillBoard`: four skill cards.
6. `TrendChart` beside a “Today” list. Today uses `Date.getDay()` against `task.day`.
7. Three cards: activity points, badges, streak.

`DashboardNovi` message rules today:

| View | Expression | Sentence |
| --- | --- | --- |
| No view | encouraging | Welcome, then the placement must finish before an estimate |
| Bottleneck | concerned | Welcome, then “The main gap right now:” plus the bottleneck title |
| Open task, no bottleneck | encouraging | Welcome, then “Next step:” plus the task title |
| Otherwise | happy | Welcome, then “Today's plan is on this page.” |

The image `src` is a cut still, never `novi-master-reference.jpg`. Layers are off because those files do not exist. The image `alt` is empty. The section name is “NOVI”. The sentence is the accessible text.

Shell, from `components/shell/app-shell.tsx`:

- At `lg` (1024px), a sticky sidebar is `17rem`, `border-e`, `bg-sidebar`. Below that, the sidebar is hidden and a menu button opens a sheet. The sheet side is right in Persian and left in English.
- Main column: `max-w-6xl`, `px-4`, `py-6`, and `pb-28` below `lg` so the fixed five-item shortcut bar does not cover the last content.
- A fictional scenario adds a banner above the main content. The sidebar footer states that calculations run in this browser and that official audio, payments, and AI are not connected.
- Skip link target is `#content`.

Tokens in `app/globals.css`: page `#F4EFE6`, card `#FBF8F3`, text `#1A2332`, primary `#1A2332`, muted text `#5C564E`, beige `#E7DFD2`, sage `#3F5C4B`, border `#B7AA98`, radius `0.5rem`. Dark page `#141B26`, dark card `#1C2533`, dark primary `#F4EFE6` with ink text. Vazirmatn is the UI font. Newsreader is for exam English and is not used on this page. Root text size is 15, 16.5, or 18.5px from `html[data-text]`.

NOVI stage is square and `object-fit: contain`. Below 768px the card stacks and the large stage is `12.5rem`. From 768px the card is a row, text is `start`, and the large stage is `14.5rem`. Float is 7.5s and about 6px. `prefers-reduced-motion: reduce` and `html[data-motion=reduce]` stop that animation. Print hides `.novi-card`.

The card’s row padding is physical (`padding-inline` is not used). In RTL the extra padding stays on the physical right.

The readiness ring is `size-24` (96px) with an `aria-label`. Its table is visible, not only for screen readers. The trend SVG is 360 by 140 in viewBox, stretched to the card width, with a visually hidden table of the same points. Skill meters expose `role="meter"`.

There is no model call on this page. Bands are client math. Writing and speaking heuristics are not shown as a model here.

## 2. Problems the target layout fixes

These are recommendations. They are the reason the order below is not a copy of today’s order.

- The person is named in the `h1` and again in NOVI.
- When a bottleneck exists, NOVI and the warning callout both say the gap title. The next task is easy to miss.
- The next task appears in the score card as a text link, and sometimes again in NOVI.
- Points, badges, and streak sit at the same visual weight as the band. `docs/PRODUCT_SPEC.md` puts gamification out of scope. The data can stay. It cannot lead the page.
- The overall figure does not itself say “unofficial”. The readiness paragraph says it is not a pass probability. The band needs the same honesty beside the number.

## 3. Information architecture

Do not add hours, a roadmap, an assistant transcript, or a new chart. Those are other routes or data this page does not need.

### 3.1 Welcome and NOVI

| | |
| --- | --- |
| Purpose | Orient the learner and name one next action |
| Question | What should I do first? |
| Shown | One still, one message, one primary button |
| Priority | Highest |
| Action | The button opens `/plan` |
| Responsive | Stacked under 768px. Row from 768px, figure on the start side |

The `h1` is “داشبورد” / “Dashboard”. NOVI carries the name. The page does not use a second welcome heading.

### 3.2 Readiness overview

| | |
| --- | --- |
| Purpose | Show the unofficial overall picture |
| Question | Where am I, how sure is that, and how close is the exam? |
| Shown | Overall, target, range, confidence, days or “exam date unknown”, readiness score and its five parts |
| Priority | High, directly under NOVI |
| Action | None. This block is not a link |
| Responsive | One column under `lg`. Two columns from `lg`: band card about 45%, readiness card about 55%, matching today’s `0.9fr / 1.1fr` |

Caption under the overall, using existing product language: “Unofficial simulated estimate” / “تخمین غیررسمی و شبیه‌سازی‌شده”. The readiness line “This index is not a probability of passing the official test.” stays.

### 3.3 Skill gap

| | |
| --- | --- |
| Purpose | Name the blocking skill once, then show all four |
| Question | Which skill is behind, and by how much? |
| Shown | The warning callout only when `bottleneck` is non-null. Then the four skill cards |
| Priority | High. The callout is above the skill grid |
| Action | None on the callout. Skill cards are not links in this spec |
| Responsive | Callout full width. Skills one column under `sm`, two from `sm` |

NOVI does not repeat the callout title. The callout keeps the gap size and, when readiness is 70 or above, the sentence that the index can look high while one skill still blocks the target. That sentence already exists.

### 3.4 Next action

| | |
| --- | --- |
| Purpose | Leave the dashboard toward the work |
| Question | What do I open? |
| Shown | The task title inside the NOVI message, and one solid button |
| Priority | Same band as NOVI, not a third card |
| Action | Button label is the task title. Destination is `/plan` |
| Responsive | Under 768px the button is full width under the message. From 768px it sits at the inline end of the NOVI card, vertically centered |

Remove the nested “Next suggestion” box from the band card. One statement of the next task is enough.

If every task is done or skipped, the message uses the existing happy line “Today's plan is on this page.” and the button label is “Plan details” / “جزئیات برنامه”, still to `/plan`.

### 3.5 Study plan overview

| | |
| --- | --- |
| Purpose | Show what today contains |
| Question | Is there work scheduled today? |
| Shown | The existing Today list and adherence percent |
| Priority | Medium, after the skills |
| Action | No second primary button. Editing days stays on `/plan` |
| Responsive | Full width under `lg`. Beside the trend from `lg` |

Empty today list keeps the current sentence: nothing is scheduled, and days can be moved on the plan.

### 3.6 Progress

| | |
| --- | --- |
| Purpose | Show whether the overall estimate has moved |
| Question | What is the recent overall trend? |
| Shown | The existing trend chart and its hidden table |
| Priority | Medium, beside Today from `lg` |
| Action | None |
| Responsive | Full width of its column. The SVG stays `w-full` with the 360×140 viewBox. Do not set a fixed pixel height that crops the line |

Activity points, badges, and streak remain on the page, below progress, in one quiet row. They are not a sixth priority. Do not add levels, comparisons, or celebrations. Each card keeps its current honesty line: points are only for finished work, and the streak is days with logged activity.

## 4. Layout

### 4.1 Desktop, 1024px and up

```text
+ sidebar 17rem ----------------+ main, max 72rem, pad 1.5rem +
| logo, nav, honesty footer     | [h1 Dashboard]                    |
|                               | [NOVI 14.5rem | message | button] |
|                               | [band card 45% | readiness 55%]   |
|                               | [gap callout, if any]             |
|                               | [skill] [skill]                   |
|                               | [skill] [skill]                   |
|                               | [trend 50% | today 50%]           |
|                               | [points | badges | streak]       |
+-------------------------------+-----------------------------------+
```

The shortcut bar is hidden, as it is today. Page bottom padding is `2.5rem` (`lg:pb-10`).

Section gap is `1.25rem` (`gap-5`). Card padding is `1rem` for dense cards and `1.25rem` for the band card. Card gap inside a band is `1rem`.

### 4.2 Tablet, 768px to 1023px

Same stack as mobile, with two exceptions that already exist: NOVI becomes a row at 768px, and skill cards become two columns at 640px. The sidebar stays hidden. The sheet and the bottom shortcut bar stay. Bottom padding stays `7rem` (`pb-28`).

NOVI stage is `14.5rem` in this range. The primary button goes under the message, full width, so a 14.5rem figure plus a button do not crush the sentence.

### 4.3 Mobile, under 768px

```text
+ header: menu, logo, language, theme, connection, log out +
| h1                                                    |
| [NOVI 12.5rem, centered]                              |
| [message, centered, max 40rem]                        |
| [primary button, full width]                          |
| [band card]                                           |
| [readiness card]                                      |
| [gap callout]                                         |
| [skills, one column until 640px]                      |
| [trend]                                               |
| [today]                                               |
| [points]                                              |
| [badges]                                              |
| [streak]                                              |
+ shortcut bar, 5 items, fixed ------------------------+
```

The last card must clear the shortcut bar. Do not pin a second bar above it.

### 4.4 RTL and LTR

Direction comes from `documentElement.dir`. Do not mirror by hand.

- The sidebar border is `border-e` (already logical).
- NOVI row: figure, then message, then button. In RTL the figure is on the right because it is first in a row. Keep that DOM order.
- Replace the NOVI card’s physical right padding with logical padding: `0.25rem` on the start side and `1.75rem` on the end side.
- Text alignment is `start`, not `left`.
- The trend and meters do not need to flip. Numbers stay tabular.
- The menu sheet stays on the start edge: right for Persian, left for English.

### 4.5 Type, space, radius

Use the existing scale. Do not add a font.

| Role | Treatment |
| --- | --- |
| Page title | `text-2xl` from the default size, `text-3xl` from `sm`, semibold |
| Section title | `font-semibold`, body size |
| Overall band | `text-5xl`, semibold, tabular |
| Skill band | `text-2xl`, semibold, tabular |
| NOVI message | `1.0625rem` / line-height 1.55, max-width `40rem` |
| Support | `text-sm`, `text-muted-foreground` |
| Eyebrow | `text-xs`, medium, `text-primary` |

| Token | Value |
| --- | --- |
| Page gap | 1.25rem |
| Card gap | 1rem |
| Card padding | 1rem or 1.25rem |
| Radius | 0.8rem, cards `rounded-xl` |
| Inline cluster | 0.5rem |

### 4.6 Surfaces

| Surface | Rule |
| --- | --- |
| Page | `bg-background` only. No extra gradient on the page |
| Card | `bg-card`, `border`, hairline, no drop shadow |
| NOVI card | Same card surface. Glow is the existing radial on the stage, soft, not a second background |
| Gap | Existing warning callout: warning border and tint, alert icon, `role="status"` |
| Empty | Existing dashed `EmptyBlock`, centered |
| Muted inset | Do not add one. The removed suggestion box was the only inset |

Primary buttons use `bg-primary`. One primary button on this page. Links that are not that button use `text-primary` underline on hover. Ghost and outline buttons in the header stay as they are.

Charts use `currentColor` / `var(--primary)` on a card. No second series and no area fill. The readiness ring uses `var(--muted)` for the track and `var(--primary)` for the value.

Success green, warning amber, and error red are not used for a high or low band. A band is not a success state.

## 5. NOVI on this dashboard

| | Target |
| --- | --- |
| Placement | First content block after the `h1` and the honesty eyebrow. Not in the sidebar, not in the shortcut bar, not repeated lower down |
| Size | `lg`. 12.5rem under 768px. 14.5rem from 768px. Contain. No crop, no CSS scale |
| Message | Beside the figure from 768px, under it below that. Welcome sentence, then one task sentence. Two sentences maximum |
| Score | The score is the next section. NOVI does not sit inside the band card and does not display a number |
| Gap callout | The callout is the only place that names the gap title. NOVI may look concerned while a bottleneck exists, and its words stay on the next task |
| Artwork | Indigo stills only. Happy rest is `character/idle.png`. Other faces use `expressions/{id}.png`. Action on this page is always `idle`. Mixed poses stay unavailable. The sheet file is never the `src` |

Expressions:

| Condition | Expression | Message after the welcome |
| --- | --- | --- |
| No view | encouraging | The estimate appears after the placement is finished |
| View, bottleneck, open task | concerned | Next step, plus that task title. Not the gap title |
| View, no bottleneck, open task | encouraging | Next step, plus that task title |
| View, no open task | happy | Today's plan is on this page |

Empty and incomplete placement are the same state: no view. Show NOVI, the dashed empty block, and “Start the placement”. Do not render the band, the ring, the skills, the trend, today, or the activity row. Do not show 0.0.

There is no separate locked state on this route. A fictional scenario still shows the full dashboard, with the existing shell banner and the “Sample scenario” eyebrow.

Reduced motion: no float, no entrance travel, no animated glow. The still, the message, and the button remain. The static soft glow may stay at its resting opacity.

Screen readers: the image stays `alt=""`. The message is text, not an image. The section keeps an accessible name. The primary button is a real link, not a click on the figure.

## 6. States

| State | What the learner sees |
| --- | --- |
| Shell loading | “Preparing your space”. No band |
| Empty / placement unfinished | Section 5 empty rule |
| Ready, with bottleneck | Full page. One gap callout. NOVI names the next task and uses concerned |
| Ready, no bottleneck | No callout. NOVI uses encouraging or happy as in the table |
| Sample scenario | Full page plus the shell banner and the sample eyebrow |
| Offline or slow | The existing shell status bar. The dashboard numbers do not change |
| Dark | The same layout on the dark tokens. Primary text on the dark primary button is `#1A2332` |
| Print | NOVI card hidden, as `.novi-card` is today. The band and the tables remain |
| Error | No new error illustration. If there is no view, use the empty state. Do not invent a failure band |

## 7. Accessibility

- One `h1`. Section titles are `h2`. Skill names are `h3`, as they are in `SkillBoard`.
- Skip link remains.
- Focus uses the existing ring. The new primary button is in tab order after the NOVI message’s reading position, and before the band.
- Contrast stays on the current tokens. Do not put muted text on the warning tint below the muted-on-page ratio already accepted in `docs/design-system.md`.
- The readiness ring keeps its label. The trend keeps its hidden table. Meters keep `role="meter"`.
- The gap is text plus the warning icon. The concerned face is not the only signal.
- Reduced motion is both the OS setting and `html[data-motion=reduce]`.
- The bottom shortcut bar remains reachable. It is not the only way to the plan.

## 8. Acceptance criteria

| ID | Pass when |
| --- | --- |
| D-01 | At 1280px the sidebar is visible, the main column is at most 72rem, and the sections follow section 4.1 |
| D-02 | At 390px the sections stack, NOVI is 12.5rem and contained, the button is full width, and the last card clears the shortcut bar |
| D-03 | At 800px the sidebar is hidden, NOVI is a row with a 14.5rem stage, and the button is full width under the message |
| D-04 | Persian `dir` is rtl. The NOVI figure is on the start side. English puts it on the left. No text is clipped |
| D-05 | With a bottleneck, the gap title appears in the callout and does not appear in the NOVI message. The message names the next open task. The expression is concerned. The action is idle |
| D-06 | With a view and no bottleneck, there is no gap callout. NOVI names the next task and uses encouraging, or happy if no task is open |
| D-07 | With no view, the page shows NOVI, the empty block, and the placement link. It shows no overall, no ring, and no 0.0 |
| D-08 | The overall block contains “Unofficial simulated estimate” or the Persian sentence in section 3.2. The readiness block still says it is not a pass probability |
| D-09 | Dark theme uses the dark tokens. The primary button label stays readable. NOVI is not recolored |
| D-10 | Reduced motion leaves the still and the message in place and does not run `novi-float` |
| D-11 | The figure’s `src` is not the master sheet. A missing still leaves the message and the button |
| D-12 | Keyboard order reaches the primary plan link. The image has an empty alt. The trend table exists in the accessibility tree |
| D-13 | The page does not describe NOVI, the band, or the assistant as a language model |

## 9. Unresolved

- Whether the points, badges, and streak row should be removed later. This spec keeps them at the bottom until that decision.
- The English tagline “intelligently planned” is a product-copy question (Q-04). It is not part of this page’s body today.

## 10. What not to build from this spec

- NOVI on any route other than the three already decided.
- A chat panel, a model request, or a new score.
- A second palette, a shadow system, or WebGL.
- Drag, a save button, or a crop on the figure.
