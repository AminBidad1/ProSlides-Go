# ADR 0005: Word Cloud projection, disclosure, and rendering policy

Status: Accepted

Date: 2026-09-29

## Context

Word Cloud is both an audience-input Activity and a data visualization. In ProSlides, the
primary Manager presentation surface is commonly mirrored to a projector, so it must be
treated as audience-visible in the same way as Stage. Backstage is the presenter-only
surface.

Competing products use both reveal-after-response and live-growing Word Clouds. Live
display can be useful for brainstorming and icebreakers, but it also exposes prior
answers while later participants are still responding. At large audience sizes, rendering
or broadcasting every answer also creates unnecessary visual churn and fanout pressure.

The current live model already separates Stage, Backstage, and Participant projections,
computes Activity results at close, keeps closed results private to Manager/Backstage,
and exposes them to Stage/participants after reveal. This is the correct disclosure
boundary to preserve.

## Decision

### Audience disclosure

- The default Word Cloud result policy is **reveal after response collection**.
- Stage and the shared Manager presentation surface are both audience-visible projection
  surfaces. Neither may expose Word Cloud terms while the Activity is accepting responses
  under the default policy.
- Backstage may inspect closed aggregate results before reveal. Future moderation and
  private preview capabilities belong in Backstage, not on the projected Manager surface.
- Participant devices must not receive aggregate terms before reveal under the default
  policy.

A future live-growing Word Cloud is an explicit result-presentation policy, not an
implicit side effect of receiving answers. Adding it must preserve role-scoped
projections. Raw answers must never be broadcast to Stage. Any live aggregate delivery
must be bounded, coalesced/batched, and measured against the live-capacity plan.

### Large audiences

- Durable accepted responses remain authoritative in PostgreSQL regardless of how many
  terms fit on a projector.
- The result API may return a bounded ranked aggregate. Projection rendering applies a
  second viewport/readability budget and may omit low-priority terms that cannot be shown
  legibly.
- Stage never shrinks text indefinitely merely to display every unique response.
- Frequency, not arrival order, is the primary importance signal. Equal-frequency layout
  must be deterministic so refresh/reconnect does not arbitrarily reshuffle visibility.
- Future full exports/moderation tools operate on durable response data and are not
  constrained by the projector term budget.

### Visual encoding

- Font size is the primary frequency encoding and uses a compressed scale (square-root
  style) so one dominant term does not consume the entire frame.
- Projected Word Clouds use a higher minimum readable size than embedded/report/mobile
  views.
- Color is decorative separation between **terms**, not participant identity or another
  data dimension. A term receives a deterministic palette slot derived from its text.
- Frequency is not encoded by reducing opacity. Small terms retain strong contrast.
- Persian/mixed-script terms remain horizontal.
- Placement is deterministic, center-biased by importance, collision-aware, and stable
  for the same input. Random re-layout on every render is prohibited.
- Browser rendering should measure the actual presentation font when available, with a
  conservative deterministic fallback when measurement is unavailable.
- Reveal motion is brief and nonessential; reduced-motion preferences suppress it.

### Extensibility boundary

Do not persist a generic bag of Word Cloud feature flags. When a real capability is
implemented, extend the concrete result-presentation/moderation policy with explicit,
versioned semantics. Likely future capabilities include:

- live aggregate display for brainstorming;
- presenter moderation/approval;
- profanity/filtering policy;
- richer aggregate metadata such as total unique terms;
- alternate visual density profiles for different projection contexts.

These capabilities must reuse the existing Activity lifecycle and Stage/Backstage/
Participant projection model rather than creating a second live engine.

## Consequences

- The current presenter-controlled reveal flow remains the product default.
- The first implementation slice can improve projector rendering without changing the
  external live protocol or database schema.
- The shared Word Cloud renderer needs an explicit projection/embedded display mode.
- Future live Word Cloud work will require a deliberate API/event contract and load
  evidence rather than exposing the existing private result event to Stage.
- Moderation remains possible without weakening the audience-safe Manager projection.
