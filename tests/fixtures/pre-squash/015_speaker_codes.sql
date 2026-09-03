-- Speaker codes: the organiser-on-behalf-of flow. An admin mints a code bound
-- to a people row; whoever types it at the gate *becomes* that person's
-- identity — the same adoption mechanism as device linking, which is why a
-- speaker code works from any number of devices. Unlike a device phrase it
-- has no expiry (NULL) and is not burned on use; it dies when an organiser
-- revokes it (the row is deleted).
--
-- Rebuild rather than ALTER: expires_at loses its NOT NULL.
CREATE TABLE link_codes_new (
  id INTEGER PRIMARY KEY,
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  person_id INTEGER REFERENCES people(id),      -- set = speaker code
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT,                              -- NULL = until revoked
  used_at TEXT                                  -- burns device codes; a stamp on speaker codes
);
INSERT INTO link_codes_new (id, identity_id, code_hash, created_at, expires_at, used_at)
SELECT id, identity_id, code_hash, created_at, expires_at, used_at FROM link_codes;
DROP TABLE link_codes;
ALTER TABLE link_codes_new RENAME TO link_codes;
CREATE INDEX idx_link_codes_identity ON link_codes(identity_id);
CREATE UNIQUE INDEX idx_link_codes_person ON link_codes(person_id) WHERE person_id IS NOT NULL;
