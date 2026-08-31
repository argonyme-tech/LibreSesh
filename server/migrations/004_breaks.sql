-- Breaks: lunch, dinner, the coffee break. Programme furniture that belongs to
-- the *event*, not to a room, a track or anybody's session.
--
-- This replaces `sessions.background`, which was the same idea modelled wrong.
-- A break has no speaker, no tags, no description, no contributions and no
-- author; it is not something an attendee goes to instead of something else,
-- and nothing about it survives being edited like a session. It also repeats:
-- lunch is 12:00–14:00 every day of the event, said once.
--
-- `date IS NULL` means every day; a date pins the row to that one day, which
-- is how "dinner on the Wednesday" is said. There is no soft delete, unlike
-- rooms and tracks: nothing references a break, so a deleted one leaves no
-- hole to restore, and the trash has nothing to show.
--
-- Times are local minutes-of-day in the event's timezone, not instants. That
-- is deliberate and the reason a break survives a clock change: lunch is at
-- noon on both sides of it, which an instant per day could not say.
CREATE TABLE breaks (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  label TEXT NOT NULL,
  start_min INTEGER NOT NULL,                   -- local minutes since midnight
  end_min INTEGER NOT NULL,                     -- exclusive; 1440 = midnight
  date TEXT,                                    -- 'YYYY-MM-DD', or NULL = every day
  created_at TEXT NOT NULL
);
CREATE INDEX breaks_event ON breaks (event_id);

-- Nothing is carried over. A session that carried the old flag stays exactly
-- where it is and reverts to being an ordinary session — visible, editable and
-- deletable — rather than being guessed into a break: the flag's rows are
-- instants, and turning one back into "12:00 every day" needs a timezone
-- SQLite does not have. The organiser deletes it and adds a break instead.
ALTER TABLE sessions DROP COLUMN background;
