import { describe, expect, it } from 'vitest';
import { runSheet } from '../web/src/lib/runsheet.js';
import { digest } from '../web/src/lib/changes.js';
import type {
  AuditEntryDto,
  BundleDto,
  PersonDto,
  RoomDto,
  SessionDto,
} from '../server/src/shared/types.js';

/**
 * The two things an organiser needs during an event, neither of which the app
 * could answer.
 *
 * The grid shows the shape of a day and leaves you to find "now" inside it;
 * and a live schedule changes under everybody with nobody told. Both are
 * answerable from data that already exists — the bundle plus the clock, and
 * the audit log read forwards instead of backwards.
 *
 * Time-dependent code is the hardest kind to trust, so `now` is a parameter
 * and every case here pins a specific minute.
 */
const room = (id: number, name: string): RoomDto => ({ id, name }) as RoomDto;

const person = (id: number, over: Partial<PersonDto> = {}): PersonDto =>
  ({ id, name: `P${id}`, claimed: true, role: 'speaker', ...over }) as PersonDto;

const session = (id: number, from: string, to: string, over: Partial<SessionDto> = {}): SessionDto =>
  ({
    id,
    roomId: 1,
    trackId: null,
    title: `S${id}`,
    speakers: [{ id: 1, name: 'P1' }],
    blocksOpenBooking: false,
    startsAt: `2026-09-01T${from}:00Z`,
    endsAt: `2026-09-01T${to}:00Z`,
    ...over,
  }) as SessionDto;

const bundle = (over: Partial<BundleDto> = {}): BundleDto =>
  ({
    event: { startDate: '2026-09-01', endDate: '2026-09-02', timezone: 'UTC' },
    rooms: [room(1, 'Main Hall'), room(2, 'Workshop A')],
    tracks: [],
    breaks: [],
    sessions: [],
    people: [person(1)],
    proposals: [],
    starCounts: {},
    contributionCounts: {},
    ...over,
  }) as BundleDto;

const at = (hhmm: string) => new Date(`2026-09-01T${hhmm}:00Z`);

describe('the run sheet', () => {
  it('separates what is running from what is coming', () => {
    const b = bundle({
      sessions: [
        session(1, '09:00', '10:00'),
        session(2, '10:15', '11:00', { roomId: 2 }),
      ],
    });
    const sheet = runSheet(b, at('09:30'));
    expect(sheet.running.map((r) => r.session.id)).toEqual([1]);
    expect(sheet.running[0].endsIn).toBe(30);
    expect(sheet.running[0].roomName).toBe('Main Hall');
    expect(sheet.next.map((n) => n.session.id)).toEqual([2]);
    expect(sheet.next[0].startsIn).toBe(45);
  });

  it('stops at two hours ahead — past that it is the schedule, not a shift', () => {
    const b = bundle({
      sessions: [session(1, '09:00', '10:00'), session(2, '14:00', '15:00')],
    });
    expect(runSheet(b, at('08:00')).next.map((n) => n.session.id)).toEqual([1]);
  });

  it('warns before you go looking for somebody who cannot edit their session', () => {
    // Better known while walking to the room than after knocking on the door.
    const b = bundle({
      sessions: [session(1, '10:00', '11:00')],
      people: [person(1, { claimed: false, role: null })],
    });
    expect(runSheet(b, at('09:45')).next[0].stuck).toEqual(['P1']);
  });

  it('flags a session nobody is credited for', () => {
    const b = bundle({ sessions: [session(1, '10:00', '11:00', { speakers: [] })] });
    expect(runSheet(b, at('09:45')).next[0].uncredited).toBe(true);
  });

  it('counts only the closure still ahead, since a passed hour cannot be booked', () => {
    const b = bundle({
      sessions: [
        session(1, '09:00', '11:00', { blocksOpenBooking: true }),
        session(2, '14:00', '15:00', { blocksOpenBooking: true }),
      ],
    });
    // Half an hour into the first, plus the whole of the second.
    expect(runSheet(b, at('10:30')).floorHeldMin).toBe(90);
  });

  it('says which break is on and which is next', () => {
    const b = bundle({
      sessions: [session(1, '09:00', '10:00')],
      breaks: [
        { id: 1, label: 'Lunch', startMin: 780, endMin: 840, date: null },
        { id: 2, label: 'Coffee', startMin: 960, endMin: 990, date: null },
      ],
    });
    const during = runSheet(b, at('13:15'));
    expect(during.breakNow?.label).toBe('Lunch');
    expect(during.breakNext?.brk.label).toBe('Coffee');
    expect(during.breakNext?.startsIn).toBe(165); // 16:00 less 13:15
  });

  it('ignores a break pinned to another day', () => {
    const b = bundle({
      sessions: [session(1, '09:00', '10:00')],
      breaks: [{ id: 1, label: 'Dinner', startMin: 780, endMin: 840, date: '2026-09-02' }],
    });
    expect(runSheet(b, at('13:15')).breakNow).toBeNull();
  });

  it('knows when the day is done, and when it is not this event at all', () => {
    const b = bundle({ sessions: [session(1, '09:00', '10:00')] });
    expect(runSheet(b, at('18:00')).done).toBe(true);
    // A blank sheet on the wrong day would read as "nothing scheduled" rather
    // than "you are not looking at an event day".
    const off = runSheet(b, new Date('2026-10-01T10:00:00Z'));
    expect(off.offDay).toBe(true);
    expect(off.done).toBe(false);
  });
});

