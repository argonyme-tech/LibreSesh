-- A fourth role: 'speaker', between attendee and organiser. Granted by a
-- speaker code (migration 015), never by a shared password — a shared
-- speaker password would let any speaker post as any other, which is the
-- exact thing the role exists to prevent.
--
-- SQLite cannot widen a CHECK in place, so both tables that pin the role
-- list are rebuilt under the same name. This is the first migration to lean
-- on the runner's rebuild support (foreign_keys off for the file, verified
-- with foreign_key_check before commit). Neither table has secondary
-- indexes to recreate.
CREATE TABLE roles_new (
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  event_id INTEGER NOT NULL REFERENCES events(id),
  role TEXT NOT NULL CHECK (role IN ('viewer','user','speaker','admin')),
  granted_at TEXT NOT NULL,
  PRIMARY KEY (identity_id, event_id)
);
INSERT INTO roles_new SELECT identity_id, event_id, role, granted_at FROM roles;
DROP TABLE roles;
ALTER TABLE roles_new RENAME TO roles;

CREATE TABLE event_permissions_new (
  event_id INTEGER NOT NULL REFERENCES events(id),
  capability TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer','user','speaker','admin')),
  allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)),
  PRIMARY KEY (event_id, capability, role)
);
INSERT INTO event_permissions_new SELECT event_id, capability, role, allowed FROM event_permissions;
DROP TABLE event_permissions;
ALTER TABLE event_permissions_new RENAME TO event_permissions;
