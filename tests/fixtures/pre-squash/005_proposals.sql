-- The unconference flow: people pitch sessions before a grid exists, then
-- organisers place them on it. Modelled as its own table rather than making
-- sessions.room_id/starts_at nullable — SQLite cannot relax a NOT NULL column
-- without rebuilding the table, and a proposal is genuinely a different thing
-- from a scheduled session anyway.
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

-- Interest in a pitch is what tells an organiser it deserves a room. Same
-- shape as stars on sessions, and equally private per identity.
CREATE TABLE proposal_interest (
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  proposal_id INTEGER NOT NULL REFERENCES proposals(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (identity_id, proposal_id)
);
CREATE INDEX idx_proposal_interest_proposal ON proposal_interest(proposal_id);
