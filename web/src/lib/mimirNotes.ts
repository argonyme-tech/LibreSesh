import type { BundleDto, PersonDto, ProposalDto, SessionDto } from '@shared/types';
import { windowLabel, windowOn } from '@shared/trackHours';
import { fmtMin, place } from './format';
import { cannotEditOwn, stuckSpeakers } from './ownership';
import { BREAK_BITE_MIN, LONG_BLOCK_MIN, MIN_BREAK_MIN, breakOn, overlap } from './rhythm';

/**
 * Mímir as a layer rather than a tab.
 *
 * Her own page is where you go *on purpose* — to design a session, to read the
 * rhythm, to see what is still missing. That is the wrong place for most of
 * what she knows, because the moment a note is useful is the moment you are
 * looking at the thing it is about: the pitch nobody placed, on the pitch
 * board; the speaker who cannot edit their session, on the row where you fix
 * it; the block that eats lunch, on the session itself.
 *
 * One function per surface, all pure over the bundle the page already loaded,
 * all returning the same shape. Central because the voice has to be the same
 * everywhere — and because a note that appears beside somebody's work has to
 * clear a higher bar than one on Mímir's own page. Every note here:
 *
 * - says what it counted, so it can be checked rather than believed — an
 *   absence states its zero out loud rather than gesturing at it;
 * - names structure and never a person;
 * - has somewhere to go, or it is just an observation with a badge on it;
 * - is silent by default. A surface with nothing worth saying returns [].
 *
 * She still writes nothing. These are sentences beside a control the human was
 * already going to use.
 */
export interface Note {
  key: string;
  /** The finding, in one line. */
  what: string;
  /** What was counted. */
  because: string;
  /** Optional next step, in the reader's own hands. */
  hint?: string;
}

const MINUTE = 60_000;

const minutes = (s: SessionDto) => Math.round((Date.parse(s.endsAt) - Date.parse(s.startsAt)) / MINUTE);

/**
 * Beside one session — for whoever is giving it as much as for the organiser.
 *
 * The speaker role is the one this add-on newly serves: someone running a
 * session without being a facilitator, who has no reason to open a
 * co-facilitator's tab and every reason to want this here.
 */
export function notesForSession(session: SessionDto, bundle: BundleDto): Note[] {
  const notes: Note[] = [];
  const at = place(session, bundle.event.timezone);
  const min = minutes(session);
  const ended = Date.parse(session.endsAt) < Date.now();

  if (min > LONG_BLOCK_MIN) {
    notes.push({
      key: 'long',
      what: `${min} minutes in one piece`,
      because: `Attention holds roughly ${LONG_BLOCK_MIN}; past that the room is seated but no longer there.`,
      hint: 'A real cut in the middle costs ten minutes and buys the second half.',
    });
  }

  for (const b of bundle.breaks) {
    if (!breakOn(b, at.date)) continue;
    const bite = overlap(at.startMin, at.endMin, b.startMin, b.endMin);
    if (bite >= BREAK_BITE_MIN) {
      notes.push({
        key: `break-${b.id}`,
        what: `Takes ${bite} min out of ${b.label}`,
        because: `${b.label} runs ${fmtMin(b.startMin)}–${fmtMin(b.endMin)} and this runs ${fmtMin(at.startMin)}–${fmtMin(at.endMin)}.`,
        hint: 'Whoever comes skips the meal; whoever eats misses this.',
      });
    }
  }

  if (session.speakers.length === 0) {
    notes.push({
      key: 'nobody',
      what: 'Nobody is credited',
      because: '0 people on the bill.',
      hint: 'Fine for an open slot that fills on the day. A hole for anything announced.',
    });
  }

  // Somebody on this bill who cannot touch it. Editing needs the profile
  // claimed by a device *and* the speaker role — being on the poster is
  // neither, and they find out when they go to fix a typo.
  const stuck = stuckSpeakers(session, bundle.people);
  if (stuck.length > 0) {
    notes.push({
      key: 'stuck',
      what: `${stuck.map((p) => p.name).join(', ')} cannot edit this`,
      because: 'On the bill, and nobody holds the profile yet.',
      hint: 'A speaker code, or approving their claim, puts them in.'
    });
  }

  if (session.blocksOpenBooking) {
    notes.push({
      key: 'floor',
      what: 'Holds the floor',
      because: `For ${min} minutes nobody can place an open session anywhere in the event.`,
      hint: 'That is the whole event choosing, not one room.',
    });
  }

  // The same resolution the server refuses by: a day's own window replaces
  // the track's, and a track with no hours takes any.
  const track = bundle.tracks.find((t) => t.id === session.trackId);
  const hours = track ? windowOn(track, at.date) : null;
  if (track && hours && (at.startMin < hours.startMin || at.endMin > hours.endMin)) {
    notes.push({
      key: 'hours',
      what: `Outside ${track.name}'s hours`,
      because: `${track.name} accepts ${windowLabel(hours)} on this day; this runs ${fmtMin(at.startMin)}–${fmtMin(at.endMin)}.`,
    });
  }

  const stars = bundle.starCounts[session.id] ?? 0;
  const cap = bundle.rooms.find((r) => r.id === session.roomId)?.capacity ?? null;
  if (cap !== null && stars > cap) {
    notes.push({
      key: 'capacity',
      what: 'More want in than the room holds',
      because: `${stars} starred against a room for ${cap}.`,
      hint: 'Knowable tonight rather than at the door.',
    });
  }

  // After the fact, the only note that matters is whether anything survived.
  if (ended && (bundle.contributionCounts[session.id] ?? 0) === 0) {
    notes.push({
      key: 'harvest',
      what: 'Nothing was kept',
      because: 'This has ended with 0 notes and 0 questions on it.',
      hint: 'Something happened in that room. It is easier to ask now than next week.',
    });
  }

  return notes;
}

