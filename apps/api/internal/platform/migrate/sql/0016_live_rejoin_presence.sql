-- Track when a participant's last SSE stream closed so the same session can
-- restore their existing participant record (id, answers, score) on rejoin. The
-- column is set when a participant SSE stream ends and cleared when the
-- participant rejoins, restores, or opens a new stream. Restoring a record does
-- not change participant_count; a new run creates a new session and fresh rows.
ALTER TABLE participants
    ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ;