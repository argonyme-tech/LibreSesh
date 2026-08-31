import type { TrackDto } from './types.js';

/** The hours a track keeps on one day: local minutes since midnight, in the
 *  event's timezone. */
export interface DayWindow {
  startMin: number;
  endMin: number;
}

/** Only what {@link windowOn} reads, so the rule can be tested on a literal
 *  and the client can ask the same question the server answers. */
export type TrackHours = Pick<TrackDto, 'startMin' | 'endMin' | 'windows'>;

/**
 * The window a track keeps on `date`, or null when it keeps none and takes a
 * session at any hour.
 *
 * A day with its own row *replaces* the track's window rather than narrowing
 * it: "workshops run 09:00–13:00, but on the Saturday they have the afternoon"
 * is the sentence being said, and an override that could only ever cut a day
 * shorter could not say it.
 *
 * Shared so that the client draws the hours from the same resolution the
 * server refuses by. A grid that disagreed with the rule about which day is
 * which would be worse than no hint at all.
 */
export function windowOn(track: TrackHours, date: string): DayWindow | null {
  const override = track.windows.find((w) => w.date === date);
  if (override) return { startMin: override.startMin, endMin: override.endMin };
  if (track.startMin === null || track.endMin === null) return null;
  return { startMin: track.startMin, endMin: track.endMin };
}

/** 'HH:MM' from local minutes-of-day. */
export const fmtMinute = (minute: number): string =>
  `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

/** "09:00–13:00" — how a window reads on a card or in a refusal. */
export const windowLabel = (window: DayWindow): string =>
  `${fmtMinute(window.startMin)}–${fmtMinute(window.endMin)}`;
