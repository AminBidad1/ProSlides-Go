-- Durable, non-destructive Word Cloud moderation.
--
-- A row records the current visibility policy for one canonical aggregation key.
-- Participant answers remain immutable; public/live result projections consult this
-- table, while authorized reports can still inspect the raw stored responses.

CREATE TABLE IF NOT EXISTS live_word_cloud_moderation (
    session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
    activity_item_id UUID NOT NULL,
    canonical_key TEXT NOT NULL,
    hidden BOOLEAN NOT NULL,
    updated_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (session_id, activity_item_id, canonical_key),
    FOREIGN KEY (session_id, activity_item_id)
        REFERENCES live_session_slides(session_id, slide_id)
        ON DELETE CASCADE,
    CHECK (canonical_key <> ''),
    CHECK (char_length(canonical_key) <= 512)
);

CREATE INDEX IF NOT EXISTS live_word_cloud_moderation_session_item_idx
    ON live_word_cloud_moderation(session_id, activity_item_id)
    WHERE hidden = TRUE;
