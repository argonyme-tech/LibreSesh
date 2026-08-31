-- Track hours: the window of the day a track accepts sessions in.
--
-- A track is a strand with a shape — "workshops run in the mornings", "the
-- unconference floor opens after lunch" — and until now that shape lived only
-- in the organiser's head, enforced by watching the grid. These columns say it
-- once, and the session rules hold attendees and speakers to it.
--
-- Both NULL means the track accepts a session at any hour, which is what every
-- existing track becomes: adding the feature changes no event's behaviour
-- until someone fills the window in. They are local minutes since midnight in
-- the event's timezone, like breaks and unlike sessions, for the same reason:
-- "mornings" is a wall-clock claim that has to survive a clock change.
ALTER TABLE tracks ADD COLUMN start_min INTEGER;   -- NULL = no limit
ALTER TABLE tracks ADD COLUMN end_min INTEGER;     -- exclusive; 1440 = midnight

-- One day of the event saying something different — "workshops run 09:00–13:00,
-- except on the Saturday, when they have the afternoon". A row here replaces
-- the track's own window for that date rather than narrowing it, so a day can
-- be wider than the default as easily as narrower.
--
-- No soft delete and no window without a track: overrides are small, are always
-- read through their track, and a deleted one leaves nothing to restore.
CREATE TABLE track_windows (
  id INTEGER PRIMARY KEY,
  track_id INTEGER NOT NULL REFERENCES tracks(id),
  date TEXT NOT NULL,                             -- 'YYYY-MM-DD', one day only
  start_min INTEGER NOT NULL,                     -- local minutes since midnight
  end_min INTEGER NOT NULL,                       -- exclusive
  created_at TEXT NOT NULL
);

-- A date says one thing per track, so the resolution rule needs no tiebreak.
CREATE UNIQUE INDEX track_windows_track_date ON track_windows (track_id, date);