describe('what changed since you last looked', () => {
  const entry = (id: number, over: Partial<AuditEntryDto> = {}): AuditEntryDto =>
    ({
      id,
      at: '2026-09-01T10:00:00Z',
      actorName: 'Ada',
      actorUid: null,
      action: 'update',
      entity: 'session',
      entityId: 5,
      entityLabel: 'Opening keynote',
      ...over,
    }) as AuditEntryDto;

  it('says the thing rather than the row', () => {
    // "update session — Opening keynote" is a log line. The reader wants a
    // sentence they can act on.
    const d = digest([entry(3)], null);
    expect(d.changes[0].said).toBe('“Opening keynote” was edited');
    expect(d.changes[0].who).toBe('Ada');
  });

  it('only shows what is newer than the mark', () => {
    const d = digest([entry(5), entry(4), entry(3)], 4);
    expect(d.changes.map((c) => c.id)).toEqual([5]);
  });

  it('drops housekeeping instead of padding the list with it', () => {
    // A sign-in, an export and a backup change nothing anybody would see.
    const d = digest(
      [
        entry(9, { action: 'auth_demo', entity: 'event' }),
        entry(8, { action: 'export', entity: 'event' }),
        entry(7, { action: 'create', entity: 'room', entityLabel: 'Barn' }),
      ],
      null,
    );
    expect(d.changes.map((c) => c.said)).toEqual(['Room Barn was added']);
    // Counted rather than hidden, so quiet can be told from filtered.
    expect(d.ignored).toBe(2);
  });

  it('moves the mark past the housekeeping it filtered out', () => {
    // Otherwise those rows come back on every visit, forever.
    const d = digest([entry(9, { action: 'auth_demo' }), entry(7, { action: 'create' })], null);
    expect(d.mark).toBe(9);
  });

  it('leaves the mark alone when nothing is new', () => {
    expect(digest([entry(4), entry(3)], 4).mark).toBeNull();
  });

  it('reads a placement as what it means on the grid', () => {
    const d = digest([entry(2, { action: 'place', entity: 'proposal', entityLabel: 'Compost' })], null);
    expect(d.changes[0].said).toBe('“Compost” was placed on the grid');
  });

  it('names an actor it does not know without inventing one', () => {
    const d = digest([entry(2, { actorName: '' })], null);
    expect(d.changes[0].who).toBe('Someone');
  });

  it('survives a label that is gone', () => {
    // A hard-deleted row resolves to nothing, and the log still has to read.
    const d = digest([entry(2, { entityLabel: '', entity: 'session' })], null);
    expect(d.changes[0].said).toBe('A session was edited');
  });
});
