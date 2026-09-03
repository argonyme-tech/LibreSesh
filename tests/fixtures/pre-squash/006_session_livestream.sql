-- A watch-along link for a session: a stream, a call, a recording once it is
-- up. Empty string means "no stream", which is the overwhelming default, so
-- the client hides the field entirely rather than showing an empty row.
ALTER TABLE sessions ADD COLUMN livestream_url TEXT NOT NULL DEFAULT '';
