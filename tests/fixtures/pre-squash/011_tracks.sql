-- Tracks: thematic strands running across rooms and days — "Design track",
-- "Ops track". Shaped like tags (per event, named, coloured, soft-deleted) but
-- the relation is one-to-many, not many-to-many: the schedule can lay tracks
-- out as its columns, and a session can only sit in one column. So it hangs off
-- sessions.track_id, like room_id, rather than a join table.
--
-- Optional throughout. An event with no tracks behaves exactly as before, and
-- the schedule only offers to group by track once at least one exists.
CREATE TABLE tracks (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

-- Unique per event, including against soft-deleted rows, so a deleted track is
-- revived rather than duplicated. Matches how tags behave.
CREATE UNIQUE INDEX tracks_event_name ON tracks (event_id, name);

ALTER TABLE sessions ADD COLUMN track_id INTEGER REFERENCES tracks(id);

CREATE INDEX sessions_track ON sessions (track_id);
