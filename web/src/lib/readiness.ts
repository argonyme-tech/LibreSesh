import type { BundleDto, PersonDto, SessionDto } from '@shared/types';
import { dateRange } from '@shared/time';
import { windowOn } from '@shared/trackHours';
import { fmtMin, place } from './format';
import { cannotEditOwn } from './ownership';

/**
 * Mímir add-on: what is still missing before the doors open.
 *
 * The app is good at showing one fact where it lives — "no speaker yet" on a
 * session, the backing count on a pitch card, an over-capacity badge in the
 * list. What it has never had is a view that adds them up, so the organiser's
 * actual question — *what do I still have to do?* — can only be answered by
 * walking the whole programme and remembering. Every fact below is already in
 * the bundle. Nobody was summing them.
 *
 * Each finding says what was counted, so it can be checked against the grid
 * rather than believed. None of them blocks anything, none of them scores the
 * event out of ten, and none of them is ordered by a number Mímir invented:
 * the order is who is stuck, then what people already asked for, then what is
 * merely absent.
 */
export interface Finding {
  key: string;
  /** What it is, in one line. */
  what: string;
  /** The count, so the organiser can check it against the grid. */
  because: string;
  /** Why it matters — the consequence, not the severity. */
  soWhat: string;
  /** Where in the app to go and fix it. */
  where: string;
}

/** Below this, a gap in the middle of a day is a break somebody meant. */
const HOLE_MIN = 150;

const listNames = (names: string[], max = 3): string =>
  names.length <= max
    ? names.join(', ')
    : `${names.slice(0, max).join(', ')} and ${names.length - max} more`;

