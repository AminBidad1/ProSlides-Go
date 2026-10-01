# ProSlides Design System Contract

Status: active pre-production contract  
Scope: public marketing, identity, manager/dashboard, editor, reports, participant
surfaces, presenter/backstage, and audience Stage.

This document defines the visual, interaction, localization, and accessibility
rules that new or materially changed frontend work must satisfy. It complements
`frontend-architecture.md`, `frontend-professionalization.md`, and
`presentation-theme-system.md`.

## Standards baseline

ProSlides targets WCAG 2.2 Level AA for product UI and uses W3C
Internationalization guidance for Persian/Arabic-script layout. Bidirectional
behavior follows HTML `dir` semantics and the Unicode Bidirectional Algorithm.
Persian locale formatting follows `fa-IR` / Unicode CLDR behavior.

Design tokens are semantic CSS custom properties consumed through Tailwind CSS 4.
The token taxonomy should stay compatible in spirit with the Design Tokens
Community Group model: aliases describe purpose, not a page-specific color or
pixel value. A DTCG JSON export is optional until a second design tool/runtime
needs one; semantic ownership is mandatory now.

Primary references:

- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C Arabic & Persian Layout Requirements: https://www.w3.org/TR/alreq/
- W3C RTL HTML authoring: https://www.w3.org/International/questions/qa-html-dir
- Unicode Bidirectional Algorithm: https://www.unicode.org/reports/tr9/
- Unicode CLDR Persian locale charts: https://unicode.org/cldr/
- Design Tokens Community Group: https://www.designtokens.org/

## Persian and bidirectional behavior

The document root is `lang="fa-IR" dir="rtl"`. Direction is markup semantics,
not a visual CSS trick.

Use logical properties and utilities (`start`, `end`, `ps`, `pe`,
`ms`, `me`, `inset-inline-*`) for product layout. Physical left/right
placement is reserved for genuinely physical geometry, illustration, coordinate
systems, or algorithms where mirroring would be incorrect.

User-authored names, titles, questions, options, report text, and search terms
must use `dir="auto"` unless their direction is known by contract. Emails,
URLs, join codes, hashes, identifiers, and other machine-oriented strings are
explicitly LTR and should use `bdi` when embedded inside Persian prose.

Persian users may enter Eastern Arabic-Indic digits (۰۱۲۳۴۵۶۷۸۹),
Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩), or ASCII digits where the domain is numeric.
Normalize before validation. Do not use `type="number"` for manually entered
localized numbers because browser parsing is not a localization contract; use
`type="text"` plus an appropriate `inputMode` and shared parsing helpers.
Machine identifiers remain normalized ASCII strings.

Display human-facing counts, durations, ranks, dates, and times through
`Intl.*("fa-IR")` or shared formatters. Do not translate URLs, access codes,
storage identifiers, protocol values, or API payload fields into Persian digits.

Persian copy uses Persian punctuation and spacing, including the نیم‌فاصله where
appropriate. Do not solve mixed-direction punctuation problems by inserting
manual Unicode direction characters into arbitrary strings; prefer semantic
HTML isolation and the browser bidi algorithm.

## Typography

`Vazirmatn` is the primary Persian UI family. `Outfit` is the Latin/brand
companion, not the default body font.

Only font weights that are intentionally shipped and verified may be used.
Synthetic bold/italic is disabled. New UI must not rely on a weight merely
because a utility class exists.

Body copy normally starts at 14–16 CSS px with enough line height for Persian
letterforms. Dense metadata may be 12px when contrast, spacing, and reading
context remain strong. Do not use tiny text to compensate for an overloaded
layout.

Text containers must tolerate WCAG text-spacing overrides without clipping,
overlap, or loss of controls.

## Semantic tokens

The design system separates meaning from values:

- canvas / surface / raised surface / overlay
- content / muted content / inverse content
- subtle separator border / control border / focus
- brand / success / warning / danger / info
- neutral Stage baseline and authored presentation theme
- data-visualization fills and contrast-safe on-Stage variants
- control / panel / card / feature / showcase radii
- card / panel / feature elevation
- interface motion/easing

`border-subtle` is for separators and low-emphasis containment. Interactive
form boundaries use `border-control` or an equivalent boundary that reaches at
least 3:1 against its adjacent background. A separator token must never be
promoted into an input border merely because both happen to be gray.

Normal text targets at least 4.5:1 contrast; large text may use the WCAG large
text threshold. Placeholder text is still text and does not receive opacity that
pushes it below the required contrast. Meaningful control boundaries, focus/state
indicators, and graphical objects target at least 3:1.