/** Beside one pitch, on the board where it is placed or withdrawn. */
export function notesForPitch(pitch: ProposalDto, bundle: BundleDto): Note[] {
  const notes: Note[] = [];
  if (pitch.placedSessionId !== null) return notes;

  if (pitch.interestCount > 0) {
    // The one list where the room has said what it wants and the programme has
    // not answered yet.
    const open = bundle.rooms.filter((r) => r.openBooking);
    notes.push({
      key: 'backed',
      what: `${pitch.interestCount} ${pitch.interestCount === 1 ? 'person has' : 'people have'} backed this and it has no slot`,
      because: open.length > 0
        ? `${open.length} of ${bundle.rooms.length} rooms take open booking, so it could go up without an organiser.`
        : 'No room here takes open booking, so only an organiser can place it.',
    });
  }

  if (pitch.speakerId === null) {
    notes.push({
      key: 'nohost',
      what: 'Nobody is down to host it',
      because: '0 people named on the pitch.',
      hint: 'A pitch with backing and no host is a question about who, not about when.',
    });
  }

  return notes;
}

/** Beside a person's row in the organiser's People list — where it is fixed. */
export function notesForPerson(person: PersonDto, bundle: BundleDto): Note[] {
  const theirs = bundle.sessions.filter((s) => s.speakers.some((sp) => sp.id === person.id));
  if (theirs.length === 0) return [];
  const notes: Note[] = [];

  if (cannotEditOwn(person)) {
    notes.push({
      key: 'cannot-edit',
      what: `Cannot edit ${theirs.length === 1 ? 'their session' : `their ${theirs.length} sessions`}`,
      because: 'Nobody holds the profile yet.',
      hint: 'A speaker code, or approving their claim, puts them in.',
    });
  }

  // Load, said as structure. Three in a row is a fact about the schedule; what
  // it means for the person is not ours to say.
  const ordered = theirs.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  for (let i = 1; i < ordered.length; i++) {
    const gap = (Date.parse(ordered[i].startsAt) - Date.parse(ordered[i - 1].endsAt)) / MINUTE;
    if (gap < MIN_BREAK_MIN) {
      notes.push({
        key: 'back-to-back',
        what: 'Two of theirs run back to back',
        because: `“${ordered[i - 1].title}” ends and “${ordered[i].title}” starts ${gap <= 0 ? 'immediately' : `${Math.round(gap)} min later`}.`,
      });
      break;
    }
  }

  return notes;
}

/** Beside one day of the grid, for whoever can still move it. */
export function notesForDay(date: string, bundle: BundleDto): Note[] {
  const notes: Note[] = [];
  const today = bundle.sessions.filter((s) => place(s, bundle.event.timezone).date === date);

  if (today.length === 0) {
    notes.push({
      key: 'empty-day',
      what: 'Nothing on this day yet',
      because: 'No session is placed here.',
      hint: 'Space at an open-floor event, an oversight at a fixed programme. Only you know which.',
    });
    return notes;
  }

  const holding = today.filter((s) => s.blocksOpenBooking);
  if (holding.length > 0) {
    const total = holding.reduce((n, s) => n + minutes(s), 0);
    notes.push({
      key: 'floor-held',
      what: `The floor is held for ${total} min today`,
      because: `${holding.length} session${holding.length === 1 ? '' : 's'} block open booking: ${holding.map((s) => `“${s.title}”`).join(', ')}.`,
      hint: 'Nobody can place an open session while any of them runs.',
    });
  }

  if (bundle.breaks.filter((b) => b.date === null || b.date === date).length === 0) {
    notes.push({
      key: 'no-break-today',
      what: 'No meal or pause declared today',
      because: `${today.length} sessions and nothing behind them on the grid.`,
      hint: 'Until a break exists, a gap cannot be told from a room nobody booked.',
    });
  }

  return notes;
}
