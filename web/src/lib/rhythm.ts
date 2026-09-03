import type { BreakDto } from '@shared/types';

/**
 * The numbers and the two small rules that every rhythm judgement shares.
 *
 * They were declared twice — once in the rhythm panel, once in the notes that
 * sit beside a session — under different names and with nothing tying them
 * together. An organiser who tuned one threshold would have had the panel
 * and the session-level note disagree about the same block. One home.
 *
 * Numbers, not opinions: each is a minute count somebody can argue with.
 */

/** Attention holds about this long in one piece (doctrine B4). Past it the
 *  room is still seated but no longer there. */
export const LONG_BLOCK_MIN = 90;

/** Below this, a gap between consecutive sessions is not a pause. */
export const MIN_BREAK_MIN = 10;

/** How much of a declared break a session has to eat before it is worth
 *  saying. A minute of overlap is a rounding error in somebody's end time; a
 *  quarter of an hour is people choosing between the session and lunch. */
export const BREAK_BITE_MIN = 15;

/** Minutes two intervals share; 0 when they do not. */
export const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number): number =>
  Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

/** A break applies to a day if it is daily, or pinned to that date. */
export const breakOn = (b: BreakDto, date: string): boolean => b.date === null || b.date === date;
