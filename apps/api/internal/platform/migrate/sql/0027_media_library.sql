ALTER TABLE media_assets
    ADD COLUMN thumbnail_storage_key TEXT,
    ADD COLUMN thumbnail_mime_type TEXT
        CHECK (thumbnail_mime_type IS NULL OR thumbnail_mime_type IN ('image/jpeg', 'image/png')),
    ADD COLUMN thumbnail_byte_size BIGINT
        CHECK (thumbnail_byte_size IS NULL OR thumbnail_byte_size > 0);

CREATE UNIQUE INDEX media_assets_thumbnail_storage_key_uidx
    ON media_assets(thumbnail_storage_key)
    WHERE thumbnail_storage_key IS NOT NULL;

CREATE INDEX media_assets_owner_purpose_digest_ready_idx
    ON media_assets(owner_id, purpose, sha256)
    WHERE status = 'ready';
