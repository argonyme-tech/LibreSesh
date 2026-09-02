-- Asking for the profile an organiser left for you.
--
-- Three routes already ran from "an organiser added Marcel Jackisch as a
-- speaker" to "that profile is mine", and each needed somebody else to act or
-- an exact coincidence of names at the gate: a minted speaker phrase, an
-- organiser merging two profiles, or the gate offering the shell when the
-- username you typed happened to match its full name. This is the missing
-- one: the person says "that is me" and an organiser says yes.
--
-- A request rather than a claim, because a shell is usually credited on
-- sessions, and holding the profile a session credits is the right to rewrite
-- that talk. Left unguarded this would be the cheapest way into somebody
-- else's keynote. Approving one runs exactly the merge an organiser would
-- have run by hand, with the shell surviving.
CREATE TABLE profile_claims (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  person_id INTEGER NOT NULL REFERENCES people(id),
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  requested_at TEXT NOT NULL,
  -- Set when an organiser said no. An approved request is deleted instead:
  -- the merge it caused is the record, and the asker now holds the profile.
  declined_at TEXT
);
CREATE INDEX idx_profile_claims_event ON profile_claims(event_id);
-- One open request at a time. Asking twice is asking once, and a queue of
-- three guesses from one person is not a queue an organiser should have to
-- read.
CREATE UNIQUE INDEX idx_profile_claims_open
  ON profile_claims(event_id, identity_id) WHERE declined_at IS NULL;
