# Current project status

Last reviewed: 2026-09-30

This is the only mutable project-status document. Durable architecture belongs
in architecture/ADR documents; operational procedures belong in runbooks;
completed delivery history belongs in `archive/`.

## Current product foundation

ProSlides is a pre-production interactive-presentation platform.

The current implementation uses:

- React/Vite with application source in TypeScript/TSX;
- frontend ownership following `app -> modules -> shared`;
- a Go modular monolith;
- PostgreSQL as durable product truth;
- Redis only for operational/ephemeral coordination;
- HTTP for commands/queries and SSE for server-to-client live delivery;
- an in-monolith media bounded context with PostgreSQL metadata and external
  object storage for authored image binaries.

The current product/domain model is the ProSlides v2 model documented in
`../v2-product-architecture.md` and ADR 0004: authored Content and Activity
Items, presenter-paced Sessions, separate Activity results and cumulative
ranking, Stage/Backstage/Participant projections, and Session-first reports.

The planned V2.1-V2.8 repository delivery program is complete. Repository
hardening continued with targeted Live resilience work and Word Cloud projection
hardening, including participant/Stage recovery, replay-cursor safety,
pending-answer retry, manager roster recovery/order consistency, duplicate
presenter-command guards, projector-aware deterministic Word Cloud rendering, and
separation of presenter-private Backstage from the audience projection. Backstage can
read bounded count-only response progress while an Activity is accepting without
exposing aggregate answer content. Word Cloud now also has durable, non-destructive,
Session-scoped moderation: hidden canonical terms are removed consistently from live and
report aggregates while authorized raw response history remains intact. The completed
execution plan is archived in
`../archive/v2-delivery-plan-2026-09.md`.

## Verified repository baseline

The accepted repository baseline is the current `main` only when its required
checks are green. GitHub Actions/check history is authoritative for moving
commit/run identifiers; this document intentionally does not copy them.

- required `api` and fail-closed aggregate `web` checks are active;
- browser E2E runs on pull requests and pushes to `main`;
- three stable deterministic public surfaces have versioned Playwright visual
  baselines;
- dependency/export/dead-code checks are enforced;
- production configuration fails closed on unsafe datastore/public-origin
  settings;
- PostgreSQL backup/restore and ended-Session replay-retention drills run in CI;
- the final-v2 k6 scenario and SQL reconciliation harness use canonical Activity
  lifecycle/result/ranking semantics;
- Live runtime recovery distinguishes HTTP/session reachability from SSE
  liveness, replays only from fully applied cursors, explicitly resynchronizes
  after browser/network recovery, retries pending participant answers with
  stable idempotency keys, and prevents stale participant/manager projections
  during terminal or ranking transitions.

Repository-level migration/hardening boundaries are not currently blocking
release readiness.

Presentation theming is surface-aware: Stage retains authored background
imagery, manager views apply stronger readability protection, and participant
mobile views preserve the theme without downloading the decorative background.
The media slice now includes upload-first immutable background assets plus an
owner-scoped recent-media picker, thumbnail delivery and same-owner digest reuse,
so a background can be used in multiple Presentations without another upload.
Focal-point placement and broader responsive variants remain follow-up work.

## Release boundary

The project is **not production-certified**.

The remaining V2.8 / GitHub issue #90 gates require named-environment evidence
and must not be replaced by local Docker or shared GitHub-runner claims:

1. record the production-like topology and immutable commit/image pair;
2. pass the final-v2 1k workload twice consecutively through TLS ingress with
   hard SQL reconciliation and continuous application/database telemetry;
3. fix measured bottlenecks and repeat the 1k gate before increasing scale;
4. pass the applicable 5k and 10k gates on the intended multi-API topology,
   including reconnect and response bursts without sticky-session assumptions;
5. wire deployment dashboards/alerts and verify at least one alert path end to
   end;
6. verify provider snapshot/PITR and perform a production-volume restore drill,
   recording measured RPO/RTO;
7. verify public TLS ingress, private-only API metrics exposure, rollout/drain,
   immutable-image rollback and functional smoke on the intended platform;
8. perform the final release-readiness review against one immutable
   commit/image pair and record the evidence references.

Only after those environment gates pass should issue #90 and the v2 umbrella
issue #82 be closed.

## Pull-request verification

The main ruleset requires `api` and `web`.

- `api`: Go tests/vet/race and backend contract/configuration checks.
- `web-fast`: dependency review, generated API types, lint, TypeScript,
  architecture checks, unit/component tests, dead-code/export/dependency checks
  and production build.
- `browser-e2e`: real Compose/API/Playwright critical flows, restore and
  retention drills.
- required `web`: runs with `if: always()` and fails unless both
  `web-fast` and `browser-e2e` report success.

A failed/skipped browser job therefore cannot satisfy the required web gate.

High-risk live/domain changes additionally protect idempotency, state-version
conflicts, frozen Session definitions, deadline authority, reconnect recovery
and participant non-disclosure at the smallest useful test layer.

## Current non-blocking debt

The authoritative frontend debt register is `../frontend-debt.md`.

Important remaining items are non-blocking for the repository baseline:

- some mature UI surfaces still carry older styling/direction details;
- component/API-state matrices remain selective outside high-risk behavior;
- the live frontend still has a historical question-shaped internal projection
  over the canonical v2 protocol; it is an implementation refactor debt, not a
  second public/live protocol;
- visual regression remains intentionally selective for deterministic stable
  surfaces;
- major framework/toolchain upgrades remain separate from release hardening.

Do not turn these items into broad cleanup programs unless they solve a measured
product, correctness, accessibility or maintenance problem.

## Scope locks

For the current v2.0 product generation:

- presenter-paced live only;
- individual participation only;
- no team mode;
- no self-paced/assignment mode;
- no parallel internal `/api/v2`;
- no generic workflow DSL;
- no microservice/broker/new-datastore rewrite without measured need.

Changing one of these requires a deliberate product/architecture decision, not
an incidental implementation change.
