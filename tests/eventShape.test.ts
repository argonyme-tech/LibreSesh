import { describe, expect, it } from 'vitest';
import { eventShape, type ShapeInput } from '../web/src/lib/eventShape.js';
import type { ProposalDto, RoomDto, SessionDto } from '../server/src/shared/types.js';

/**
 * LibreSesh is billed as an "(un)conference scheduler", and Mímir was reading
 * every event as one: the first version of her manual said an event with a
 * closed room is a programme and an event with an open one is an unconference,
 * and that was the whole taxonomy.
 *
 * It produces confident, wrong advice. Told to protect the open hours at an
 * event where nobody can book anything, she is talking about a floor that does
 * not exist, and nothing in the system notices.
 *
 * The shape is readable instead. Open booking is a property of rooms, a session
 * either holds the floor or does not, breaks are declared, repeats are visible.
 * These cases pin the readings — and, as much, pin where a reading admits it is
 * unsure, because a wrong shape stated confidently is worse than a question.
 */
const room = (id: number, openBooking = false): RoomDto =>
  ({ id, name: `R${id}`, openBooking, capacity: null }) as RoomDto;

const session = (id: number, day: string, extra: Partial<SessionDto> = {}): SessionDto =>
  ({
    id,
    roomId: 1,
    trackId: null,
    title: `S${id}`,
    speakers: [],
    blocksOpenBooking: false,
    startsAt: `${day}T09:00:00Z`,
    endsAt: `${day}T10:00:00Z`,
    ...extra,
  }) as SessionDto;

const pitch = (id: number): ProposalDto => ({ id, placedSessionId: null }) as ProposalDto;

const base = (over: Partial<ShapeInput> = {}): ShapeInput => ({
  rooms: [],
  tracks: [],
  breaks: [],
  sessions: [],
  proposals: [],
  event: { startDate: '2026-09-01', endDate: '2026-09-01', timezone: 'UTC' },
  ...over,
});

describe('eventShape', () => {
  it('admits an empty event rather than reading a shape into it', () => {
    // An event with no rooms is not "a fixed programme" — it is unbuilt, and
    // saying so is the only honest answer.
    const s = eventShape(base());
    expect(s.name).toBe('Not built yet');
    expect(s.certain).toBe(false);
  });

  it('reads a fixed programme when nothing can be booked', () => {
    const s = eventShape(
      base({ rooms: [room(1), room(2)], sessions: [session(1, '2026-09-01')] }),
    );
    expect(s.name).toBe('Fixed programme');
    // The consequence is the point: the open-floor advice does not apply.
    expect(s.soWhat).toContain('does not apply here');
  });

  it('reads an open floor from a bookable room', () => {
    const s = eventShape(
      base({ rooms: [room(1, true), room(2)], proposals: [pitch(1), pitch(2)] }),
    );
    expect(s.name).toBe('Open floor');
    expect(s.because).toContain('2 pitches');
  });

  it('reads a hybrid, which a binary always got wrong', () => {
    // The most common real shape: a spine everyone attends, plus rooms anyone
    // can book into. Neither "programme" nor "unconference" describes it.
    const s = eventShape(
      base({
        rooms: [room(1, true), room(2)],
        sessions: [session(1, '2026-09-01', { blocksOpenBooking: true })],
      }),
    );
    expect(s.name).toBe('Hybrid');
    expect(s.certain).toBe(true);
  });

  it('reads a residency from its length and its meals', () => {
    const s = eventShape(
      base({
        rooms: [room(1)],
        breaks: [{ id: 1, label: 'Lunch', startMin: 720, endMin: 840, date: null }],
        event: { startDate: '2026-09-01', endDate: '2026-09-07' },
        sessions: [session(1, '2026-09-01')],
      }),
    );
    expect(s.name).toBe('Residency or gathering');
    expect(s.soWhat).toContain('sustaining people');
  });

  it('reads a course from sessions that come back', () => {
    const s = eventShape(
      base({
        rooms: [room(1)],
        event: { startDate: '2026-09-01', endDate: '2026-09-03' },
        sessions: [
          session(1, '2026-09-01', { title: 'Module A' }),
          session(2, '2026-09-02', { title: 'Module A' }),
          session(3, '2026-09-01', { title: 'Module B' }),
          session(4, '2026-09-02', { title: 'Module B' }),
          session(5, '2026-09-03', { title: 'Module C' }),
          session(6, '2026-09-01', { title: 'Module C' }),
        ],
      }),
    );
    expect(s.name).toBe('Course or training');
    expect(s.soWhat).toContain('Order is load-bearing');
  });

  it('is unsure about an assembly, and says so', () => {
    // One room and a couple of open pitches is a thin signal. It is worth
    // offering, and not worth asserting.
    const s = eventShape(
      base({ rooms: [room(1)], proposals: [pitch(1)], sessions: [session(1, '2026-09-01')] }),
    );
    expect(s.name).toBe('Assembly or decision meeting');
    expect(s.certain).toBe(false);
  });

  it('counts days in the event\'s timezone, not UTC\'s', () => {
    // Los Angeles: 09:00 and 17:00 local on the same day are two UTC dates.
    // Bucketed by UTC these read as a title that comes back on another day,
    // and two such titles would make a one-day programme "a course".
    const s = eventShape(
      base({
        rooms: [room(1)],
        event: { startDate: '2026-09-10', endDate: '2026-09-10', timezone: 'America/Los_Angeles' },
        sessions: [
          session(1, '2026-09-10', { title: 'Intro', startsAt: '2026-09-10T16:00:00Z', endsAt: '2026-09-10T17:00:00Z' }),
          session(2, '2026-09-10', { title: 'Intro', startsAt: '2026-09-11T00:00:00Z', endsAt: '2026-09-11T01:00:00Z' }),
          session(3, '2026-09-10', { title: 'Method', startsAt: '2026-09-10T17:00:00Z', endsAt: '2026-09-10T18:00:00Z' }),
          session(4, '2026-09-10', { title: 'Method', startsAt: '2026-09-11T01:00:00Z', endsAt: '2026-09-11T02:00:00Z' }),
        ],
      }),
    );
    expect(s.name).not.toBe('Course or training');
  });

  it('always says what it counted', () => {
    // Every reading has to be checkable against the grid by the person reading
    // it — that is what makes a correction cheap instead of an argument.
    for (const input of [
      base(),
      base({ rooms: [room(1, true)] }),
      base({ rooms: [room(1)], sessions: [session(1, '2026-09-01')] }),
    ]) {
      const s = eventShape(input);
      expect(s.because.length, 'a reading with no evidence').toBeGreaterThan(20);
      expect(s.soWhat.length, 'a reading with no consequence').toBeGreaterThan(20);
    }
  });
});
