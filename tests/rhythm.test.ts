import { describe, expect, it } from 'vitest';
import { rhythmWarnings } from '../web/src/components/RhythmCheck.js';
import type {
  BreakDto,
  PersonRef,
  RoomDto,
  SessionDto,
  TrackDto,
} from '../server/src/shared/types.js';

/** Mímir add-on: the rhythm checks are pure over the bundle, so they test
 *  like format.ts does — no DOM.
 *
 *  Every case here is arithmetic on something an organiser declared. That is
 *  the point of the whole component: a note that can be checked against the
 *  grid is worth reading, and one that cannot is an opinion the software has
 *  no standing to hold. */

const room = { id: 1, name: 'Main Hall' } as RoomDto;
const session = (
  id: number,
  startsAt: string,
  endsAt: string,
  extra: Partial<SessionDto> = {},
): SessionDto =>
  ({
    id,
    roomId: 1,
    trackId: null,
    title: `S${id}`,
    speakers: [] as PersonRef[],
    blocksOpenBooking: false,
    startsAt,
    endsAt,
    ...extra,
  }) as SessionDto;

/** UTC throughout, so a clock time in a fixture reads as itself. */
const UTC = { timezone: 'UTC' };

describe('rhythmWarnings', () => {
  it('stays silent on a schedule with breaks and short blocks', () => {
    const sessions = [
      session(1, '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z'),
      session(2, '2026-09-03T10:15:00Z', '2026-09-03T11:15:00Z'),
    ];
    expect(rhythmWarnings(sessions, [room], UTC)).toEqual([]);
  });

  it('flags a single session over 90 minutes', () => {
    const w = rhythmWarnings(
      [session(1, '2026-09-03T09:00:00Z', '2026-09-03T11:00:00Z')],
      [room],
      UTC,
    );
    expect(w).toHaveLength(1);
    expect(w[0].key).toBe('long-1');
    expect(w[0].what).toContain('120 min');
  });

  it('flags back-to-back sessions that chain past 90 minutes without a break', () => {
    const sessions = [
      session(1, '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z'),
      session(2, '2026-09-03T10:05:00Z', '2026-09-03T11:00:00Z'), // 5 min is not a break
    ];
    const w = rhythmWarnings(sessions, [room], UTC);
    expect(w).toHaveLength(1);
    expect(w[0].key).toBe('chain-1-1');
    expect(w[0].what).toContain('Main Hall');
  });

  it('does not chain across rooms — parallel tracks are not one block', () => {
    const sessions = [
      session(1, '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z'),
      session(2, '2026-09-03T10:05:00Z', '2026-09-03T11:00:00Z', { roomId: 2 }),
    ];
    expect(rhythmWarnings(sessions, [room, { id: 2, name: 'B' } as RoomDto], UTC)).toEqual([]);
  });
});

/** A break is the organiser saying when lunch is. Before it existed, a pause
 *  could only be inferred from a gap in the grid — which cannot tell a meal
 *  from a room nobody booked. */
describe('against declared breaks', () => {
  const lunch: BreakDto = {
    id: 7,
    label: 'Lunch',
    startMin: 12 * 60,
    endMin: 14 * 60,
    date: null, // every day
  };

  it('says how many minutes a session takes out of a meal', () => {
    const w = rhythmWarnings(
      [session(1, '2026-09-03T13:00:00Z', '2026-09-03T14:00:00Z')],
      [room],
      { ...UTC, breaks: [lunch] },
    );
    expect(w.map((x) => x.key)).toContain('break-1-7');
    expect(w.find((x) => x.key === 'break-1-7')!.what).toContain('60 min out of Lunch');
  });

  it('lets a session finish a minute into lunch without a word', () => {
    // The bite has to be worth a note. A couple of minutes is somebody's end
    // time rounding, not a choice between the session and the meal.
    const w = rhythmWarnings(
      [session(1, '2026-09-03T11:00:00Z', '2026-09-03T12:05:00Z')],
      [room],
      { ...UTC, breaks: [lunch] },
    );
    expect(w.filter((x) => x.key.startsWith('break-'))).toEqual([]);
  });

  it('ignores a break pinned to another day', () => {
    const dinner: BreakDto = { ...lunch, id: 8, label: 'Dinner', date: '2026-09-04' };
    const w = rhythmWarnings(
      [session(1, '2026-09-03T13:00:00Z', '2026-09-03T14:00:00Z')],
      [room],
      { ...UTC, breaks: [dinner] },
    );
    expect(w).toEqual([]);
  });
});

