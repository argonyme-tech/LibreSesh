-- A display name identifies one person inside one event, not across the whole
-- instance. Two unconferences a year apart have no business fighting over
-- "Ada", and with a single global column, entering an event where your name
-- was taken would have forced you to rename yourself in every other event too.
--
-- So the name hangs off (event, identity). `identities.display_name` stays,
-- demoted to the seed a newcomer is offered at the gate.
--
-- Deliberately its own table rather than a column on `roles`: signing out of
-- an event deletes the roles row, and that must not hand your name to someone
-- else or strip the authorship from everything you already posted.
CREATE TABLE event_identities (
  event_id INTEGER NOT NULL REFERENCES events(id),
  identity_id INTEGER NOT NULL REFERENCES identities(id),
  display_name TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (event_id, identity_id)
);

CREATE UNIQUE INDEX event_identities_name ON event_identities (event_id, display_name);

-- Backfill everyone who has ever held a role in an event. Names already
-- collide today — that is the bug this migration closes — so within an event
-- the earliest identity keeps the bare name and later ones are suffixed with
-- their identity id, which is unique by construction. A user who had literally
-- named themselves "Ada #7" where 7 is another identity's id in the same event
-- would fail this index; the migration would abort at boot rather than corrupt.
INSERT INTO event_identities (event_id, identity_id, display_name, claimed_at)
SELECT event_id,
       identity_id,
       CASE WHEN rn = 1 THEN display_name ELSE display_name || ' #' || identity_id END,
       granted_at
  FROM (
    SELECT r.event_id AS event_id,
           r.identity_id AS identity_id,
           r.granted_at AS granted_at,
           i.display_name AS display_name,
           ROW_NUMBER() OVER (
             PARTITION BY r.event_id, i.display_name
             ORDER BY r.identity_id
           ) AS rn
      FROM roles r
      JOIN identities i ON i.id = r.identity_id
  );
