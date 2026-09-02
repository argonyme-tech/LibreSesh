/**
 * The bounds a session's clock is held to, shared so the form offers exactly
 * what the server will accept — a duration the picker allows and the API
 * refuses is a error message nobody can act on.
 */

/** Everything on the schedule snaps to this, in the event's local time. */
export const SNAP_MINUTES = 5;

export const MIN_DURATION_MINUTES = 5;

/**
 * A day, not the eight hours it used to be. The real rule for anyone but an
 * organiser is already "start and end on the same day" (`assertWithinEventWindow`),
 * so a shorter cap here only refused things that are genuinely one session: a
 * full-day excursion, a hackathon that runs from breakfast to the demo, a
 * poster hall that is open all afternoon. Those were unplaceable, and the
 * workaround — chopping one thing into three blocks — lied on the grid.
 */
export const MAX_DURATION_MINUTES = 1440;

/**
 * Durations the session form offers as a list, with anything else typed in.
 * Not a limit: the picker's "Other" takes any multiple of five up to the max.
 */
export const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180, 240, 360, 480] as const;

/** "45 min", "1 h", "1 h 30 min" — the way a programme prints a length. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}
