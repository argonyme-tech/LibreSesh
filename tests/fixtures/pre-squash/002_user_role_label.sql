-- What an event calls its middle role. Organisers rename it per event
-- ("attendee", "participant", "member"); the stored role stays 'user'.
ALTER TABLE events ADD COLUMN user_role_label TEXT NOT NULL DEFAULT 'attendee';
