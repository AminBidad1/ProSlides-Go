# ProSlides frontend product and UX guidelines

## Purpose

This document owns durable Persian-first product experience rules. It does not
track implementation phases or current source counts. Current status is in
`status/current.md`; frontend debt is in `frontend-debt.md`; historical
F0-F5 delivery is archived in `archive/frontend-f0-f5-2026-08.md`.

## Product language and direction

Persian is the default user-facing language. Product chrome, validation, empty
states, loading states and accessibility labels are Persian and RTL.

API fields, URLs, logs, code identifiers and developer documentation remain
English. User-authored presentation content may be Persian, English or mixed
and must use safe direction boundaries rather than forced alignment.

## Experience principles

1. Navigation preserves spatial context. Route/data loading uses a
   context-shaped skeleton instead of unrelated full-screen loading.
2. Every mutation exposes pending, success when needed, and recoverable error
   behavior. Duplicate submission is blocked.
3. Validation is actionable and stays near the relevant field.
4. Disabled controls communicate why when the reason is not obvious.
5. Empty states identify the next useful action.
6. Unimplemented controls are hidden or explicitly unavailable.
7. Motion is functional, normally short, and respects reduced-motion settings.
8. New and materially changed interactions preserve semantic HTML, accessible
   names, keyboard reachability and usable touch targets; exhaustive manual
   accessibility audit is consolidated before production rather than repeated
   after every pre-production visual iteration.
9. Runtime presentation theming may change visual mood without changing basic
   interaction/accessibility semantics.
10. Responsive behavior is designed, not merely shrunk.
11. Authored presentation audio is host-output-only. Participant devices stay silent to avoid echo, drift, bandwidth multiplication and browser-autoplay inconsistency. Remote sessions share the presenter device audio through the conferencing/screen-share path. A future personal-audio mode, if product evidence justifies it, must be an explicit session capability rather than silently changing this default.

## Design-system contract

The normative implementation contract is `design-system.md`; this section
captures the enduring product/UX rationale behind it.

All product areas share one semantic design-system kernel even when they use
different themes.

Shared semantics include:

- typography hierarchy;
- spacing rhythm;
- radii and elevation;
- focus treatment;
- field/error/help behavior;
- disabled/loading states;
- dialog/menu/popover behavior;
- feedback colors and live-region rules;
- motion duration/easing categories.

Marketing, manager/dashboard, editor and live participant surfaces may use
different theme values. A theme does not invent new meanings for "danger",
"focus", "disabled" or "surface".

The shared visual vocabulary also distinguishes product chrome from projected
content:

- `canvas` and `surface` are ordinary application layers;
- `stage` is the neutral dark baseline for audience-facing projection chrome
  and lightweight marketing product previews. An authored live Stage may replace
  these baseline values through the presentation theme; the semantic role stays
  the same even when its colors do not;
- expressive data-visualization colors belong to poll/quiz/word-cloud/result
  content, not to ordinary navigation, forms or generic cards. When a data
  accent becomes text on the neutral Stage, use its contrast-safe `on-stage`
  role rather than assuming a chart-fill color is also readable text. Authored
  runtime themes use the equivalent derived `--live-palette-text-*` roles on
  the opaque `--live-word-cloud-bg` result surface so a custom visualization
  palette stays recognizable without letting background imagery bypass contrast;
- muted copy on tinted surfaces uses an explicit contrast-safe text role rather
  than assuming the default muted color remains AA-compliant after blending;
- shape roles are tokenized as control/card/feature/showcase instead of
  page-specific arbitrary radii;
- marketing headings use font weights actually shipped by the application.
  New or materially changed marketing UI must not depend on synthetic 800/900
  weights when only weights through 700 are bundled.

These roles are semantic. A dark card is not automatically a `stage`, and a
new accent color is not automatically a data-visualization color.

## Forms

Forms use semantic labels, descriptions and field errors. Errors should not be
communicated by color alone.

Persian/Arabic digit entry is accepted where users naturally type numeric
values. Display formatting may use Persian digits, while API/domain
representation stays canonical. Numeric identifiers remain strings.

Password policy/help copy must be generated from or tested against the actual
validation contract so guidance cannot drift from backend/OpenAPI rules.

## Feedback and errors

Use one feedback policy:

- field validation next to the field;
- form-level errors near the form;
- transient success/status in an accessible status region;
- destructive confirmation through an accessible alert dialog;
- network/server recovery with retained user context and retry when safe;
- edit conflicts explain that newer server state exists and provide a clear
  recovery action.

Do not expose raw backend/internal English messages as primary Persian UI copy.
Use stable machine-readable error codes and localized client messages.

