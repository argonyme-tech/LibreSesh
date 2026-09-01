import { describe, expect, it } from 'vitest';
import { readiness } from '../web/src/lib/readiness.js';
import type {
  BundleDto,
  PersonDto,
  ProposalDto,
  RoomDto,
  SessionDto,
} from '../server/src/shared/types.js';

/**
 * The organiser's question — *what do I still have to do?* — has never had a
 * view. Every fact is in the app already, shown one session at a time: "no
 * speaker yet" on a detail, a backing count on a pitch card, an over-capacity
 * badge in a list row. Answering the question meant walking the programme and
 * remembering.
 *
 * These pin the sums. They also pin the manners: a finding has to say what it
 * counted, or it cannot be checked against the grid and has to be believed
 * instead — which is the one thing Mímir is not for.
 */
const room = (id: number, capacity: number | null = null): RoomDto =>
  ({ id, name: `R${id}`, capacity, openBooking: false }) as RoomDto;

const person = (id: number, over: Partial<PersonDto> = {}): PersonDto =>
  ({ id, name: `P${id}`, claimed: true, role: 'speaker', ...over }) as PersonDto;

const session = (id: number, day: string, over: Partial<SessionDto> = {}): SessionDto =>
  ({
    id,
    roomId: 1,
    trackId: null,
    title: `S${id}`,
    speakers: [{ id: 1, name: 'P1' }],
    blocksOpenBooking: false,
    startsAt: `${day}T09:00:00Z`,
    endsAt: `${day}T10:00:00Z`,
    ...over,
  }) as SessionDto;

