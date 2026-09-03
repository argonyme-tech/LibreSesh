-- How many audit entries an event keeps. The log is append-only and nothing
-- ever pruned it, so an instance that runs for years carries every write of
-- every conference it has ever hosted.
--
-- A count rather than an age: an organiser knows what "the last thousand
-- things that happened" means, and a quiet event and a busy one want very
-- different windows in days. 0 means keep everything, for an instance that
-- would rather grow than forget.
--
-- Deliberately per event and not per instance: retention is a judgement about
-- one conference's own record, and the events on an instance do not have to
-- agree. Instance-level rows (event_id IS NULL — a whole-database backup, an
-- event created from the landing page) are never pruned by this; they belong
-- to whoever holds the instance password, not to any event.
--
-- A plain ADD COLUMN with a default: no rebuild, no CHECK to widen, and every
-- existing event starts at the default the moment this runs.
ALTER TABLE events ADD COLUMN audit_keep INTEGER NOT NULL DEFAULT 1000;

-- Pruning deletes the oldest rows for one event, which wants the id, not the
-- timestamp: ids are the order things happened in, and two writes inside the
-- same second are ordered by id alone.
CREATE INDEX idx_audit_event_id ON audit(event_id, id);
