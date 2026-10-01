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

- canvas / surface / inset surface / raised surface / inverse surface / overlay
- content / muted content / inverse content / inverse-muted content
- subtle separator / action boundary / field boundary / strong control boundary / focus
- brand / success / warning / danger / info
- neutral Stage baseline and authored presentation theme
- data-visualization fills and contrast-safe on-Stage variants
- control / panel / card / feature / showcase radii
- card / panel / feature elevation
- interface motion/easing

`border-subtle` is for separators and low-emphasis containment. `brand-border` belongs to selected or intentionally brand-tinted surfaces, not ordinary structural panel chrome.
`border-field` belongs to labeled text fields; `border-action` belongs to
text-bearing buttons, selectable cards, and similar actions whose visible content
already identifies the control. `border-control` is intentionally stronger and
is reserved for cases where the boundary itself is necessary to identify the
component, such as a compact standalone checkbox or another control without an
equally clear text/icon affordance. A separator token must never be promoted into
an interactive boundary merely because both happen to be gray.

WCAG 2.2 non-text contrast does not require the complete hit-area boundary of a
text-bearing control to reach 3:1 when visible content already identifies the
control. When a boundary is the visual information required to identify the
component, that boundary targets at least 3:1. Focus, selection, error, and other
necessary state indicators still target at least 3:1. This distinction keeps the
interface legible without turning every action and field into high-contrast
chrome.

Normal text targets at least 4.5:1 contrast; large text may use the WCAG large
text threshold. Placeholder text is still text and does not receive opacity that
pushes it below the required contrast. Meaningful graphical objects target at
least 3:1 when they are required to understand or operate the interface.

Color is never the only signal for correctness, errors, selection, score,
connection state, or disclosure. Pair it with text, iconography, shape, or
position.

Raw hex/RGB values are prohibited in new product chrome. Exceptions are authored
presentation colors, generated/algorithmic data colors, media, and explicitly
documented decorative artwork.

Live presentation styling has a second semantic layer resolved at runtime by
`presentationTheme.ts`: `--live-bg`, foreground/muted/border/focus roles,
control/input roles, overlay/contrast roles, accent, visualization-fill palette
roles, a dedicated opaque Word Cloud result surface, and derived contrast-safe
visualization-text palette roles. Authored palette colors remain unchanged for fills.
Word Cloud text is resolved against `--live-word-cloud-bg`, a solid theme-derived
surface shared by Stage, manager, participant result, and editor preview. This avoids
letting an arbitrary background-image pixel become the contrast reference. The resolver
preserves an authored palette color when it already reaches 4.5:1 on that surface and
otherwise moves it only as far toward the readable foreground as needed. Audience Stage,
participant, and manager projection surfaces consume
those authored roles instead of raw product-palette utilities. Private Backstage
is intentionally different: it is operational product chrome, uses the product
dark/Stage token vocabulary, and must not inherit authored presentation colors
as its surface contract.

## Product surface hierarchy

Product workspaces are flat by default. The page canvas establishes the base
layer; ordinary sections use `surface`, and nested summaries, compact rows, or
secondary groups use `surface-inset` to create hierarchy without another
shadowed card.

A surface should normally use the least expensive containment cue that makes its
relationship clear: whitespace first, then a tonal layer or subtle border.
Combining a border, large radius, and shadow at every nesting level is not a
default recipe. `shadow-card` is restrained local emphasis, not a synonym for
"this is a box." Do not weaken the shared elevation token merely to compensate
for overusing it; remove elevation from structural surfaces and keep the token
strong enough for the places where depth is actually meaningful.

`surface-raised` plus panel-level elevation is reserved for floating or
temporarily superimposed UI such as menus, dialogs, popovers, and operational
tooling that genuinely sits above the document. Feature-level elevation belongs
to one signature or high-priority surface, not to a row of peer sections.

Inside a bordered `surface`, prefer `surface-inset` for statistics, rows, and
secondary summaries rather than adding another bordered-and-shadowed card. When
several peer sections already have clear spacing and headings, keep them flat.
Persistent workspace regions such as an editor rail, canvas frame, and desktop
toolbar are structural layers, not floating cards, so borders and spacing should
normally carry their separation without elevation. A mobile drawer, menu,
popover, drag preview, dialog, or other layer that genuinely overlaps content
may use elevation because depth is part of its interaction meaning. This
preserves scanability in reports, dashboards, and editors while leaving
elevation available to communicate actual depth.

## Marketing composition and visual hierarchy

Public marketing surfaces may use a more expressive typographic and spatial
system than dense product workspaces, but they still consume the same semantic
tokens and accessibility rules.

Major section spacing is relational rather than globally uniform. Use tighter
spacing for content that belongs to one narrative step and larger spacing when
the user is entering a new idea. As a practical baseline, mobile marketing
sections usually need roughly 64–80px between major ideas and desktop sections
roughly 80–112px; local heading-to-content spacing is typically 24–40px. These
are composition ranges, not page-specific magic numbers. Do not apply one large
gap to every sibling section merely for consistency.

A marketing section should normally have one dominant elevated or framed
surface. Nested product previews may contain panels, but each deeper layer should
be visually quieter: lower radius, lower elevation, or no shadow. Avoid
"card inside card inside card" composition where borders, shadows, and rounded
corners all repeat at every level.

Elevation communicates hierarchy rather than decoration. Reserve feature-level
shadows for signature surfaces such as a hero product demonstration. Ordinary
cards generally use a subtle border, a card-level shadow, or neither. Do not
combine the strongest radius and strongest shadow by default.

Large showcase radii are reserved for signature marketing or projection-like
surfaces. Nested content should step down through feature, card, and control
radii so the visual hierarchy remains legible.

The semantic Stage palette is reserved for audience-facing presentation or
projection previews. Generic dark marketing/product chrome uses
surface-inverse / content-inverse roles even when its current neutral values
match Stage. This preserves the meaning of Stage and allows either system to
evolve independently.

Marketing body copy normally uses 14–18px text depending on hierarchy and
viewport. Metadata may use 12px. Essential instructions, controls, or explanatory
copy must not be reduced to 10–11px simply to fit a dense mockup. Product-preview
instrumentation may be compact only when it is genuinely incidental and remains
legible.

Repeated sections should vary composition where that improves scanability.
Not every section needs a centered eyebrow/title/description stack. Alternating
centered showcase headings with RTL-aligned editorial headings is preferred when
the content relationship supports it. Alignment changes must remain logical and
direction-aware rather than hard-coded left/right geometry.

Long marketing pages may use a small number of full-bleed tonal chapter bands to
mark meaningful transitions. Prefer one brand-tinted chapter and, when useful,
one neutral surface chapter over alternating every section. The page should not
become zebra-striped, and background changes must not be used as a substitute
for heading hierarchy or spacing. Content inside a tonal band still follows the
same contrast and semantic-token rules.

## Controls and forms

Shared primitives own recurring interaction behavior. Prefer `Button`,
`Input`, `FieldFrame` with its shared adornment/action slots, `Notice`,
`ConfirmDialog`, and the established dialog lifecycle over page-local
reinventions.

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
