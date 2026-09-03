-- Past a certain length the schedule's flat strip of day tabs becomes a
-- horizontal scroller that hides the event's shape, and the days split into a
-- rail of weeks instead. Where that happens is a judgement about the event —
-- a nine-day festival may still want one strip — so organisers set it.
--
-- The default is the longest event that still gets a single strip, which keeps
-- every existing event exactly as it is: nothing shipped so far runs longer.
ALTER TABLE events ADD COLUMN week_rail_from INTEGER NOT NULL DEFAULT 8;
