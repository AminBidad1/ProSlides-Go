-- Media assets are content, while background/question/content/option are placements.
-- Generalize the asset purpose and move rendition metadata out of background-specific columns.

ALTER TABLE media_assets
    DROP CONSTRAINT IF EXISTS media_assets_purpose_check;

UPDATE media_assets
SET purpose = 'image'
WHERE purpose = 'background';

ALTER TABLE media_assets
    ADD CONSTRAINT media_assets_purpose_check
    CHECK (purpose IN ('image'));

CREATE TABLE media_variants (
    asset_id UUID NOT NULL REFERENCES media_assets(id) ON DELETE CASCADE,
    variant TEXT NOT NULL CHECK (variant IN ('thumbnail', 'medium', 'large')),
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png')),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (asset_id, variant)
);

INSERT INTO media_variants(
    asset_id,
    variant,
    storage_key,
    mime_type,
    width,
    height,
    byte_size,
    created_at
)
SELECT
    id,
    'thumbnail',
    thumbnail_storage_key,
    thumbnail_mime_type,
    CASE
        WHEN GREATEST(width, height) <= 480 THEN width
        ELSE GREATEST(1, ROUND(width::numeric * 480 / GREATEST(width, height))::integer)
    END,
    CASE
        WHEN GREATEST(width, height) <= 480 THEN height
        ELSE GREATEST(1, ROUND(height::numeric * 480 / GREATEST(width, height))::integer)
    END,
    thumbnail_byte_size,
    created_at
FROM media_assets
WHERE thumbnail_storage_key IS NOT NULL
  AND thumbnail_mime_type IS NOT NULL
  AND thumbnail_byte_size IS NOT NULL;

DROP INDEX IF EXISTS media_assets_thumbnail_storage_key_uidx;

ALTER TABLE media_assets
    DROP COLUMN thumbnail_storage_key,
    DROP COLUMN thumbnail_mime_type,
    DROP COLUMN thumbnail_byte_size;
