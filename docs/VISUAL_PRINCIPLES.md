# Bandora visual principles

Status: proposed on 2026-11-06. Not applied.

The live system is the institutional editorial set in `app/globals.css` and `docs/design-system.md`. Do not implement the coral, butter, lavender, or indigo values in this file.

The product name stays Bandora. NOVI stays the companion. Scores stay unofficial. Semantic success, warning, and error do not change meaning.

## 1. Decision rule

Before adding a component, color, shadow, or animation:

1. Does the learner need it to understand the next step or the score?
2. Does it make that action easier to see or use?
3. Does the color identify something, or is it decoration?
4. Can the same result be a sentence, one button, or whitespace?

If the answer fails, leave it out. A simple page with a few strong colors is the goal. A page that uses every color is not.

## 2. Personality

Modern, youthful, creative, and motivating. Premium because the type, spacing, and restraint are calm. Approachable because NOVI and the warm accents are present in small doses.

NOVI is one still and one sentence on the three approved routes. It does not become a background pattern, a second navigation, or a rainbow sticker.

## 3. What stays simple

- One primary button per view. It uses Quantum Indigo.
- Cards keep a hairline. No drop shadows.
- No new gradients, except the existing soft NOVI glow.
- Motion stays the current float, and reduced motion still removes it.
- Vazirmatn for the interface. Literata for English exam text only.
- Radius stays `0.8rem`.
- Do not add a component that repeats a sentence already on the page.

## 4. Proposed palette

These values were checked against WCAG 2.2. Text colors below are at least 4.5:1 on the proposed page color. Butter yellow is not a text color on the page. Tinted fills are surfaces, not text.

| Role | Name | Light | Dark | Use |
| --- | --- | --- | --- | --- |
| Brand action | Quantum Indigo | `#30247D` on white text | `#C8B8FF` on `#221F27` text | The one primary button, links, focus ring |
| Page | Warm white / Deep charcoal | `#FBF6F0` | `#221F27` | Page background only |
| Card | White / lifted charcoal | `#FFFFFF` | `#2C2933` | Default cards |
| Soft surface | Soft lilac | `#F3EEFF` | `#2A2638` | Sidebar, a quiet band, not every card |
| Text | Charcoal / warm paper | `#2A2633` | `#F6F1EA` | Body and headings |
| Secondary text | — | `#5E5870` on warm white (6.3:1) | `#C8BFD4` on charcoal, to be rechecked before use | Hints |
| Creativity | Lavender | Fill `#E4D9FF` | Fill `#3A3358` | One highlighted surface, reading skill family |
| Warmth | Coral | Fill `#F7D5DC`, ink `#9B3050` | Ink `#F3B3C0` | Writing skill, one warm emphasis |
| Highlight | Butter yellow | Fill `#F8E7A8`, ink `#3A2E08` (8.5:1) | Same fill only behind `#221F27` ink | A single mark, never a page or a paragraph |
| Friendly accent | Apricot | Fill `#F8DCC8`, ink `#8A4514` | Ink `#F3C29A` | Speaking skill |
| Progress | Sage | Fill `#E5F0E2`, ink `#2F6B45` | Ink `#B7D7B0` | “This moved forward.” Not a form success message |
| Hairline | — | `#E4DDD4` | `#3D3946` | Borders. Must stay visible. Recheck before shipping |

### Semantic colors, unchanged in meaning

These already exist and stay stricter than the decorative accents.

| Meaning | Light text | Dark text | Never replace with |
| --- | --- | --- | --- |
| Success | `#166534` | `#86EFAC` | Sage |
| Warning | `#92400E` | `#F2B96D` | Butter or apricot |
| Error | `#B42318` | `#F0A8A2` | Coral |
| Info | Indigo family | `#C8B8FF` | A random accent |

A warning still needs an icon or words. Color is not the only signal.

### Skill identity

Each skill has one accent. The name is always written beside it.

| Skill | Light accent, usable as text or a bar | Dark accent on `#221F27` |
| --- | --- | --- |
| Listening | `#30247D` (11.7:1) | `#C8B8FF` (9.1:1) |
| Reading | `#5C3D96` (7.6:1) | `#D2B6FF` (9.2:1) |
| Writing | `#9B3050` (6.7:1) | `#F3B3C0` (9.3:1) |
| Speaking | `#8A4514` (6.6:1) | `#F3C29A` (10.1:1) |

Use the accent on the skill icon, a short bar, or the meter. Do not paint the whole skill card. Do not use these hues for success, warning, or error.

## 5. Light and dark

Light is the default. Dark is the same layout on charcoal, not a second design.

- Primary buttons invert: indigo fill with white text in light, lavender fill with charcoal text in dark. The current dark primary already follows this so the label does not disappear.
- Butter yellow, if used, keeps charcoal ink in both themes.
- Skill accents switch to the lighter column in dark. Do not leave `#30247D` as text on charcoal.
- NOVI’s painted body stays Quantum Indigo. Do not recolor the artwork to coral, yellow, or sage.
- Charts may use the four skill accents when the series are the four skills. A single overall line stays indigo. A data table remains beside the chart.

## 6. Where color is allowed

| Component | Color | Limit |
| --- | --- | --- |
| Primary button | Indigo | One per view |
| Secondary button | Outline, page or card surface | No filled apricot or coral buttons |
| Page and default card | Warm white, white, charcoal | Most of the screen |
| Skill meter, skill icon | That skill’s accent | The mark, not the card fill |
| Positive progress | Sage fill behind charcoal or sage ink | Only when a number improved |
| Highlight chip | Butter fill and charcoal ink | One chip, such as “next” |
| Gap callout | Existing warning colors | Not butter, not coral |
| NOVI card | Card surface and the existing glow | The figure is the color |
| Badges for live / simulated / planned | Current `StateBadge` styles | Do not make “simulated” look successful |

Coral, apricot, butter, and sage do not appear in the header, the sidebar list, or body paragraphs.

## 7. NOVI

NOVI’s job is emotional and brief. The palette does not give NOVI a new skin.

On a future page, ask the four questions in section 1 before adding another figure. The approved places remain `/dashboard`, `/plan`, and `/placement/report`. Timed practice, mocks, and placement skills stay without NOVI. `/reports` stays without NOVI.

## 8. Applying this later

When a page is approved for a visual pass:

1. Change tokens in `app/globals.css` only for roles listed here.
2. Keep semantic success, warning, and error separate from sage, butter, and coral.
3. Recheck secondary text and the hairline on the real background. The current live border `#BBAFEA` was darkened because a paler lilac line disappeared.
4. Do not recolor components one by one with raw hex in TSX. Use the token.
5. Check light, dark, Persian RTL, and a 390px width before calling the page done.

Until that pass, new work uses the live indigo tokens.
