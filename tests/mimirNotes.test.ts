import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  notesForDay,
  notesForPerson,
  notesForPitch,
  notesForSession,
} from '../web/src/lib/mimirNotes.js';
import type {
  BundleDto,
  PersonDto,
  ProposalDto,
  RoomDto,
  SessionDto,
} from '../server/src/shared/types.js';

/**
 * Mímir outside her own tab.
 *
 * Her page is where you go on purpose, which is the wrong place for most of
 * what she knows: the moment a note is useful is the moment you are looking at
 * the thing it is about. These pin the four surfaces she now speaks on, and —
 * more importantly — pin the manners, because a note appearing beside somebody
 * else's work has to clear a higher bar than one on a page devoted to her.
 */
const room = (id: number, over: Partial<RoomDto> = {}): RoomDto =>
  ({ id, name: `R${id}`, capacity: null, openBooking: false, ...over }) as RoomDto;

const person = (id: number, over: Partial<PersonDto> = {}): PersonDto =>
  ({ id, name: `P${id}`, claimed: true, role: 'speaker', ...over }) as PersonDto;

const session = (id: number, over: Partial<SessionDto> = {}): SessionDto =>
  ({
    id,
    roomId: 1,
    trackId: null,
    title: `S${id}`,
    speakers: [{ id: 1, name: 'P1' }],
    blocksOpenBooking: false,
    startsAt: '2026-09-01T09:00:00Z',
    endsAt: '2026-09-01T10:00:00Z',
    ...over,
  }) as SessionDto;

const bundle = (over: Partial<BundleDto> = {}): BundleDto =>
  ({
    event: { startDate: '2026-09-01', endDate: '2026-09-01', timezone: 'UTC' },
    rooms: [room(1)],
    tracks: [],
    breaks: [],
    sessions: [],
    people: [person(1)],
    proposals: [],
    starCounts: {},
    contributionCounts: {},
    ...over,
  }) as BundleDto;

const keys = (ns: { key: string }[]) => ns.map((n) => n.key);

describe('beside a session', () => {
  it('says nothing about an ordinary one', () => {
    // Ahead of time on purpose: a session in the past is never ordinary to
    // her, because by then the only question left is what was kept.
    const s = session(1, { startsAt: '2099-01-01T09:00:00Z', endsAt: '2099-01-01T10:00:00Z' });
    expect(notesForSession(s, bundle({ sessions: [s] }))).toEqual([]);
  });

  it('names whoever on the bill cannot edit it', () => {
    // The finding that exists nowhere else in the app, put where the person
    // giving the session will actually see it.
    const s = session(1);
    const b = bundle({ sessions: [s], people: [person(1, { claimed: false, role: null })] });
    const note = notesForSession(s, b).find((n) => n.key === 'stuck');
    expect(note!.what).toContain('P1');
  });

  it('counts the minutes it takes out of a declared meal', () => {
    const s = session(1, { startsAt: '2026-09-01T12:30:00Z', endsAt: '2026-09-01T13:30:00Z' });
    const b = bundle({
      sessions: [s],
      breaks: [{ id: 9, label: 'Lunch', startMin: 720, endMin: 840, date: null }],
    });
    const note = notesForSession(s, b).find((n) => n.key === `break-9`);
    expect(note!.what).toContain('60 min out of Lunch');
    expect(note!.because).toContain('12:00–14:00');
  });

  it('asks after the harvest only once the session has ended', () => {
    const past = session(1, {
      startsAt: '2020-01-01T09:00:00Z',
      endsAt: '2020-01-01T10:00:00Z',
    });
    const future = session(2, {
      startsAt: '2099-01-01T09:00:00Z',
      endsAt: '2099-01-01T10:00:00Z',
    });
    const b = bundle({ sessions: [past, future] });
    expect(keys(notesForSession(past, b))).toContain('harvest');
    expect(keys(notesForSession(future, b))).not.toContain('harvest');
  });

  it('says nothing about the harvest when something was kept', () => {
    const past = session(1, {
      startsAt: '2020-01-01T09:00:00Z',
      endsAt: '2020-01-01T10:00:00Z',
    });
    const b = bundle({ sessions: [past], contributionCounts: { 1: 3 } });
    expect(keys(notesForSession(past, b))).not.toContain('harvest');
  });
});

describe('beside a pitch', () => {
  const pitch = (over: Partial<ProposalDto> = {}): ProposalDto =>
    ({ id: 1, title: 'Compost', interestCount: 0, placedSessionId: null, speakerId: 1, ...over }) as ProposalDto;

  it('goes quiet once it has a slot', () => {
    expect(notesForPitch(pitch({ placedSessionId: 7, interestCount: 9 }), bundle())).toEqual([]);
  });

  it('says who could place it, which depends on the rooms', () => {
    // With an open room an attendee can put it up themselves; without one it
    // is an organiser's call. Same backing, different next step.
    const open = notesForPitch(pitch({ interestCount: 4 }), bundle({ rooms: [room(1, { openBooking: true })] }));
    expect(open[0].because).toContain('without an organiser');

    const closed = notesForPitch(pitch({ interestCount: 4 }), bundle());
    expect(closed[0].because).toContain('only an organiser');
  });

  it('separates having no host from having no slot', () => {
    const n = notesForPitch(pitch({ interestCount: 3, speakerId: null }), bundle());
    expect(keys(n)).toEqual(['backed', 'nohost']);
  });
});

