-- One profile per person per event — but only among profiles that still exist.
--
-- The old index covered soft-deleted rows too, so a tombstone kept holding its
-- owner's slot: after an organiser deleted a claimed profile, that attendee
-- could never make another one. `/me/profile` looks for a live row, finds
-- none, inserts, and the insert hit `UNIQUE constraint failed:
-- people.event_id, people.identity_id` — surfacing as an opaque 500 with no
-- way forward for the person it happened to.
--
-- Narrowing the index rather than clearing `identity_id` on delete keeps the
-- tombstone honest about who owned it, which is what the audit log and any
-- future restore would want.
--
-- Index DDL only: no table rebuild, and no existing row can conflict, because
-- the wider constraint it replaces made such a pair impossible.
DROP INDEX idx_people_identity;
CREATE UNIQUE INDEX idx_people_identity
  ON people(event_id, identity_id) WHERE identity_id IS NOT NULL AND deleted_at IS NULL;
