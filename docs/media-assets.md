# Media assets

Status: active implementation contract  
Last reviewed: 2026-09-30

## Purpose

ProSlides media is a bounded context inside the existing Go modular monolith.
PostgreSQL stores durable asset metadata and references. Binary image bytes live
outside PostgreSQL in object storage.

The first delivery slice is presentation background upload. The contract is
intentionally reusable by question, option, Word Cloud and Content images later.

## Core rules

1. An uploaded asset is immutable. Replacing an image creates a new asset.
2. Persisted presentation/session data may reference the immutable asset through
   the stable first-party content URL; storage-provider URLs are never product
   truth.
3. Production object storage is external to the API container. No separate
   application/media server is introduced.
4. The API owns validation and storage writes. Browser preprocessing improves UX
   and normalizes common camera images, but is not a security boundary.
5. Public delivery uses an opaque UUID asset route and immutable cache headers.
   The object-storage bucket stays private.
6. Participant background rendering remains image-free. Background uploads are
   therefore fetched by Stage/manager/editor surfaces, not by every participant.
7. Media failure degrades to the persisted theme base color; it must never break
   live navigation or Session state.
8. A ready asset may be referenced by multiple Presentations owned by the same
   account. Reuse changes only the Presentation reference; it does not copy the
   binary object.
9. The author media library is owner-scoped. Upload deduplication compares the
   normalized SHA-256 only inside that owner and purpose boundary; cross-account
   deduplication is intentionally avoided.
10. Library grids use an immutable thumbnail when available. Stage/manager delivery
    continues to use the master asset.

## Storage topology

Development reference:

Browser -> Go media HTTP -> PostgreSQL metadata
                         -> filesystem object adapter

Production reference:

Browser -> Go media HTTP -> PostgreSQL metadata
                         -> private Cloudflare R2 object adapter

Read path:

Browser -> first-party /api/v1/media/assets/{id}/content
        -> immutable cache/CDN when configured
        -> Go media HTTP
        -> object adapter

The domain depends only on ObjectStore. The initial production adapter uses the
Cloudflare R2 object REST API with a dedicated server-side Cloudflare API token,
so the repository does not take on an S3 SDK just for this first, low-throughput
authoring path. The REST token uses the Workers R2 Storage Write permission.
R2's S3-compatible API remains a valid future adapter when bucket-scoped object
credentials, direct uploads, or higher-throughput delivery justify that change.

## Background upload policy

- accepted author inputs: JPEG or PNG;
- maximum request image bytes: 15 MiB;
- maximum decoded pixels: 16 megapixels;
- maximum dimension: 8192 px on either axis;
- server fully decodes the image before accepting it;
- stored background representation is normalized within the accepted JPEG/PNG family; JPEG uses quality 90 and PNG transparency is preserved;
- re-encoding strips embedded metadata from the delivered asset;
- the official web client also submits a small immutable thumbnail for library
  browsing, preventing the picker from downloading several full-resolution
  background masters at once;
- the official web client downsizes the long edge to at most 3840 px before
  upload, keeps JPEG/PNG semantics (including PNG transparency), and re-encodes
  the image to reduce oversized payloads, strip browser-side metadata, and
  normalize browser-applied camera orientation;
- files are never trusted by extension or client Content-Type.

SVG, animated GIF, HEIC and arbitrary binary uploads are intentionally excluded
from this slice. Supporting them requires a separately reviewed decode/sanitize
pipeline.

## Database contract

media_assets stores:

- immutable UUID;
- owner;
- purpose;
- private storage key;
- normalized MIME type;
- width and height;
- byte size;
- SHA-256 digest;
- processing/ready/failed status;
- original display filename;
- timestamps;
- optional thumbnail object key, MIME type and byte size.

A row is created in processing state before the object write. The asset becomes
servable only after the object write succeeds and the row is marked ready.
Failed or abandoned rows are eligible for future garbage collection.

The owner foreign key is restrictive rather than cascading. Account deletion
must explicitly reconcile Media Assets and any frozen Session references before
the user row can be removed; the database must never delete metadata while
leaving an untracked object in external storage.

## HTTP contract

GET /api/v1/media/backgrounds

- authenticated owner session required;
- returns ready background assets newest first;
- uses an opaque cursor and bounded page size;
- never returns another owner's assets or private storage keys.

POST /api/v1/media/backgrounds

- account session + CSRF required;
- multipart/form-data with required `file` and optional `thumbnail`;
- normalizes the master, computes its digest and reuses an existing ready asset
  owned by the same account when the normalized bytes already exist;
- returns immutable MediaAsset metadata plus stable content/thumbnail URLs.

GET /api/v1/media/assets/{assetId}/content

- public read because live audience displays may need authored media;
- only ready assets are returned;
- UUID is opaque/high entropy;
- response is `Cache-Control: public, max-age=31536000, immutable`;
- no provider credential or storage key is exposed.

GET /api/v1/media/assets/{assetId}/thumbnail follows the same immutable cache
contract and falls back to the master for legacy assets without a thumbnail.

## Failure semantics

- invalid/corrupt/unsupported image -> 400 `invalid_image`;
- upload over limit -> 413 `media_too_large`;
- excessive decoded dimensions -> 400 `image_dimensions_invalid`;
- object storage failure -> 503 `media_storage_unavailable`;
- unknown/non-ready asset -> 404;
- failed upload must never update a presentation background;
- an already ready asset never changes bytes.

## Lifecycle

Assets are reusable across Presentations, so removing a background from one
Presentation only removes that reference. The Editor library intentionally does
not expose asset deletion yet.

Hard deletion and orphan garbage collection remain deferred until reference
accounting covers Presentations and frozen Sessions. Deleting a Presentation
must not immediately delete an asset that another Presentation or historical
Session may still reference.

## Next extensions

1. explicit persisted asset-id references in all authoring image slots;
2. non-destructive focal point metadata for background cover rendering;
3. responsive variants for question/content/option image delivery;
4. reference accounting and safe orphan garbage collection;
5. optional filename search only when library size/usage data justifies it;
6. optional CDN/direct-delivery adapter without changing domain references;
7. Solid / Gradient / Image background-kind persistence.
