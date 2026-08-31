-- The whole schema, in one file.
--
-- Squashed on 2026-08-31 from migrations 001–017, before any instance held
-- data worth keeping. Those files are in git history, and the reasoning worth
-- keeping is either repeated below or in ARCHITECTURE.md; four of them existed
-- only to backfill rows or rebuild a table to widen a CHECK, and could never
-- run again on a fresh database.
--
-- Column order is preserved exactly as replaying 001–017 produced it, so the
-- squash can be verified against the old sequence rather than trusted. Where a
-- column arrived late by ALTER TABLE it sits at the end of its table, noted.
--
-- After this, the rule is the ordinary one: never edit an applied migration,
-- add a new numbered file. The runner tracks them by filename, so an edit to
-- this file would silently never reach a database that already has it.

-- One browser, one row. `token` is the value inside the signed cookie and is
-- stored in clear: whoever presents it is that person, which is why a copy of
-- this table is a copy of everyone's session. See ARCHITECTURE.md §What a
-- cookie is, exactly.
CREATE TABLE identities (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,                   -- value inside the signed cookie
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ics_token TEXT                                -- calendar-feed capability token
);
CREATE UNIQUE INDEX idx_identities_ics_token
  ON identities(ics_token) WHERE ics_token IS NOT NULL;

-- Many events live in one database and one process; every query below is
-- scoped by event_id.
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL,                       -- IANA, e.g. 'Europe/Berlin'
  start_date TEXT NOT NULL,                     -- 'YYYY-MM-DD'
  end_date TEXT NOT NULL,
  day_start_min INTEGER NOT NULL DEFAULT 480,   -- calendar viewport, 08:00
  day_end_min INTEGER NOT NULL DEFAULT 1320,    -- 22:00
  viewer_pw_hash TEXT NOT NULL,
  user_pw_hash TEXT NOT NULL,
  admin_pw_hash TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  -- Added after 001, in this order.
  user_role_label TEXT NOT NULL DEFAULT 'attendee',   -- what this event calls its middle role
  week_rail_from INTEGER NOT NULL DEFAULT 8,          -- days before the day tabs become a week rail
  audit_keep INTEGER NOT NULL DEFAULT 1000            -- audit rows kept; 0 keeps everything
);

-- A role is per event, never global. Signing out of an event deletes the row
-- here and nothing else, which is what lets authorship survive it.
CREATE TABLE roles (
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  role TEXT NOT NULL CHECK (role IN ('viewer','user','speaker','admin')),
  granted_at TEXT NOT NULL,
  PRIMARY KEY (identity_id, event_id)
);

-- A display name identifies one person inside one event, not across the
-- instance: two unconferences a year apart have no business fighting over
-- "Ada". Its own table rather than a column on `roles`, because signing out of
-- an event must not hand your name to someone else.
CREATE TABLE event_identities (
  event_id INTEGER NOT NULL REFERENCES events(id),
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  display_name TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (event_id, identity_id)
);
CREATE UNIQUE INDEX event_identities_name ON event_identities (event_id, display_name);

-- Per-event overrides of who may do what. Admin is forced back on for every
-- capability in code — an event nobody can moderate has no way back.
CREATE TABLE event_permissions (
  event_id INTEGER NOT NULL REFERENCES events(id),
  capability TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer','user','speaker','admin')),
  allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)),
  PRIMARY KEY (event_id, capability, role)
);

CREATE TABLE rooms (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  capacity INTEGER,
  open_booking INTEGER NOT NULL DEFAULT 0,        -- users may schedule here
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  color TEXT NOT NULL DEFAULT '#BFD7E8'           -- added after 001
);
CREATE INDEX idx_rooms_event ON rooms(event_id);

-- Thematic strands across rooms and days. Optional: with none, the schedule
-- lays its columns out by room and never mentions them.
CREATE TABLE tracks (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);
CREATE UNIQUE INDEX tracks_event_name ON tracks (event_id, name);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',        -- hex, used for chips/blocks
  deleted_at TEXT,
  UNIQUE (event_id, name)
);