## Responsive behavior

Regression anchors remain 390x844 mobile and 1440x900 desktop. Public,
identity and ordinary participant flows also keep a 320-CSS-pixel reflow gate.
Test intermediate sizes when layout changes.

Editor/live controls must account for safe areas and virtual-keyboard pressure.
Reusable components should respond to their container when appropriate rather
than assuming the whole viewport defines available space.

Avoid physical-direction assumptions. Prefer logical layout so RTL behavior is
structural rather than a collection of exceptions.

## Accessibility

Target WCAG 2.2 AA.

Required behavior includes:

- semantic headings/landmarks/forms/tables;
- visible, unobscured focus;
- keyboard access to all actions;
- accessible names for icon-only controls;
- correct dialog focus containment/restoration;
- no pointer-only essential interaction;
- meaningful async/live announcements without noise;
- reduced motion;
- usable touch targets;
- readable contrast across allowed runtime themes.

Automated axe checks are useful smoke coverage, not a substitute for
keyboard/manual review. Critical flows have automated accessibility/focus
coverage; final environment/device/manual review remains part of release
evidence where automation cannot prove the experience.

## Motion

Motion should explain continuity, hierarchy or state change. Avoid long
decorative animation that delays work.

Route/editor transitions may use platform/React transition capabilities where
appropriate; richer live effects may use a motion library behind the route
boundary. All effects require reduced-motion behavior.

## Marketing landing experience

The public landing page demonstrates the product rather than competing on a
speculative feature count.

- The core story is `create -> join -> live interaction -> review`.
- The hero contains the one primary participant-to-Stage interaction. Broader
  activity variety is shown later as compact product previews instead of asking
  the visitor to complete several separate mini-app interactions.
- Marketing claims stay within shipped product capability. Future Session
  channels such as Q&A are not marketed as current features.
- Public copy describes participant/presenter roles and actions before device
  assumptions or internal projection names. Device terms such as mobile are
  used only when they describe a real capability or responsive surface, not as
  a required way to participate. Prefer plain-language "participant view" and
  "presentation screen" labels over unexplained Stage/Participant jargon.
- Demo values are deterministic fixtures and are labelled as demo/sample data.
  They must not resemble real customer or usage proof. Small fixture populations
  are preferred when they make one visitor action visibly legible; they are not
  capacity claims.
- The hero demo preserves the shipped presenter-paced contract: participant
  submission is acknowledged immediately, aggregate results remain hidden until
  an explicit presenter reveal, and the public Stage never presents a
  participant-specific "your answer" state.
- Informational counts/results do not update indefinitely on their own. Motion is
  event-driven and normally follows user input; reduced-motion users receive the
  same state change without path/scale choreography.
- Marketing product proof should be derived from the real Editor, participant,
  Stage and Report vocabulary without importing heavy application routes into
  the landing bundle. Stable deterministic captures or lightweight
  product-derived scenes are preferred.
- Product walkthrough scenes change only from explicit visitor controls, never
  from scroll position. Mobile renders one active scene at a time so product
  proof stays readable without multiplying page length or compressing desktop
  layouts into a narrow viewport.
- Trust content uses verifiable product facts until real customer evidence exists.
  Never invent customer logos, participation rates, testimonials or usage totals.
- Section composition should vary by information role rather than wrapping every
  idea in the same elevated card. Product proof may use a feature/showcase
  surface; use cases may use editorial rows; trust facts may use a quiet strip.
  Visual rhythm must come from hierarchy and product meaning before decoration.
- The participant-to-Stage relationship is a durable marketing signature:
  participant controls stay light and familiar, while the audience-facing Stage
  uses the semantic Stage surface and restrained result colors.
- While the public landing is still being refined, browser coverage protects
  responsive layout contracts directly: no horizontal overflow, explicit-only
  journey changes, one active product scene and usable touch targets. Full-page
  screenshot baselines are reserved for landing states stable enough that pixel
  diffs add signal rather than snapshot churn.

## Browser acceptance

Critical browser flows are part of the required pull-request gate and are
repeated on pull requests/manual runs. Stable public surfaces may use versioned
visual baselines; dynamic Editor/Live/Report behavior remains primarily
behavioral E2E.

For ordinary UI changes, verify the affected flow, relevant viewport, RTL/mixed
direction, focus/keyboard behavior and obvious console/network failures. Extend
automation when a change touches costly behavior such as authentication,
revision/conflict handling, live manager/participant coordination, cancellation,
reconnect/recovery or destructive operations.

Static screenshots do not prove interaction quality. Add visual baselines only
when the surface is deterministic and stable enough that snapshot maintenance
has clear regression value.
