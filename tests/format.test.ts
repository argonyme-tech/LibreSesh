import { describe, expect, it } from 'vitest';
import { dayRangeLabel } from '../web/src/lib/format.js';

/** The first web-side unit test. `format.ts` is pure and DOM-free, so it runs
 *  in the same node environment as everything else. */
describe('dayRangeLabel', () => {
  it('collapses the month when a span stays inside one', () => {
    expect(dayRangeLabel('2026-06-01', '2026-06-07')).toBe('1–7 Jun');
  });

  it('names both months when a span straddles one', () => {
    expect(dayRangeLabel('2026-06-29', '2026-07-05')).toBe('29 Jun – 5 Jul');
  });

  it('names both months across a year boundary', () => {
    expect(dayRangeLabel('2026-12-28', '2027-01-03')).toBe('28 Dec – 3 Jan');
  });

  it('renders a single day once', () => {
    expect(dayRangeLabel('2026-06-04', '2026-06-04')).toBe('4 Jun');
  });
});

describe('id formatting', () => {
  it('labels the two id spaces distinctly', async () => {
    const { uid, rowId } = await import('../web/src/lib/format.js');
    // UIDs are the server's random hex code, shown uppercased.
    expect(uid('a3f9c')).toBe('UID: A3F9C');
    // Row ids are per-event integers, zero-padded to line up in columns.
    expect(rowId(12)).toBe('ID: 00012');
    expect(rowId(123456)).toBe('ID: 123456');
  });

  /** The button at the end of a day's list. The last day has nothing after
   *  it, and a day outside the event's range is not a place to count from. */
  it('knows which day comes next, and when there is none', async () => {
    const { dayAfter } = await import('../web/src/lib/format.js');
    const days = ['2026-06-01', '2026-06-02', '2026-06-03'];
    expect(dayAfter(days, '2026-06-01')).toBe('2026-06-02');
    expect(dayAfter(days, '2026-06-03')).toBeNull();
    expect(dayAfter(days, '2026-07-01')).toBeNull();
    expect(dayAfter([], '2026-06-01')).toBeNull();
  });
});
