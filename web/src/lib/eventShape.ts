import type { BreakDto, ProposalDto, RoomDto, SessionDto, TrackDto } from '@shared/types';
import { place } from './format';

/**
 * Mímir add-on: what kind of event is this, read off the data.
 *
 * The manual she reasons from covers every shape an organiser runs — a fixed
 * programme, an open floor, a hybrid, a residency, an assembly, a course, a
 * festival — and the app knows which one it is holding without asking anybody.
 * Open booking is a property of rooms; pitches either carry the work or sit
 * unused; a session either holds the floor or does not. Those are facts, and
 * they separate the shapes better than a label typed into a title.
 *
 * So this is read rather than asked. A question spends the organiser's patience
 * on something the database already answered, and the answer it gives is worse:
 * people describe the event they meant to run.
 *
 * Every reading is offered as a reading. `certain` is false whenever the
 * signals are thin or disagree, and the UI says so — being wrong out loud costs
 * one line, and guessing silently costs a whole conversation of advice aimed at
 * the wrong event.
 */
export interface Shape {
  /** Short name of the shape, for a chip. */
  name: string;
  /** The evidence, in the organiser's terms — always says what it counted. */
  because: string;
  /** What changes in the advice, given this shape. */
  soWhat: string;
  /** False when the signals are thin or mixed: the UI must invite a correction
   *  rather than present a conclusion. */
  certain: boolean;
}

export interface ShapeInput {
  rooms: RoomDto[];
  tracks: TrackDto[];
  breaks: BreakDto[];
  sessions: SessionDto[];
  proposals: ProposalDto[];
  event: { startDate: string; endDate: string; timezone: string };
}

const dayCount = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;

/** Sessions sharing a title across different days — a course's week, or a
 *  workshop repeated so everyone can reach it. */
function repeats(sessions: SessionDto[], timezone: string): number {
  const days = new Map<string, Set<string>>();
  for (const s of sessions) {
    // The event's day, not UTC's: a Tokyo morning is yesterday in UTC.
    const day = place(s, timezone).date;
    const set = days.get(s.title) ?? new Set<string>();
    set.add(day);
    days.set(s.title, set);
  }
  return [...days.values()].filter((d) => d.size > 1).length;
}

export function eventShape(input: ShapeInput): Shape {
  const { rooms, tracks, breaks, sessions, proposals, event } = input;
  const open = rooms.filter((r) => r.openBooking);
  const holding = sessions.filter((s) => s.blocksOpenBooking);
  const unplaced = proposals.filter((p) => p.placedSessionId === null);
  const days = dayCount(event.startDate, event.endDate);
  const repeated = repeats(sessions, event.timezone);

  // Nothing built yet. Say that, rather than reading a shape out of an empty
  // grid — an event with no rooms is not "a fixed programme".
  if (rooms.length === 0 && sessions.length === 0) {
    return {
      name: 'Not built yet',
      because: 'There are no rooms and no sessions, so there is nothing to read.',
      soWhat: 'Tell me what kind of event this is and I will work from that.',
      certain: false,
    };
  }

  // A spine that stops the whole event, plus rooms anyone can book into. The
  // most common real shape, and the one a binary reading always got wrong.
  if (open.length > 0 && holding.length > 0) {
    return {
      name: 'Hybrid',
      because: `${holding.length} session${holding.length === 1 ? '' : 's'} hold the floor, and ${open.length} of ${rooms.length} rooms take open booking.`,
      soWhat:
        'Two rhythms at once. Every held floor stops the whole event, so its length is the thing worth looking at.',
      certain: true,
    };
  }

  if (open.length > 0) {
    const thin = sessions.length < rooms.length * days;
    return {
      name: 'Open floor',
      because: `${open.length} of ${rooms.length} rooms take open booking${unplaced.length ? `, and ${unplaced.length} pitches are waiting for a slot` : ''}.`,
      soWhat:
        'The grid fills during the event, so a gap is space rather than an omission. Worth protecting the open hours from being eaten.',
      certain: thin || unplaced.length > 0,
    };
  }

  // No open rooms from here down: nobody in the room can add anything.
  if (days >= 4 && breaks.length > 0) {
    return {
      name: 'Residency or gathering',
      because: `${days} days with ${breaks.length} declared break${breaks.length === 1 ? '' : 's'}, and no room takes open booking.`,
      soWhat:
        'Density is not the problem; sustaining people is. Meals, rest and evenings are part of the design rather than the leftovers.',
      certain: true,
    };
  }

  if (repeated >= 2 && sessions.length > 0) {
    return {
      name: 'Course or training',
      because: `${repeated} sessions run on more than one day, and no room takes open booking.`,
      soWhat:
        'Order is load-bearing: a session moved is a session broken. Worth asking what each one assumes from the one before.',
      certain: repeated >= 3,
    };
  }

  // One room, one or two days, and the pitch board doing the arguing.
  if (rooms.length === 1 && days <= 2 && unplaced.length > 0) {
    return {
      name: 'Assembly or decision meeting',
      because: `One room over ${days} day${days === 1 ? '' : 's'}, with ${unplaced.length} pitches still open.`,
      soWhat:
        'The sequence is the design. What is genuinely open, who is affected and who decides come before any format question.',
      certain: false,
    };
  }

  // Lots of parallel choice with no open booking: a published programme people
  // pick their way through.
  if (rooms.length >= 4 && sessions.length >= rooms.length * 2) {
    return {
      name: 'Festival or open programme',
      because: `${sessions.length} sessions across ${rooms.length} rooms, all placed in advance.`,
      soWhat:
        'Nobody sees most of it. Clashes between the popular sessions matter more than empty slots.',
      certain: false,
    };
  }

  return {
    name: 'Fixed programme',
    because: `No room takes open booking, and ${sessions.length} session${sessions.length === 1 ? ' is' : 's are'} already placed${tracks.length ? ` across ${tracks.length} tracks` : ''}.`,
    soWhat:
      'Nobody in the room can add anything, so advice about the open floor does not apply here. Balance, rhythm and what happens between sessions are the live questions.',
    certain: sessions.length > 0,
  };
}