Color is never the only signal for correctness, errors, selection, score,
connection state, or disclosure. Pair it with text, iconography, shape, or
position.

Raw hex/RGB values are prohibited in new product chrome. Exceptions are authored
presentation colors, generated/algorithmic data colors, media, and explicitly
documented decorative artwork.

Live presentation styling has a second semantic layer resolved at runtime by
`presentationTheme.ts`: `--live-bg`, foreground/muted/border/focus roles,
control/input roles, overlay/contrast roles, accent, and visualization-palette
roles. Audience Stage, participant, and manager projection surfaces consume
those authored roles instead of raw product-palette utilities. Private Backstage
is intentionally different: it is operational product chrome, uses the product
dark/Stage token vocabulary, and must not inherit authored presentation colors
as its surface contract.

## Controls and forms

Shared primitives own recurring interaction behavior. Prefer `Button`,
`Input`, `Notice`, `ConfirmDialog`, and the established dialog lifecycle
over page-local reinventions.

Every input has a persistent programmatic label. Important or non-obvious fields
also have a visible label or instruction; placeholder text is a hint, not the
only label. Associate help/error text with `aria-describedby` and expose errors
with `aria-invalid` and an appropriate live/alert role.

Use valid HTML `autocomplete` values for information about the user
(`email`, `name`, `nickname`, `current-password`, `new-password`,
`one-time-code`, etc.). Preserve password-manager compatibility.

Interactive targets must satisfy WCAG 2.2 target sizing. The project default is
40–44px for ordinary controls and at least 44px for primary touch actions even
though WCAG 2.5.8 permits a 24px minimum with its documented exceptions.

Keyboard focus is always visible and must not be hidden by sticky headers,
footers, inspectors, or overlays. Modal/alert-dialog primitives own focus
containment and return. Portaled RTL surfaces must carry an explicit RTL
direction or inherit one through a proven direction provider.

Loading, saved, submitted, connection, validation, and similar state changes that
do not move focus must be announced as status messages where the information is
important to task completion.

## Responsive and surface-specific behavior

Public, identity, participant, dashboard, and ordinary report flows must reflow
at 320 CSS px without two-dimensional scrolling. Long technical strings need
bounded wrapping or truncation plus an accessible way to obtain the full value.

The editor is a workspace rather than a stretched landing page: rail, canvas,
inspector, and top actions may change composition by breakpoint. Mobile
inspector behavior must remain operable without hiding focused controls.

Audience Stage is projection-first. It owns the viewport, avoids document
scrolling, keeps essential content within projector-safe bounds, and uses
distance-readable typography. The semantic Stage palette is only a neutral
baseline; authored presentation themes may replace its colors while retaining
contrast/readability guarantees.

Presenter/backstage surfaces prioritize control clarity and privacy. Participant
surfaces prioritize one-handed mobile interaction, reconnect/error recovery, and
large touch targets. These surfaces share semantic primitives but do not have to
share identical density.

## Motion and media

Honor `prefers-reduced-motion`. Essential state changes must remain
understandable with animation removed. Motion explains hierarchy or transition;
it does not compensate for unclear structure.

Decorative imagery has empty alternative text. Authored meaningful imagery has
bounded editable alt text. Failed media must degrade without collapsing live
layout or hiding the task.

## Verification gates

Material frontend changes must keep:

1. lint, TypeScript, architecture, dead-code, unit/component tests, and build
   green;
2. automated accessibility checks green on critical flows;
3. public/auth/participant reflow checks at 320px and primary mobile/desktop
   anchors;
4. keyboard-visible focus and no focus-hidden regressions around sticky chrome;
5. no locale regression for Persian/Arabic/ASCII digit input and mixed-direction
   user content;
6. no new raw product-chrome colors, arbitrary visual values, or duplicate
   page-local primitives without a documented reason.

The frontend foundation suite includes a repository-wide design-system drift
guard over production TypeScript/TSX. It rejects raw Tailwind palette utilities,
arbitrary radius/shadow values, inline font-family ownership, native
`type="number"` localized inputs, and page-local native textarea/select
primitives. Fix the semantic ownership when this guard fails; do not weaken the
guard merely to admit a one-off visual value.

Visual snapshots protect intentional composition, but they do not override WCAG,
RTL correctness, or semantic-token requirements. When an accessibility fix
changes a snapshot, update the baseline rather than weakening the check.
