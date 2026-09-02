-- What kind of thing a session is — a talk, a workshop, a panel.
--
-- `sessions.type` already exists and is 'official' | 'open', which is who
-- placed the session, not what it is. Nothing anywhere said whether a block
-- was a five-minute lightning slot or a three-hour hands-on workshop, so a
-- reader had to infer it from the description and the block's height. This
-- is that missing fact, and it is called a **format** precisely so the two
-- words never have to share one meaning.
--
-- Its own table rather than a reserved tag, because the difference is arity:
-- a session wears many tags and exactly one format. A uniqueness rule the tag
-- UI cannot express is a rule that will be broken, so the column carries it.
--
-- Event-defined rather than an enum: an unconference invents formats. The
-- suggestions in `shared/formats.ts` are a starting list an organiser can
-- take or ignore, not a fixed set.
CREATE TABLE session_formats (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',        -- hex, same chip palette as tags
  -- Minutes a session of this format usually runs, prefilled into the form
  -- when one is picked on a new session. NULL means the format says nothing
  -- about length — a field trip is however long it is.
  default_min INTEGER,
  -- Formats have a running order that is not alphabetical: keynote, talk,
  -- lightning, workshop. Ordered like rooms and tracks, not like tags.
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  UNIQUE (event_id, name)
);

-- Nullable, and stays nullable: every session that exists today has no
-- format, an event may define none at all, and "unspecified" is a real answer
-- rather than a gap to be filled. Deleting a format clears it from the
-- sessions wearing it, the way deleting a tag takes it off them.
ALTER TABLE sessions ADD COLUMN format_id INTEGER REFERENCES session_formats(id);
