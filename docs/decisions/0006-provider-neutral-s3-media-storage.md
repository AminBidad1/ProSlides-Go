# ADR 0006: Provider-neutral S3-compatible media storage

Status: Accepted for implementation

Date: 2026-09-30

Tracking issue: #196

## Context

ProSlides now has one mature image-media bounded context. PostgreSQL owns
immutable asset/rendition metadata, while binary bytes live behind
`media.ObjectStore`. Presentation, Session and report data refer to opaque Media
Asset identities and stable first-party delivery URLs such as
`/api/v1/media/assets/{id}/content`; provider URLs are not product truth.

The current production implementation is nevertheless provider-specific:

- `MEDIA_STORAGE_BACKEND=r2` is required in production;
- `R2ObjectStore` talks to Cloudflare's REST object API with a Bearer token;
- deployment configuration contains R2-specific account/bucket/token fields.

That coupling is no longer useful. Cloudflare R2 exposes an S3-compatible API,
and Arvan Object Storage exposes S3-compatible credentials/endpoints. The
project owner may use either provider depending on access, cost and deployment
conditions and may use Arvan CDN independently of the selected object-storage
provider.

Provider portability must not leak into Presentation authoring, Live Session
state, report data or browser-visible media identities.

## External constraints verified before this decision

The following provider behavior was reviewed on 2026-09-30 and is an external
constraint, not a ProSlides guarantee.

### Cloudflare R2

