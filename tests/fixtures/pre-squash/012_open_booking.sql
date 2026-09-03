-- `open_track` never meant a track. It is a booking permission: attendees may
-- schedule in this room. The word was removed from the UI on 2026-08-30, and
-- with real tracks arriving in migration 011 the column name went from vague
-- to actively wrong — two different things called "track" in one schema.
ALTER TABLE rooms RENAME COLUMN open_track TO open_booking;