describe('beside a person, on the row that fixes it', () => {
  it('ignores somebody who gives nothing', () => {
    expect(notesForPerson(person(1, { claimed: false }), bundle())).toEqual([]);
  });

  it('counts their sessions when nobody holds the profile', () => {
    const b = bundle({
      sessions: [session(1), session(2, { startsAt: '2026-09-01T14:00:00Z', endsAt: '2026-09-01T15:00:00Z' })],
      people: [person(1, { claimed: false, role: null })],
    });
    const note = notesForPerson(b.people[0], b).find((n) => n.key === 'cannot-edit');
    expect(note!.what).toContain('their 2 sessions');
    expect(note!.because).toContain('Nobody holds');
  });

  it('says nothing about a holder whatever their role', () => {
    // Upstream 486077a: credited is the qualification. A claimed attendee
    // edits their own talk; a note saying otherwise would be wrong.
    const b = bundle({
      sessions: [session(1)],
      people: [person(1, { claimed: true, role: 'user' })],
    });
    expect(notesForPerson(b.people[0], b).map((n) => n.key)).not.toContain('cannot-edit');
  });

  it('states adjacency and never judges the person', () => {
    // "Memory of the process, not of people." The note may say two sessions
    // touch. It may not conclude anything about who is giving them.
    const b = bundle({
      sessions: [
        session(1),
        session(2, { startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z' }),
      ],
    });
    const notes = notesForPerson(b.people[0], b);
    expect(keys(notes)).toContain('back-to-back');
    for (const n of notes) {
      expect(`${n.what} ${n.because} ${n.hint ?? ''}`.toLowerCase()).not.toMatch(
        /too much|overload|burn|exhaust|should not|unfair/,
      );
    }
  });
});

describe('beside a day', () => {
  it('offers an empty day without deciding what it means', () => {
    const n = notesForDay('2026-09-01', bundle());
    expect(keys(n)).toEqual(['empty-day']);
    expect(n[0].hint).toContain('Only you know which');
  });

  it('adds up how long the floor is closed', () => {
    const b = bundle({
      sessions: [
        session(1, { blocksOpenBooking: true, title: 'Plenary' }),
        session(2, {
          blocksOpenBooking: true,
          title: 'Closing',
          startsAt: '2026-09-01T16:00:00Z',
          endsAt: '2026-09-01T17:00:00Z',
        }),
      ],
      breaks: [{ id: 1, label: 'Lunch', startMin: 720, endMin: 840, date: null }],
    });
    const note = notesForDay('2026-09-01', b).find((n) => n.key === 'floor-held');
    expect(note!.what).toContain('120 min');
    expect(note!.because).toContain('Plenary');
  });
});

describe('the manners every note keeps', () => {
  // The bar for speaking beside somebody else's work: say what you counted,
  // and leave somewhere to go.
  const busy = bundle({
    rooms: [room(1, { capacity: 5 })],
    sessions: [
      session(1, {
        startsAt: '2026-09-01T12:00:00Z',
        endsAt: '2026-09-01T15:00:00Z',
        blocksOpenBooking: true,
        speakers: [],
      }),
    ],
    breaks: [{ id: 1, label: 'Lunch', startMin: 780, endMin: 840, date: null }],
    starCounts: { 1: 40 },
    people: [person(1, { claimed: false, role: null })],
  });

  it('counts something in every note', () => {
    const all = [
      ...notesForSession(busy.sessions[0], busy),
      ...notesForDay('2026-09-01', busy),
      ...notesForPerson(busy.people[0], busy),
    ];
    expect(all.length).toBeGreaterThan(3);
    for (const n of all) {
      expect(/\d/.test(`${n.what} ${n.because}`), `${n.key} counted nothing`).toBe(true);
    }
  });
});

/**
 * A note is only worth writing if it reaches the surface it was written for.
 * The tab was unreachable for a whole day because the route existed and
 * nothing linked to it; the same silence is available to these.
 */
describe('the surfaces render her', () => {
  const web = (...p: string[]) => readFileSync(join(__dirname, '..', 'web', 'src', ...p), 'utf8');

  it('puts a note beside the pitch it is about', () => {
    const src = web('components', 'ProposalBoard.tsx');
    expect(src).toContain('notesForPitch');
    expect(src).toContain('<MimirAside');
  });

  it('puts one beside a session, in both of its layouts', () => {
    // Panel over the grid and full page are separate returns in the same
    // component; wiring one and not the other is the easy mistake.
    const src = web('components', 'SessionDetail.tsx');
    expect(src.match(/\{aside\}/g) ?? []).toHaveLength(2);
    expect(web('pages', 'SchedulePage.tsx')).toContain('notesForSession');
  });

  it('puts one on the People row that repairs it', () => {
    const src = web('pages', 'AdminPage.tsx');
    expect(src).toContain('notesForPerson');
    expect(src).toContain('<MimirAside');
  });

  it('renders nothing at all when there is nothing to say', () => {
    // Not an empty panel and not a quiet badge: no element, so a healthy
    // programme never grows chrome it did not ask for.
    expect(web('components', 'MimirAside.tsx')).toContain('if (notes.length === 0) return null;');
  });
});
