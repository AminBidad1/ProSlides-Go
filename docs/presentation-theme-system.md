# Presentation theme and color system

Status: active implementation plan  
Last reviewed: 2026-09-29

## Purpose

This document defines the durable product and engineering contract for presentation
themes in ProSlides. It covers the Editor, participant surfaces, manager projection,
public Stage, and future report/export reuse.

The goal is not unlimited styling. The goal is a small, coherent theme system that
stays readable on a projector, remains consistent across live surfaces, and can grow
without introducing a second visual contract.

## Product principles

1. A theme is presentation-level by default. Individual slide overrides are not part
   of the current product scope.
2. Curated themes are the fastest path. Custom colors remain available for brand use.
3. Background, readable foreground, accent, and visualization palette are separate
   concerns. A background color is not a chart palette.
4. Editor preview and live rendering use the same theme resolver.
5. Runtime rendering is fail-safe. Invalid or legacy values fall back to known-safe
   values instead of producing unreadable output.
6. Theme changes are draftable, revision-aware mutations and follow the same conflict
   behavior as other Editor settings.
7. Projector readability has priority over decorative effects.

## Persisted contract

Presentation settings may contain:

- `background_color`: six-digit hexadecimal color.
- `background_image_url`: optional HTTP(S) resource URL.
- `text_color`: six-digit hexadecimal foreground color.
- `accent_color`: six-digit hexadecimal accent used for emphasis and as the first
  visualization color.
- `visualization_palette`: three to eight six-digit hexadecimal colors.
- `music_url`: existing presentation audio setting.

Preset identity is intentionally not persisted. Applying a preset stores its concrete
colors. This prevents a future edit to a built-in preset from silently changing old
presentations and keeps saved Sessions visually reproducible.

## Theme presets

The Editor exposes a compact curated gallery. Presets define background, foreground,
accent and visualization palette together. A preset is considered selected only when
the current draft exactly matches its persisted visual values.

Users may then customize background, foreground, accent or palette. Customized themes
remain valid presentation themes; they simply no longer match a built-in preset.

## Accessibility and projection

- Target WCAG 2.2 AA contrast for primary text: at least 4.5:1.
- The shared runtime resolver chooses a safe foreground when persisted legacy values
  do not meet the contrast floor.
- The Editor keeps color controls synchronized with the resolved readable foreground,
  so saved output and preview do not disagree.
- Background-image overlays adapt to the foreground polarity. Light text receives a
  darkening overlay; dark text receives a lightening overlay.
- Decorative background gradients must not materially reduce contrast in any region.
- Color is never the only indication of correctness, error or selection.

Large-room projection is a first-class constraint. Theme QA therefore includes both
light and dark presets, image backgrounds, low-quality projectors, and the existing
no-scroll Stage contract.

## Visualization colors

Charts, answer bars and Word Cloud terms should use the presentation visualization
palette when a live presentation context is available. Identity/avatar colors remain
separate because they encode stable participant identity rather than presentation
branding.

Palette assignment is deterministic. The same answer/term must not change color during
a live Session because responses arrive or the viewport changes.

## Live-session behavior

A live Session uses the frozen presentation settings captured when the Session starts.
Background, foreground, accent and visualization palette are therefore part of the
public display-only presentation metadata returned to participant, manager and Stage
clients.

Editing the source presentation after a Session starts must not restyle that Session.

## Editor UX

The Design inspector order is:

1. curated theme gallery with immediate draft preview;
2. custom background, text and accent colors;
3. visualization palette;
4. optional background image;
5. representative projection preview and contrast status;
6. save/discard/conflict actions.

The UI should favor recognition over hexadecimal entry, but always show canonical hex
values for precise brand work. Native color inputs remain an enhancement, not the only
way state is communicated.

## Backend validation

The API validates every known theme field even though presentation settings allow
forward-compatible additional properties. Invalid known values are rejected before
persistence.

Visualization palettes have bounded size to prevent unbounded settings payloads and
must contain only six-digit hex colors.

## Test coverage

Required automated coverage for material theme changes:

- backend validation for accent and palette;
- OpenAPI/generated type parity;
- theme resolver fallback and contrast behavior;
- draft reducer serialization/dirty state;
- preset application;
- live metadata propagation through Session snapshots;
- deterministic palette use in projection components where practical.

Browser verification should cover one light and one dark theme in the Editor and Stage,
including a background image. Static visual baselines are only added if the surface is
stable enough to provide signal.

## Future extensions

The contract leaves room for logo, font family, background media upload, workspace
brand kits, and per-slide override layers. Those features should extend the same theme
object rather than bypassing it with component-local styling.