-- Speaker and host profiles, per event. `sessions.speaker` was free text and
-- stays as a historical record; `speaker_id` is the source of truth.
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
-- One profile per person per event, among profiles that still exist. Covering
-- deleted rows too meant a tombstone held its owner's slot forever, and their
-- next profile edit failed with a constraint error they could not get past.
CREATE UNIQUE INDEX idx_people_identity
  ON people(event_id, identity_id) WHERE identity_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  type TEXT NOT NULL CHECK (type IN ('official','open')),
  title TEXT NOT NULL,                          -- 1..120 chars
  description TEXT NOT NULL DEFAULT '',         -- markdown, <= 5000 chars
  speaker TEXT NOT NULL DEFAULT '',             -- free text, <= 120 chars
  starts_at TEXT NOT NULL,                      -- UTC ISO, snaps to 5 min in event TZ
  ends_at TEXT NOT NULL,                        -- > starts_at, duration >= 5 min
  created_by INTEGER NOT NULL REFERENCES identities(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  -- Added after 001, in this order.
  speaker_id INTEGER REFERENCES people(id),
  livestream_url TEXT NOT NULL DEFAULT '',
  track_id INTEGER REFERENCES tracks(id)
);
CREATE INDEX idx_sessions_event_time ON sessions(event_id, starts_at);
CREATE INDEX idx_sessions_room ON sessions(room_id);
CREATE INDEX idx_sessions_speaker ON sessions(speaker_id);
-- Unprefixed, unlike its neighbours: named that way when tracks arrived, and
-- kept here because renaming an index is a schema change like any other.
CREATE INDEX sessions_track ON sessions (track_id);

CREATE TABLE session_tags (
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (session_id, tag_id)
);

-- Notes, links and questions attendees add to a session.
CREATE TABLE contributions (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  kind TEXT NOT NULL CHECK (kind IN ('note','link','question')),
  body TEXT NOT NULL,                           -- 1..2000 chars; for links: label
  url TEXT,                                     -- required iff kind='link'; http(s) only
  created_by INTEGER NOT NULL REFERENCES identities(id),
  created_at TEXT NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0,            -- admin moderation
  deleted_at TEXT
);
CREATE INDEX idx_contributions_session ON contributions(session_id);

-- A personal agenda. Never broadcast and never attributed in any payload —
-- only aggregate counts leave the server.
CREATE TABLE stars (
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (identity_id, session_id)
);
CREATE INDEX idx_stars_session ON stars(session_id);

-- Pitches: a session that wants a slot but has none yet. A separate table
-- rather than a nullable room and time on `sessions`, so nothing that renders
-- the grid has to special-case a session with nowhere to be.
CREATE TABLE proposals (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  title TEXT NOT NULL,                       -- 1..120 chars
  description TEXT NOT NULL DEFAULT '',      -- markdown, <= 5000 chars
  speaker_id INTEGER REFERENCES people(id),
  created_by INTEGER NOT NULL REFERENCES identities(id),
  -- Set once an organiser turns the pitch into a real session.
  placed_session_id INTEGER REFERENCES sessions(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_proposals_event ON proposals(event_id);

CREATE TABLE proposal_tags (
  proposal_id INTEGER NOT NULL REFERENCES proposals(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (proposal_id, tag_id)
);

CREATE TABLE proposal_interest (
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  proposal_id INTEGER NOT NULL REFERENCES proposals(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (identity_id, proposal_id)
);
CREATE INDEX idx_proposal_interest_proposal ON proposal_interest(proposal_id);

-- Cross-device continuity without accounts. A device phrase (person_id NULL)
-- is three words, single use, ten minutes; a speaker code (person_id set) is
-- four words and lives until revoked. Both are stored hashed — not because the
-- database is hostile territory, but because a code that leaks via a screen
-- share should not still be typeable.
CREATE TABLE link_codes (
  id INTEGER PRIMARY KEY,
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  person_id INTEGER REFERENCES people(id),      -- set = speaker code
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT,                              -- NULL = until revoked
  used_at TEXT                                  -- burns device codes; a stamp on speaker codes
);
CREATE INDEX idx_link_codes_identity ON link_codes(identity_id);
CREATE UNIQUE INDEX idx_link_codes_person ON link_codes(person_id) WHERE person_id IS NOT NULL;

-- The write log. Nothing in the app updates or deletes a row; the only removal
-- is the per-event retention cap in `events.audit_keep`. Rows with no event_id
-- belong to the instance rather than an event and are never pruned.
CREATE TABLE audit (
  id INTEGER PRIMARY KEY,
  identity_id INTEGER REFERENCES identities(id),
  event_id INTEGER REFERENCES events(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  at TEXT NOT NULL
);
CREATE INDEX idx_audit_event_at ON audit(event_id, at);
-- Pruning walks ids, not timestamps: two writes in the same second are ordered
-- by id alone.
CREATE INDEX idx_audit_event_id ON audit(event_id, id);
