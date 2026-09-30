# Media storage provider migration

This runbook implements the operational boundary in ADR 0006. Object-storage
provider changes are controlled cutovers, not automatic failover. Presentation,
Session and report data must not be rewritten during a provider change.

## Invariants

- keep the destination bucket private;
- preserve every ProSlides object key exactly;
- keep browser-visible media URLs on the ProSlides API;
- do not compare providers by ETag;
- do not dual-write during ordinary operation;
- keep the source bucket unchanged for the rollback window;
- keep CDN selection separate from object-storage selection.

## Provider configuration

Production uses the generic S3 configuration:

```text
MEDIA_STORAGE_BACKEND=s3
MEDIA_S3_ENDPOINT=
MEDIA_S3_REGION=
MEDIA_S3_BUCKET=
MEDIA_S3_ACCESS_KEY_ID=
MEDIA_S3_SECRET_ACCESS_KEY=
MEDIA_S3_FORCE_PATH_STYLE=false
```

For Cloudflare R2, use the account S3 endpoint, R2 S3 access-key credentials and
region `auto`.

For Arvan Object Storage, use the endpoint, region and S3 credentials shown by
the Arvan account. Do not hardcode an Arvan-specific addressing rule in the
application. Prove the required value of `MEDIA_S3_FORCE_PATH_STYLE` with the
provider smoke.

## Provider capability smoke

The manual GitHub workflow
`.github/workflows/media-storage-provider-smoke.yml` verifies the minimum
provider contract: Put, exact-byte Get, Delete, then a failed Get for the deleted
key.

Create these GitHub environments before running it:

- `media-r2-smoke`
- `media-arvan-smoke`

Each environment provides non-secret variables:

```text
MEDIA_S3_ENDPOINT
MEDIA_S3_REGION
MEDIA_S3_BUCKET
MEDIA_S3_FORCE_PATH_STYLE
```

and secrets:

```text
MEDIA_S3_ACCESS_KEY_ID
MEDIA_S3_SECRET_ACCESS_KEY
```

Use a dedicated private smoke bucket or tightly scoped credentials. A provider
is operationally supported only after its own environment has passed this
workflow.

The same command can be run directly from `apps/api`:

```bash
go run ./cmd/media-storage-smoke
```

## Destination reconciliation

Bulk-copy tooling moves bytes. ProSlides verifies whether the destination is
safe to cut over.

Run the reconciliation command from a trusted environment that can reach the
production PostgreSQL database and the destination object store:

```bash
cd apps/api
DATABASE_URL='postgres://...' \
MEDIA_S3_ENDPOINT='https://...' \
MEDIA_S3_REGION='...' \
MEDIA_S3_BUCKET='...' \
MEDIA_S3_ACCESS_KEY_ID='...' \
MEDIA_S3_SECRET_ACCESS_KEY='...' \
MEDIA_S3_FORCE_PATH_STYLE='false' \
go run ./cmd/media-reconcile
```

Optional bounds:

```text
MEDIA_RECONCILE_CONCURRENCY=8
MEDIA_RECONCILE_TIMEOUT=15m
MEDIA_RECONCILE_OBJECT_TIMEOUT=20s
```

The command checks every ready master and rendition recorded in PostgreSQL.
Masters must match both durable byte size and SHA-256. Renditions must match
their durable byte size. Missing objects, read failures and mismatches are
reported with asset/object identity and cause a non-zero exit.

Do not treat cross-provider ETag equality as proof of integrity.

## R2 to Arvan cutover

1. Pass the Arvan provider smoke against the exact destination configuration.
2. Prepare the private destination bucket and migration credentials.
3. Start Arvan One-Time Copy from the R2 S3-compatible source while normal
   operation continues.
4. At final cutover, prevent new media writes for the short final-copy window.
5. Run the final copy while preserving object keys.
6. Run `media-reconcile` against Arvan and require a clean result.
7. Change only the `MEDIA_S3_*` deployment configuration.
8. Start the API and verify upload, library reuse, master/rendition delivery and
   a representative Stage/participant presentation.
9. Verify the selected CDN caches successful immutable media responses as
   intended.
10. Keep R2 unchanged through the rollback window.

Rollback consists of restoring the prior `MEDIA_S3_*` configuration while the
source bucket remains intact.

## Arvan to R2 cutover

Use the same cutover sequence, with Cloudflare Super Slurper as the bulk-copy
mechanism for an S3-compatible source.

Sippy is not a default dependency of this runbook. Consider it only after a real
Arvan-source compatibility smoke proves the required behavior for the exact
source configuration.

## Failure handling

Do not cut over when reconciliation is incomplete, times out, or reports any
missing/mismatched object. Restore writes to the current provider, diagnose the
copy gap, repeat the final copy and rerun reconciliation.

A provider outage during normal API operation continues to surface through the
existing `media_storage_unavailable` boundary. SDK retries are bounded by the
request context and do not create an automatic second-provider failover path.
