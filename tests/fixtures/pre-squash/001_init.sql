-- Initial schema. See SPEC §4.
-- All timestamps are UTC ISO-8601 strings. Soft deletes via deleted_at.

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
  created_at TEXT NOT NULL
);

CREATE TABLE identities (
  id INTEGER PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,                   -- value inside the signed cookie
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE roles (
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  role TEXT NOT NULL CHECK (role IN ('viewer','user','admin')),
  granted_at TEXT NOT NULL,
  PRIMARY KEY (identity_id, event_id)
);

CREATE TABLE rooms (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  capacity INTEGER,
  open_track INTEGER NOT NULL DEFAULT 0,        -- users may schedule here
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);
CREATE INDEX idx_rooms_event ON rooms(event_id);

CREATE TABLE tags (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',        -- hex, used for chips/blocks
  deleted_at TEXT,
  UNIQUE (event_id, name)
);

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
  deleted_at TEXT
);
CREATE INDEX idx_sessions_event_time ON sessions(event_id, starts_at);
CREATE INDEX idx_sessions_room ON sessions(room_id);

CREATE TABLE session_tags (
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  tag_id INTEGER NOT NULL REFERENCES tags(id),
  PRIMARY KEY (session_id, tag_id)
);

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

-- Append-only write log for post-hoc cleanup (SPEC §8).
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
