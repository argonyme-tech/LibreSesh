import type { Db, TrackWindowRow } from './db.js';
import type { TrackWindowDto } from './shared/types.js';

export { fmtMinute, windowLabel, windowOn } from './shared/trackHours.js';
export type { DayWindow, TrackHours } from './shared/trackHours.js';

const toWindowDto = (row: TrackWindowRow): TrackWindowDto => ({
  date: row.date,
  startMin: row.start_min,
  endMin: row.end_min,
});

/** Every override of one track, earliest day first. */
export function trackWindows(db: Db, trackId: number): TrackWindowDto[] {
  return db
    .prepare<[number], TrackWindowRow>(
      'SELECT * FROM track_windows WHERE track_id = ? ORDER BY date',
    )
    .all(trackId)
    .map(toWindowDto);
}

/**
 * Overrides for many tracks in one query, keyed by track id — the bundle and
 * the export both list every track, and a query apiece would be a round trip
 * per strand for a table most events leave empty.
 */
export function trackWindowsFor(db: Db, trackIds: number[]): Map<number, TrackWindowDto[]> {
  const byTrack = new Map<number, TrackWindowDto[]>();
  if (trackIds.length === 0) return byTrack;
  const placeholders = trackIds.map(() => '?').join(',');
  const rows = db
    .prepare<number[], TrackWindowRow>(
      `SELECT * FROM track_windows WHERE track_id IN (${placeholders}) ORDER BY date`,
    )
    .all(...trackIds);
  for (const row of rows) {
    const list = byTrack.get(row.track_id);
    if (list) list.push(toWindowDto(row));
    else byTrack.set(row.track_id, [toWindowDto(row)]);
  }
  return byTrack;
}

/** Replace a track's overrides wholesale — the editor sends the list it wants,
 *  the same shape the reorder route uses, so a removed day needs no DELETE. */
export function replaceTrackWindows(db: Db, trackId: number, windows: TrackWindowDto[]): void {
  db.transaction(() => {
    db.prepare('DELETE FROM track_windows WHERE track_id = ?').run(trackId);
    const insert = db.prepare(
      'INSERT INTO track_windows (track_id, date, start_min, end_min, created_at) VALUES (?, ?, ?, ?, ?)',
    );
    const now = new Date().toISOString();
    for (const w of windows) insert.run(trackId, w.date, w.startMin, w.endMin, now);
  })();
}
