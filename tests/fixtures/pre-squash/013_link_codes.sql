-- Cross-device continuity without accounts (spec: identity-and-people, A1).
-- A browser identity lives in one cookie jar, so the same person on a phone
-- and a laptop is two strangers to the server. Device A mints a short-lived
-- three-word phrase; device B types it and *adopts* A's identity token — both
-- browsers then carry the same cookie, and role, stars, profile and
-- authorship follow by construction because there is only one identity row.
--
-- The phrase is stored hashed. Not because the DB is hostile territory — it
-- already holds every identity token in clear and the host is trusted — but
-- because a code that leaks via a backup or a screen share should not still
-- be typeable. Single use, ten minutes, and re-minting replaces the previous
-- code, so at most one is ever live per identity.
CREATE TABLE link_codes (
  id INTEGER PRIMARY KEY,
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  code_hash TEXT NOT NULL UNIQUE,               -- sha256 of the normalised phrase
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);
CREATE INDEX idx_link_codes_identity ON link_codes(identity_id);
