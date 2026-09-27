-- Count active participant SSE streams so closing one browser tab or one
-- reconnect attempt cannot mark the participant disconnected while another
-- stream for the same credential is still alive.
--
-- Existing disconnected_at remains the durable "no live stream remains"
-- marker used by same-session display-name restore. New code updates both
-- fields atomically. Existing rows start at zero; connected participants still
-- have disconnected_at = NULL until their streams reconnect through the new
-- runtime, while already-disconnected participants retain their timestamp.

ALTER TABLE participants
    ADD COLUMN active_sse_connections INTEGER NOT NULL DEFAULT 0;

ALTER TABLE participants
    ADD CONSTRAINT participants_active_sse_connections_nonnegative
    CHECK (active_sse_connections >= 0);