- R2 exposes its S3-compatible API at
  `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
- R2 supports the object operations required by the current ProSlides
  `ObjectStore` boundary.
- Cloudflare recommends its S3-compatible API or Workers API for
  high-throughput object access rather than the dashboard-oriented REST API.
- R2 S3 authentication uses an Access Key ID and Secret Access Key generated
  for R2; it is not the existing Cloudflare REST Bearer-token contract.
- R2 uses the S3 region value `auto` for ordinary S3 SDK configuration.
- Super Slurper can perform a one-time import from S3-compatible sources.
- Sippy can support gradual/on-read migration into R2, but source-provider
  compatibility must be verified before relying on it.
- Cloudflare explicitly warns that migrated ETags are not guaranteed to match
  source ETags, so ETag equality is not a cross-provider integrity check.

### Arvan Object Storage

- Access Management exposes an endpoint plus Access Key / Secret Key for
  S3-compatible clients.
- Bucket region is a provider/deployment value and must not be hardcoded in
  application logic; deployment should use the endpoint/region shown by the
  provider account.
- Arvan's Cloud Storage Migration service accepts S3-compatible sources using
  endpoint and credentials.
- One-Time Copy is currently available. Continuous Sync is documented as a
  future capability rather than an available cutover primitive.
- Arvan documents retrying transient 5xx storage errors.
- Arvan CDN can be used with Object Storage, but CDN selection is operational
  delivery configuration rather than a media-domain concern.

### AWS SDK for Go v2

The AWS SDK for Go v2 supports custom S3-compatible endpoints. The preferred
modern endpoint mechanism is `BaseEndpoint` while retaining the default S3
endpoint resolver. S3 addressing behavior can be configured, including
path-style requests where a provider requires them.

## Decision

### 1. One generic production object adapter

Replace the provider-specific Cloudflare REST object adapter with one generic
S3-compatible `S3ObjectStore` implemented with AWS SDK for Go v2.

The media application/domain boundary remains:

```go
type ObjectStore interface {
    Put(context.Context, string, string, []byte) error
    Open(context.Context, string) (io.ReadCloser, error)
    Delete(context.Context, string) error
}
```

Provider concepts must not be added to Presentation, Live or report code.

The target backend set is:

```text
filesystem   local/development
s3           production S3-compatible object storage
memory       tests only
```

Cloudflare R2 and Arvan Object Storage are configurations of `s3`, not separate
product backends.

### 2. Planned configuration boundary

The implementation is expected to introduce configuration equivalent to:

```text
MEDIA_STORAGE_BACKEND=s3
MEDIA_S3_ENDPOINT=
MEDIA_S3_REGION=
MEDIA_S3_BUCKET=
MEDIA_S3_ACCESS_KEY_ID=
MEDIA_S3_SECRET_ACCESS_KEY=
MEDIA_S3_FORCE_PATH_STYLE=false
```

These names are design intent until #196 implements them. The implementation PR
must make the checked-in env examples and `docs/configuration.md` authoritative.

Rules:

- endpoint must be HTTPS in production;
- credentials are API/server secrets and must never enter Vite/browser
  configuration, public health payloads or logs;
- bucket remains private;
- region and addressing mode are deployment values;
- application code must not branch on provider names such as `arvan` or
  `cloudflare`;
- provider-specific endpoint strings must not be persisted in product tables.

Cloudflare deployment uses the R2 S3 endpoint, S3 Access Key ID / Secret Access
Key and region `auto`.

Arvan deployment uses the endpoint, region and S3 credentials supplied by the
Arvan account. Addressing mode must be proven by a real provider smoke rather
than inferred from a hardcoded provider-name branch.

### 3. Keep public media identity first-party and stable

Browser-visible media URLs remain ProSlides URLs:

```text
/api/v1/media/assets/{assetId}/content
/api/v1/media/assets/{assetId}/renditions/{variant}
```

A storage-provider switch therefore does not rewrite:

- Presentation image placements;
- frozen Session definitions;
- report references;
- asset IDs;
- public delivery URLs.

Object keys remain immutable and provider-neutral. A migration copies the same
keys to the destination provider.

### 4. CDN is independent from object storage

CDN selection is not part of `ObjectStore`.

A supported topology may therefore be:

```text
viewer -> Arvan CDN -> ProSlides media URL -> API -> Cloudflare R2
```

or:

```text
viewer -> Arvan CDN -> ProSlides media URL -> API -> Arvan Object Storage
```

The existing media responses are immutable and cacheable. Deployment smoke must
verify the chosen CDN actually caches successful media responses and does not
accidentally bypass cache because of cookies or response configuration.

Direct browser delivery from a provider bucket is not introduced by this
decision.

### 5. Bounded retry and failure semantics

Use the AWS SDK's normal signing/error/retry machinery instead of hand-written
SigV4 or provider-specific HTTP code.

Retries must remain bounded by request context/deadlines. Persistent provider
failure continues to map to the existing media failure boundary, including
`media_storage_unavailable`; a storage retry must never stall live navigation
or scoring indefinitely.

### 6. Provider switch is a controlled migration, not automatic failover

ProSlides will not dual-write every upload to R2 and Arvan and will not
automatically fail over between providers.

The safe default cutover is:

1. prepare and validate the destination bucket;
2. prevent new media writes for the short final-copy/cutover window;
3. copy objects while preserving object keys;
4. reconcile the destination against PostgreSQL media metadata;
5. switch S3 deployment configuration;
6. run functional media smoke;
7. retain the source bucket unchanged for a rollback window.

R2 -> Arvan may use Arvan's One-Time Copy service.

Arvan -> R2 may use Cloudflare Super Slurper. Sippy is an optional future
low-downtime cutover aid only after a real Arvan-source compatibility smoke.

The application does not implement its own bulk-copy engine while provider
migration tooling is adequate.

### 7. Migration verification uses ProSlides truth, not ETag equality

Cross-provider ETag equality is explicitly not trusted.

For master objects, verification can use the SHA-256 and byte size already
stored in `media_assets`.

For rendition objects, current durable metadata provides object key, byte size,
dimensions and MIME type. A new persistent variant checksum is not added merely
for this migration unless evidence shows it is needed.

The implementation must provide a bounded reconciliation/verification tool or
script suitable for a cutover. It should report missing/mismatched objects and
exit non-zero on an unsafe destination.

### 8. Provider capability smoke is explicit

Normal CI remains provider-independent and must not require real Cloudflare or
Arvan credentials.

The implementation must define opt-in, secret-backed provider smokes for both
R2 and Arvan that at minimum prove:

1. write a unique object;
2. read the exact bytes back;
3. delete it;
4. confirm subsequent read is absent/fails as expected.

A provider is not called "supported" by ProSlides merely because its marketing
page says S3-compatible.

## Implementation sequence

Issue #196 owns delivery. The intended order is:

1. add AWS SDK for Go v2 S3 dependencies;
2. implement/test generic `S3ObjectStore`;
3. replace R2-specific production configuration with generic S3 configuration;
4. update production Compose/env examples and configuration documentation;
5. add provider smoke procedures for R2 and Arvan;
6. add migration reconciliation tooling and operational cutover instructions;
7. keep existing browser media flows unchanged and run all required CI.

No database migration is expected for the adapter change because persisted
object keys and product references are already provider-neutral.

## Rejected alternatives

### Keep the Cloudflare REST adapter and add an Arvan adapter

Rejected because it duplicates signing/retry/error behavior and turns provider
selection into application branching even though both providers expose the same
S3-compatible abstraction.

### Use provider URLs directly in Presentation data

Rejected because it couples durable product data to deployment topology and
would make provider migration rewrite historical Presentations and Sessions.

### Dual-write to R2 and Arvan

Rejected for the current product. It introduces retry queues, consistency
repair, partial-write semantics, ongoing double storage cost and failback
complexity without measured availability need.

### Automatic provider failover

Rejected for now. Automatic failover is unsafe unless data replication
freshness is itself measured and reconciled. A controlled cutover is simpler and
auditable.

### Build an internal migration engine

Rejected while provider-native S3 migration tools satisfy the bulk-copy need.
ProSlides owns verification of its own media truth, not a second generic cloud
copy product.

## Consequences

Positive:

- production is no longer architecturally tied to Cloudflare;
- Arvan and R2 can be selected by configuration;
- Arvan CDN can be chosen independently of storage;
- provider migration does not rewrite product data or public media URLs;
- standard SDK signing/retry behavior replaces custom provider HTTP code.

Costs:

- the production credential contract changes from the current R2 REST token to
  S3 access-key credentials;
- real-provider smokes are required before claiming support;
- provider migration remains an operational procedure rather than an
  instantaneous toggle;
- deployment owners must preserve source storage during the rollback window.

## External references reviewed

- Cloudflare R2 S3 compatibility:
  https://developers.cloudflare.com/r2/api/s3/api/
- Cloudflare R2 API selection:
  https://developers.cloudflare.com/r2/api/
- Cloudflare R2 S3 setup:
  https://developers.cloudflare.com/r2/get-started/s3/
- Cloudflare Super Slurper:
  https://developers.cloudflare.com/r2/data-migration/super-slurper/
- Cloudflare migration strategies and Sippy:
  https://developers.cloudflare.com/r2/data-migration/migration-strategies/
- AWS SDK for Go v2 endpoint configuration:
  https://docs.aws.amazon.com/sdk-for-go/v2/developer-guide/configure-endpoints.html
- Arvan Object Storage:
  https://docs.arvancloud.ir/fa/object-storage/
- Arvan Cloud Storage migration:
  https://docs.arvancloud.ir/fa/object-storage/migration/
- Arvan CDN caching:
  https://docs.arvancloud.ir/fa/cdn/caching/
