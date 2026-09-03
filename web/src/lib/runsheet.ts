import type { BreakDto, BundleDto, PersonDto, SessionDto } from '@shared/types';
import { nowMinuteOfDay, place, todayInZone } from './format';
import { stuckSpeakers } from './ownership';

/**
 * Mímir add-on: what whoever is on duty needs, at the minute they need it.
 *
 * Everything else she does is about the programme as a plan. This is the only
 * thing that is about the programme as it is happening, and the difference is
 * not cosmetic: the schedule is a grid you read, and a shift is a queue you
 * work. On the day, the organiser is not asking "is Thursday balanced" — they
 * are asking what starts in ten minutes, in which room, and whether whoever is
 * giving it has turned up.
 *
 * That question is answerable from the bundle plus the clock, and nothing in
 * the app answers it: the grid shows the shape of a day and leaves the reader
 * to work out where "now" falls in it.
 *
 * Pure over (bundle, now) so it can be tested at any instant rather than only
 * during an event, which is otherwise the hardest kind of code to trust.
 */
export interface OnNow {
  session: SessionDto;
  roomName: string;
  /** Minutes until it ends. */
  endsIn: number;
  speakers: string[];
  /** Somebody on the bill who cannot edit their own session — worth knowing
   *  before you go looking for them, not after. */
  stuck: string[];
  holdsFloor: boolean;
}

export interface UpNext {
  session: SessionDto;
  roomName: string;
  /** Minutes until it starts. */
  startsIn: number;
  speakers: string[];
  stuck: string[];
  holdsFloor: boolean;
  /** Nobody is credited: on the day, that means nobody is expected. */
  uncredited: boolean;
}

export interface RunSheet {
  /** Local date the sheet is for, in the event's timezone. */
  date: string;
  /** Local minute of day, so a caller can say "as of 14:32". */
  nowMin: number;
  /** True when `now` falls outside the event's own dates — the sheet is then
   *  empty and should say so rather than showing an accidental blank. */
  offDay: boolean;
  running: OnNow[];
  next: UpNext[];
  /** The break that is running, or the next one today. */
  breakNow: BreakDto | null;
  breakNext: { brk: BreakDto; startsIn: number } | null;
  /** Minutes of the rest of today during which no open session can be placed. */
  floorHeldMin: number;
  /** Nothing left today. */
  done: boolean;
}

const MINUTE = 60_000;
/** How far ahead "next" reaches. Beyond this it is the schedule, not a shift. */
const HORIZON_MIN = 120;

/** The same rule the readiness list and the session note use, by name. */
const stuckNames = (session: SessionDto, people: PersonDto[]): string[] =>
  stuckSpeakers(session, people).map((p) => p.name);

export function runSheet(bundle: BundleDto, now: Date = new Date()): RunSheet {
  const tz = bundle.event.timezone;
  // The shared helpers, not a local Intl call: they guard the engines that
  // render midnight as hour 24, which would put every break in the past.
  const date = todayInZone(tz, now);
  const nowMin = nowMinuteOfDay(tz, now);
  const t = now.getTime();
  const roomName = (id: number) => bundle.rooms.find((r) => r.id === id)?.name ?? `room ${id}`;

  const offDay = date < bundle.event.startDate || date > bundle.event.endDate;

  const today = bundle.sessions.filter((s) => place(s, tz).date === date);

  const running: OnNow[] = today
    .filter((s) => Date.parse(s.startsAt) <= t && Date.parse(s.endsAt) > t)
    .sort((a, b) => a.endsAt.localeCompare(b.endsAt))
    .map((s) => ({
      session: s,
      roomName: roomName(s.roomId),
      endsIn: Math.round((Date.parse(s.endsAt) - t) / MINUTE),
      speakers: s.speakers.map((sp) => sp.name),
      stuck: stuckNames(s, bundle.people),
      holdsFloor: s.blocksOpenBooking,
    }));

  const next: UpNext[] = today
    .filter((s) => {
      const inMin = (Date.parse(s.startsAt) - t) / MINUTE;
      return inMin > 0 && inMin <= HORIZON_MIN;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((s) => ({
      session: s,
      roomName: roomName(s.roomId),
      startsIn: Math.round((Date.parse(s.startsAt) - t) / MINUTE),
      speakers: s.speakers.map((sp) => sp.name),
      stuck: stuckNames(s, bundle.people),
      holdsFloor: s.blocksOpenBooking,
      uncredited: s.speakers.length === 0,
    }));

  const todaysBreaks = bundle.breaks
    .filter((b) => b.date === null || b.date === date)
    .sort((a, b) => a.startMin - b.startMin);
  const breakNow = todaysBreaks.find((b) => b.startMin <= nowMin && b.endMin > nowMin) ?? null;
  const upcoming = todaysBreaks.find((b) => b.startMin > nowMin);
  const breakNext = upcoming ? { brk: upcoming, startsIn: upcoming.startMin - nowMin } : null;

  // How much of what is left of today is closed to open booking. Only worth
  // counting forward: an hour that has already passed cannot be booked into.
  const floorHeldMin = today
    .filter((s) => s.blocksOpenBooking && Date.parse(s.endsAt) > t)
    .reduce(
      (acc, s) => acc + Math.round((Date.parse(s.endsAt) - Math.max(t, Date.parse(s.startsAt))) / MINUTE),
      0,
    );

  const done = !offDay && running.length === 0 && today.every((s) => Date.parse(s.endsAt) <= t);

  return { date, nowMin, offDay, running, next, breakNow, breakNext, floorHeldMin, done };
}
