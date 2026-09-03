-- Speakers and hosts become real per-event records so each one can have a
-- profile page. `sessions.speaker` was free text; it stays on the table as a
-- historical record but `speaker_id` is the source of truth from here on.

CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  -- Set when an attendee owns this profile, which is what lets them edit it.
  identity_id INTEGER REFERENCES identities(id),
  name TEXT NOT NULL,                    -- 1..120 chars
  bio TEXT NOT NULL DEFAULT '',          -- markdown, <= 2000 chars
  links TEXT NOT NULL DEFAULT '[]',      -- JSON array of { label, url }
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_people_event ON people(event_id);

-- One profile per person per event; unclaimed profiles are exempt.
CREATE UNIQUE INDEX idx_people_identity
  ON people(event_id, identity_id) WHERE identity_id IS NOT NULL;

ALTER TABLE sessions ADD COLUMN speaker_id INTEGER REFERENCES people(id);
CREATE INDEX idx_sessions_speaker ON sessions(speaker_id);

-- Backfill: every distinct speaker string already on a session becomes a
-- person, and the session points at it. Runs before anyone has a profile, so
-- there is nothing to reconcile.
INSERT INTO people (event_id, name, bio, links, created_at, updated_at)
SELECT DISTINCT
    event_id,
    TRIM(speaker),
    '',
    '[]',
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM sessions
 WHERE TRIM(speaker) <> '';

UPDATE sessions
   SET speaker_id = (
     SELECT p.id FROM people p
      WHERE p.event_id = sessions.event_id AND p.name = TRIM(sessions.speaker)
   )
 WHERE TRIM(speaker) <> '';
