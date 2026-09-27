-- Freeze presentation-level visual/audio settings for new live Sessions.
-- Slides have been immutable per Session since 0015, but Stage/join theming
-- still read the mutable Presentation row. That allowed an editor change made
-- after Session creation to alter an in-progress run.
--
-- Existing Sessions intentionally remain NULL because their original settings
-- were never persisted. Runtime reads fall back to the current Presentation
-- only for those legacy rows.

ALTER TABLE live_sessions
    ADD COLUMN presentation_settings_snapshot JSONB;

ALTER TABLE live_sessions
    ADD CONSTRAINT live_sessions_presentation_settings_snapshot_object
    CHECK (
        presentation_settings_snapshot IS NULL
        OR jsonb_typeof(presentation_settings_snapshot) = 'object'
    );
