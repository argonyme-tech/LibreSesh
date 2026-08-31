-- A session that holds the floor. While one runs, an attendee may not place an
-- open session anywhere in the event — not even in a room that allows booking,
-- because the point is that there is nothing else to be at.
--
-- Off for every session that already exists, which is exactly how the event
-- behaved before this column: an event that marks nothing is unchanged.
ALTER TABLE sessions ADD COLUMN blocks_open_booking INTEGER NOT NULL DEFAULT 0;

-- Every placement by an attendee asks "is a blocking session live in this
-- window", so the read is by event and time with the flag as the filter. The
-- flag leads: the answer is no for almost every event, and that is the case
-- worth making cheap.
CREATE INDEX idx_sessions_blocking
  ON sessions(event_id, blocks_open_booking, starts_at);
