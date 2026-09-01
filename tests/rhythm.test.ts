import { describe, expect, it } from 'vitest';
import { rhythmWarnings } from '../web/src/components/RhythmCheck.js';
import type { RoomDto, SessionDto } from '../server/src/shared/types.js';

/** Mímir add-on: the rhythm checks are pure over the bundle, so they test
 *  like format.ts does — no DOM. */

const room = { id: 1, name: 'Main Hall' } as RoomDto;
const session = (id: number, startsAt: string, endsAt: string, roomId = 1): SessionDto =>
  ({ id, roomId, title: `S${id}`, startsAt, endsAt }) as SessionDto;

describe('rhythmWarnings', () => {
  it('stays silent on a schedule with breaks and short blocks', () => {
    const sessions = [
      session(1, '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z'),
      session(2, '2026-09-03T10:15:00Z', '2026-09-03T11:15:00Z'),
    ];
    expect(rhythmWarnings(sessions, [room])).toEqual([]);
  });

  it('flags a single session over 90 minutes', () => {
    const w = rhythmWarnings([session(1, '2026-09-03T09:00:00Z', '2026-09-03T11:00:00Z')], [room]);
    expect(w).toHaveLength(1);
    expect(w[0].key).toBe('long-1');
    expect(w[0].what).toContain('120 min');
  });

  it('flags back-to-back sessions that chain past 90 minutes without a break', () => {
    const sessions = [
      session(1, '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z'),
      session(2, '2026-09-03T10:05:00Z', '2026-09-03T11:00:00Z'), // 5 min is not a break
    ];
    const w = rhythmWarnings(sessions, [room]);
    expect(w).toHaveLength(1);
    expect(w[0].key).toBe('chain-1-1');
    expect(w[0].what).toContain('Main Hall');
  });

  it('does not chain across rooms — parallel tracks are not one block', () => {
    const sessions = [
      session(1, '2026-09-03T09:00:00Z', '2026-09-03T10:00:00Z', 1),
      session(2, '2026-09-03T10:05:00Z', '2026-09-03T11:00:00Z', 2),
    ];
    expect(rhythmWarnings(sessions, [room, { id: 2, name: 'B' } as RoomDto])).toEqual([]);
  });
});