export function readiness(bundle: BundleDto): Finding[] {
  const { event, rooms, tracks, breaks, sessions, people, proposals } = bundle;
  const found: Finding[] = [];
  const personById = new Map<number, PersonDto>(people.map((p) => [p.id, p]));
  // The schedule's own day list, so the two can never disagree on a count.
  const days = dateRange(event.startDate, event.endDate);

  // 1. Somebody is credited but cannot touch their own session.
  //
  // Editing a session you are billed on needs two things at once: the profile
  // has to be claimed by a device, and that identity has to hold the speaker
  // role. Being on the poster alone does nothing. Nobody finds this out until
  // the speaker writes to say the button is missing, the day before.
  const credited = new Set<number>();
  for (const s of sessions) for (const sp of s.speakers) credited.add(sp.id);
  const stuck = [...credited]
    .map((id) => personById.get(id))
    .filter((p): p is PersonDto => p !== undefined)
    .filter(cannotEditOwn);
  if (stuck.length > 0) {
    found.push({
      key: 'speakers-cannot-edit',
      what: 'Credited people who cannot edit their own session',
      because: `${listNames(stuck.map((p) => p.name))} ${stuck.length === 1 ? 'is' : 'are'} on the bill and nobody holds ${stuck.length === 1 ? 'their profile' : 'their profiles'} yet.`,
      soWhat:
        'Being credited is the whole qualification — the moment they hold the profile they can edit it. Until then they will go to fix a typo and find no button.',
      where: 'Admin → People: send a speaker code, or approve their claim when it comes in.',
    });
  }

  // 2. People asked for these and nobody placed them.
  const wanted = proposals
    .filter((p) => p.placedSessionId === null && p.interestCount > 0)
    .sort((a, b) => b.interestCount - a.interestCount);
  if (wanted.length > 0) {
    found.push({
      key: 'pitches-unplaced',
      what: 'Pitches with backing and no slot',
      because: `${wanted.length} unplaced pitch${wanted.length === 1 ? '' : 'es'}, the most backed being “${wanted[0].title}” with ${wanted[0].interestCount}.`,
      soWhat:
        'The interest was already expressed. This is the one list where the room has told you what it wants and the programme has not answered.',
      where: 'Pitches board — place the ones that fit.',
    });
  }

  // 3. A session nobody is credited for.
  const uncredited = sessions.filter((s) => s.speakers.length === 0);
  if (uncredited.length > 0) {
    found.push({
      key: 'sessions-uncredited',
      what: 'Sessions with nobody credited',
      because: `${uncredited.length} of ${sessions.length}: ${listNames(uncredited.map((s) => `“${s.title}”`))}.`,
      soWhat:
        'Fine for an open slot that fills on the day; a hole in the programme for anything announced. Visible one session at a time and never as a list.',
      where: 'Open each from the schedule and add its speakers.',
    });
  }

  // 4. Several days, and nobody has said when people eat.
  if (days.length > 1 && breaks.length === 0 && sessions.length > 0) {
    found.push({
      key: 'no-breaks',
      what: 'No breaks declared',
      because: `${days.length} days of programme and not one meal or pause on the grid.`,
      soWhat:
        'Until a break exists, a pause can only be guessed from a gap — which cannot tell lunch from a room nobody booked. Declaring them is also what lets the rhythm notes stop guessing.',
      where: 'Admin → Breaks.',
    });
  }

  // 5. A day of the event with nothing on it, or a hole inside one.
  const byDay = new Map<string, SessionDto[]>();
  for (const s of sessions) {
    const at = place(s, event.timezone);
    const list = byDay.get(at.date) ?? [];
    list.push(s);
    byDay.set(at.date, list);
  }
  const empty = days.filter((d) => !byDay.has(d));
  const holes: string[] = [];
  for (const [date, list] of byDay) {
    const spans = list
      .map((s) => place(s, event.timezone))
      .sort((a, b) => a.startMin - b.startMin);
    let reach = spans[0].endMin;
    for (const s of spans.slice(1)) {
      if (s.startMin - reach >= HOLE_MIN) {
        holes.push(`${date} ${fmtMin(reach)}–${fmtMin(s.startMin)}`);
      }
      reach = Math.max(reach, s.endMin);
    }
  }
  if (sessions.length > 0 && (empty.length > 0 || holes.length > 0)) {
    const parts = [
      empty.length > 0 ? `${empty.length} day${empty.length === 1 ? '' : 's'} with nothing on ${empty.length === 1 ? 'it' : 'them'} (${listNames(empty)})` : '',
      holes.length > 0 ? `${holes.length} gap${holes.length === 1 ? '' : 's'} of over ${HOLE_MIN / 60}h inside a day (${listNames(holes, 2)})` : '',
    ].filter(Boolean);
    found.push({
      key: 'empty-time',
      what: 'Time nobody has claimed',
      because: `${parts.join('; ')}.`,
      soWhat:
        'At an open-floor event this is space, and worth protecting. At a fixed programme it is an afternoon somebody forgot. Only you know which, and the schedule shows one day at a time so nothing puts the week in front of you.',
      where: 'The schedule, day by day.',
    });
  }

  // 6. More people want it than the room holds. Known the night before rather
  //    than at the door — the badge exists per row, the total never did.
  const tight = sessions
    .map((s) => ({ s, stars: bundle.starCounts[s.id] ?? 0, cap: rooms.find((r) => r.id === s.roomId)?.capacity ?? null }))
    .filter((x) => x.cap !== null && x.stars > x.cap)
    .sort((a, b) => b.stars - a.stars);
  if (tight.length > 0) {
    found.push({
      key: 'over-capacity',
      what: 'Sessions more people want than the room holds',
      because: `${tight.length}: worst is “${tight[0].s.title}” with ${tight[0].stars} starred against a room for ${tight[0].cap}.`,
      soWhat:
        'A star is the only honest signal of who intends to come. This is knowable the night before instead of at the door.',
      where: 'Move the session to a bigger room, or repeat it.',
    });
  }

  // 7. A track declares hours nothing keeps to. The rule is written down and
  //    contradicted, which is worse than never having written it.
  const strays: string[] = [];
  for (const t of tracks) {
    for (const s of sessions.filter((x) => x.trackId === t.id)) {
      const at = place(s, event.timezone);
      const hours = windowOn(t, at.date);
      if (hours === null) continue;
      if (at.startMin < hours.startMin || at.endMin > hours.endMin) {
        strays.push(`“${s.title}” (${t.name})`);
      }
    }
  }
  if (strays.length > 0) {
    found.push({
      key: 'outside-track-hours',
      what: 'Sessions outside the hours their track declares',
      because: `${strays.length}: ${listNames(strays)}.`,
      soWhat:
        'The strand has a shape and these sit outside it. A written rule nothing keeps to is worse than no rule, because everyone else plans around it.',
      where: 'Move the session, or widen the track’s hours for that day.',
    });
  }

  return found;
}
