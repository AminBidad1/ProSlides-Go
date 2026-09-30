CREATE TABLE media_assets (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    purpose TEXT NOT NULL CHECK (purpose IN ('background')),
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png')),
    width INTEGER NOT NULL CHECK (width > 0),
    height INTEGER NOT NULL CHECK (height > 0),
    byte_size BIGINT NOT NULL CHECK (byte_size > 0),
    sha256 BYTEA NOT NULL CHECK (octet_length(sha256) = 32),
    status TEXT NOT NULL CHECK (status IN ('processing', 'ready', 'failed')),
    original_filename TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX media_assets_owner_created_idx
    ON media_assets(owner_id, created_at DESC, id DESC);

CREATE INDEX media_assets_failed_created_idx
    ON media_assets(created_at)
    WHERE status = 'failed';
