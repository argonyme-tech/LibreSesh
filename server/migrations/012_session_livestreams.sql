-- A session can be streamed more than once: the main camera, a room's own
-- feed, an interpreted channel, a mirror somebody in the community set up. One
-- column held one link, so the second one went into the description or went
-- nowhere.
--
-- Same shape as `people.links`, which has carried a handful of labelled links
-- since profiles arrived: a JSON array of { label, url }. The old single value
-- becomes the first entry, labelled the way the button that rendered it read.
ALTER TABLE sessions ADD COLUMN livestreams TEXT NOT NULL DEFAULT '[]';

UPDATE sessions
   SET livestreams = json_array(json_object('label', 'Livestream', 'url', livestream_url))
 WHERE livestream_url <> '';

ALTER TABLE sessions DROP COLUMN livestream_url;
