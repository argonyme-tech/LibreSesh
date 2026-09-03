-- Per-event permission matrix. Which roles may do which things is an organiser
-- decision, not a constant: a small unconference may want viewers to comment,
-- a corporate programme may want the opposite.
--
-- Only *overrides* live here. Defaults are in server/src/permissions.ts, so
-- adding a capability later needs no data migration and existing events keep
-- behaving as they did.
CREATE TABLE event_permissions (
  event_id INTEGER NOT NULL REFERENCES events(id),
  capability TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer','user','admin')),
  allowed INTEGER NOT NULL CHECK (allowed IN (0, 1)),
  PRIMARY KEY (event_id, capability, role)
);
