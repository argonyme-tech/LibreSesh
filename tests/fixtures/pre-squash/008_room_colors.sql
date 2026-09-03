-- Rooms get a colour, so a column is identifiable at a glance on a wall
-- projection or a phone. Washed-out tints; the palette lives in
-- server/src/shared/roomColors.ts.
ALTER TABLE rooms ADD COLUMN color TEXT NOT NULL DEFAULT '#BFD7E8';

-- Spread existing rooms across the palette by their column order, so an event
-- created before this migration does not end up with eight identical columns.
UPDATE rooms SET color = CASE (sort_order % 8)
  WHEN 0 THEN '#BFD7E8'
  WHEN 1 THEN '#CFE3CE'
  WHEN 2 THEN '#F3D8DA'
  WHEN 3 THEN '#EDE2C6'
  WHEN 4 THEN '#DBD3E9'
  WHEN 5 THEN '#CCE5E2'
  WHEN 6 THEN '#F5E0CD'
  ELSE '#E1E5C9'
END;
