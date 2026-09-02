-- Every identity that has entered an event is a person there: one live
-- `people` row per (event, identity). Until now a row appeared only on the
-- first profile edit, so a newcomer was in neither the speaker picker nor the
-- merge dialog. From here the gate creates the row; this backfills the ones
-- that predate it.

-- Role holders from before per-event names (migration 009 of the old line,
-- and the demo seed) have a role but no event name. Give them one from the
-- instance seed so the next statement covers them; a clash simply skips.
INSERT OR IGNORE INTO event_identities (event_id, identity_id, display_name, claimed_at)
SELECT r.event_id, r.identity_id, i.display_name, r.granted_at
  FROM roles r
  JOIN identities i ON i.id = r.identity_id
 WHERE i.display_name <> ''
   AND NOT EXISTS (SELECT 1 FROM event_identities ei
                    WHERE ei.event_id = r.event_id AND ei.identity_id = r.identity_id);

-- The full name starts as the username, as the gate now does.
INSERT INTO people (event_id, identity_id, name, bio, links, created_at, updated_at)
SELECT ei.event_id, ei.identity_id, ei.display_name, '', '[]', ei.claimed_at, ei.claimed_at
  FROM event_identities ei
 WHERE NOT EXISTS (SELECT 1 FROM people p
                    WHERE p.event_id = ei.event_id AND p.identity_id = ei.identity_id
                      AND p.deleted_at IS NULL);