/** Track hours used to live in the organiser's head — "workshops are in the
 *  mornings" — so nothing could check them. They are columns now. */
describe('against track hours', () => {
  const mornings = {
    id: 3,
    name: 'Workshops',
    startMin: 9 * 60,
    endMin: 13 * 60,
    windows: [],
  } as unknown as TrackDto;

  it('names the session, its hours and the track it left', () => {
    const w = rhythmWarnings(
      [session(1, '2026-09-03T14:00:00Z', '2026-09-03T15:00:00Z', { trackId: 3 })],
      [room],
      { ...UTC, tracks: [mornings] },
    );
    const note = w.find((x) => x.key === 'hours-1');
    expect(note).toBeDefined();
    expect(note!.what).toContain('14:00–15:00');
    expect(note!.what).toContain('Workshops');
  });

  it('says nothing when the session sits inside them', () => {
    const w = rhythmWarnings(
      [session(1, '2026-09-03T10:00:00Z', '2026-09-03T11:00:00Z', { trackId: 3 })],
      [room],
      { ...UTC, tracks: [mornings] },
    );
    expect(w).toEqual([]);
  });

  it('lets one day widen the window rather than only narrow it', () => {
    // A window pinned to a date replaces the track's own, which is the rule
    // the schedule itself follows — the Saturday can have the afternoon.
    const saturday = {
      ...mornings,
      windows: [{ id: 1, date: '2026-09-03', startMin: 9 * 60, endMin: 18 * 60 }],
    } as unknown as TrackDto;
    const w = rhythmWarnings(
      [session(1, '2026-09-03T14:00:00Z', '2026-09-03T15:00:00Z', { trackId: 3 })],
      [room],
      { ...UTC, tracks: [saturday] },
    );
    expect(w).toEqual([]);
  });
});

describe('a session that holds the floor', () => {
  it('says what it closes, not just that it is long', () => {
    const w = rhythmWarnings(
      [
        session(1, '2026-09-03T09:00:00Z', '2026-09-03T11:00:00Z', {
          blocksOpenBooking: true,
          title: 'Plenary',
        }),
      ],
      [room],
      UTC,
    );
    const note = w.find((x) => x.key === 'floor-1');
    expect(note).toBeDefined();
    // The point of the note: it is the whole event, not one room.
    expect(note!.why).toContain('anywhere in the event');
  });
});

/** A session has several speakers now, so "the same person, twice in a row"
 *  is finally a question the schedule can answer. */
describe('load on whoever is giving the sessions', () => {
  const ada: PersonRef = { id: 11, name: 'Ada' };

  it('flags two of theirs back to back', () => {
    const w = rhythmWarnings(
      [
        session(1, '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z', { speakers: [ada] }),
        session(2, '2026-09-03T10:00:00Z', '2026-09-03T10:45:00Z', {
          roomId: 2,
          speakers: [ada],
        }),
      ],
      [room, { id: 2, name: 'B' } as RoomDto],
      UTC,
    );
    const note = w.find((x) => x.key.startsWith('load-11'));
    expect(note).toBeDefined();
    expect(note!.what).toContain('Ada');
  });

  it('describes the schedule and never the person', () => {
    // "Memory of the process, not of people": the note is allowed to say two
    // sessions are adjacent. It is not allowed to conclude anything about who
    // gives them.
    const w = rhythmWarnings(
      [
        session(1, '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z', { speakers: [ada] }),
        session(2, '2026-09-03T10:00:00Z', '2026-09-03T10:45:00Z', { speakers: [ada] }),
      ],
      [room],
      UTC,
    );
    for (const note of w) {
      expect(`${note.what} ${note.why} ${note.rule}`.toLowerCase()).not.toMatch(
        /too much|overload|burn|exhaust|should not/,
      );
    }
  });

  it('leaves a real gap alone', () => {
    const w = rhythmWarnings(
      [
        session(1, '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z', { speakers: [ada] }),
        session(2, '2026-09-03T10:30:00Z', '2026-09-03T11:15:00Z', {
          roomId: 2,
          speakers: [ada],
        }),
      ],
      [room, { id: 2, name: 'B' } as RoomDto],
      UTC,
    );
    expect(w.filter((x) => x.key.startsWith('load-'))).toEqual([]);
  });
});