const bundle = (over: Partial<BundleDto> = {}): BundleDto =>
  ({
    event: {
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      timezone: 'UTC',
    },
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

const keys = (b: BundleDto) => readiness(b).map((f) => f.key);

describe('readiness', () => {
  it('says nothing about an event with nothing wrong', () => {
    expect(readiness(bundle({ sessions: [session(1, '2026-09-01')] }))).toEqual([]);
  });

  describe('somebody credited who cannot touch their own session', () => {
    // The sharpest one, and invisible everywhere else. Editing a session you
    // are billed on needs the profile claimed by a device *and* the identity
    // holding at least the speaker role. Being on the poster grants neither.
    it('catches an unclaimed profile', () => {
      const b = bundle({
        sessions: [session(1, '2026-09-01')],
        people: [person(1, { claimed: false, role: null })],
      });
      expect(keys(b)).toContain('speakers-cannot-edit');
    });

    it('catches a claimed profile whose role is still below speaker', () => {
      const b = bundle({
        sessions: [session(1, '2026-09-01')],
        people: [person(1, { claimed: true, role: 'user' })],
      });
      const f = readiness(b).find((x) => x.key === 'speakers-cannot-edit');
      expect(f).toBeDefined();
      expect(f!.soWhat).toContain('there is no button');
    });

    it('leaves a linked speaker alone', () => {
      const b = bundle({
        sessions: [session(1, '2026-09-01')],
        people: [person(1, { claimed: true, role: 'speaker' })],
      });
      expect(keys(b)).not.toContain('speakers-cannot-edit');
    });

    it('says nothing about an admin who also speaks', () => {
      const b = bundle({
        sessions: [session(1, '2026-09-01')],
        people: [person(1, { claimed: true, role: 'admin' })],
      });
      expect(keys(b)).not.toContain('speakers-cannot-edit');
    });
  });

  it('names the most backed pitch nobody placed', () => {
    const b = bundle({
      sessions: [session(1, '2026-09-01')],
      proposals: [
        { id: 1, title: 'Compost', interestCount: 7, placedSessionId: null } as ProposalDto,
        { id: 2, title: 'Quiet', interestCount: 2, placedSessionId: null } as ProposalDto,
        { id: 3, title: 'Done', interestCount: 9, placedSessionId: 4 } as ProposalDto,
      ],
    });
    const f = readiness(b).find((x) => x.key === 'pitches-unplaced');
    expect(f).toBeDefined();
    // The placed one is not outstanding, and the top of the rest is named.
    expect(f!.because).toContain('2 unplaced');
    expect(f!.because).toContain('Compost');
  });

  it('lists the sessions with nobody on the bill', () => {
    const b = bundle({
      sessions: [session(1, '2026-09-01', { speakers: [] }), session(2, '2026-09-01')],
    });
    const f = readiness(b).find((x) => x.key === 'sessions-uncredited');
    expect(f!.because).toContain('1 of 2');
  });

  it('mentions missing breaks only once there is a programme to eat around', () => {
    const span = { startDate: '2026-09-01', endDate: '2026-09-03', timezone: 'UTC' };
    // An empty multi-day event has not been built yet; that is not a finding.
    expect(keys(bundle({ event: span } as Partial<BundleDto>))).not.toContain('no-breaks');
    expect(
      keys(bundle({ event: span, sessions: [session(1, '2026-09-01')] } as Partial<BundleDto>)),
    ).toContain('no-breaks');
  });

  it('finds a day nobody used and a hole inside one', () => {
    const b = bundle({
      event: { startDate: '2026-09-01', endDate: '2026-09-02', timezone: 'UTC' },
      sessions: [
        session(1, '2026-09-01'),
        session(2, '2026-09-01', {
          startsAt: '2026-09-01T15:00:00Z',
          endsAt: '2026-09-01T16:00:00Z',
        }),
      ],
    } as Partial<BundleDto>);
    const f = readiness(b).find((x) => x.key === 'empty-time');
    expect(f).toBeDefined();
    expect(f!.because).toContain('2026-09-02'); // the empty day
    expect(f!.because).toContain('10:00–15:00'); // the hole
    // Which of the two it is depends on the event, and only the organiser knows.
    expect(f!.soWhat).toContain('Only you know which');
  });

  it('does not call an ordinary lunch-length gap a hole', () => {
    const b = bundle({
      sessions: [
        session(1, '2026-09-01'),
        session(2, '2026-09-01', {
          startsAt: '2026-09-01T11:30:00Z',
          endsAt: '2026-09-01T12:30:00Z',
        }),
      ],
    });
    expect(keys(b)).not.toContain('empty-time');
  });

  it('counts who wants in against what the room holds', () => {
    const b = bundle({
      rooms: [room(1, 20)],
      sessions: [session(1, '2026-09-01', { title: 'Fermentation' })],
      starCounts: { 1: 44 },
    });
    const f = readiness(b).find((x) => x.key === 'over-capacity');
    expect(f!.because).toContain('44 starred against a room for 20');
  });

  it('flags a session outside the hours its own track declares', () => {
    const b = bundle({
      tracks: [
        { id: 3, name: 'Workshops', startMin: 540, endMin: 780, windows: [] },
      ] as unknown as BundleDto['tracks'],
      sessions: [
        session(1, '2026-09-01', {
          trackId: 3,
          startsAt: '2026-09-01T16:00:00Z',
          endsAt: '2026-09-01T17:00:00Z',
        }),
      ],
    });
    const f = readiness(b).find((x) => x.key === 'outside-track-hours');
    expect(f!.soWhat).toContain('worse than no rule');
  });

  it('shows the person who is stuck before the list of what is merely absent', () => {
    // Order is not severity, which Mímir has no business scoring. It is: who
    // cannot act, then what people already asked for, then what is missing.
    const b = bundle({
      sessions: [session(1, '2026-09-01', { speakers: [] }), session(2, '2026-09-01')],
      people: [person(1, { claimed: false, role: null })],
      proposals: [
        { id: 1, title: 'Compost', interestCount: 3, placedSessionId: null } as ProposalDto,
      ],
    });
    expect(keys(b).slice(0, 3)).toEqual([
      'speakers-cannot-edit',
      'pitches-unplaced',
      'sessions-uncredited',
    ]);
  });

  it('always says what it counted and what follows from it', () => {
    const b = bundle({
      rooms: [room(1, 5)],
      sessions: [session(1, '2026-09-01', { speakers: [] })],
      people: [person(1, { claimed: false, role: null })],
      proposals: [{ id: 1, title: 'X', interestCount: 1, placedSessionId: null } as ProposalDto],
      starCounts: { 1: 40 },
    });
    for (const f of readiness(b)) {
      // Checkable against the grid, not merely assertive.
      expect(/\d/.test(f.because), `${f.key} counted nothing`).toBe(true);
      expect(f.soWhat.length, `${f.key} states no consequence`).toBeGreaterThan(20);
      expect(f.where.length, `${f.key} leaves nowhere to go`).toBeGreaterThan(5);
    }
  });
});
