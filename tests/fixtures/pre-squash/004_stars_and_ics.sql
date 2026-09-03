-- Personal agenda: which sessions an identity has starred. Purely per-person,
-- so nothing here is broadcast to other clients.
CREATE TABLE stars (
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (identity_id, session_id)
);
CREATE INDEX idx_stars_session ON stars(session_id);

-- Calendar apps cannot send our signed cookie, so a subscription URL carries a
-- capability token instead. Minted on demand, never on sign-up.
ALTER TABLE identities ADD COLUMN ics_token TEXT;
CREATE UNIQUE INDEX idx_identities_ics_token
  ON identities(ics_token) WHERE ics_token IS NOT NULL;
