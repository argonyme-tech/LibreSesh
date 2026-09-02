import { describe, expect, it } from 'vitest';
import type { PersonDto } from '../server/src/shared/types.js';
import {
  PEOPLE_FILTERS,
  filterCounts,
  filterPeople,
  matchesFilter,
  matchesSearch,
  personStatus,
  sortPeople,
} from '../web/src/lib/people.js';

/**
 * The People list is one list now, holding both the people who have arrived
 * and the shells an organiser is expecting. These are the decisions that tell
 * them apart, kept out of the component so they can be checked without a DOM.
 */
const person = (over: Partial<PersonDto> & { id: number; name: string }): PersonDto => ({
  bio: '',
  links: [],
  isMine: false,
  claimed: false,
  username: null,
  creditable: true,
  updatedAt: '2026-09-01T10:00:00.000Z',
  ...over,
});

const organiser = person({
  id: 1,
  name: 'Ada Lovelace',
  claimed: true,
  username: 'ada',
  role: 'admin',
  holderUid: 'a1b2c',
  lastSeenAt: '2026-09-02T12:00:00.000Z',
  sessionCount: 3,
});
const speaker = person({
  id: 2,
  name: 'Grace Hopper',
  claimed: true,
  username: 'grace',
  role: 'speaker',
  holderUid: 'f9e8d',
  lastSeenAt: '2026-09-02T09:00:00.000Z',
});
const attendee = person({
  id: 3,
  name: 'Sam Chen',
  claimed: true,
  username: 'sam',
  role: 'user',
  holderUid: '11111',
  lastSeenAt: '2026-09-02T11:00:00.000Z',
});
const departed = person({
  id: 4,
  name: 'Jo Park',
  claimed: true,
  username: 'jo',
  role: null,
  holderUid: '22222',
  lastSeenAt: '2026-09-01T08:00:00.000Z',
});
const shell = person({ id: 5, name: 'Alan Turing' });
const everyone = [organiser, speaker, attendee, departed, shell];

describe('the People list', () => {
  describe('segments', () => {
    it('splits arrived from unclaimed, and that split covers everyone', () => {
      expect(everyone.filter((p) => matchesFilter(p, 'arrived')).map((p) => p.id)).toEqual([
        1, 2, 3, 4,
      ]);
      expect(everyone.filter((p) => matchesFilter(p, 'unclaimed')).map((p) => p.id)).toEqual([5]);
    });

    it('treats organisers and speakers as lenses, not a third state', () => {
      // Both have arrived, so both are under "arrived" too — the counts say so
      // rather than the segments pretending to partition.
      expect(matchesFilter(organiser, 'arrived')).toBe(true);
      expect(matchesFilter(organiser, 'organisers')).toBe(true);
      expect(matchesFilter(speaker, 'speakers')).toBe(true);
      expect(matchesFilter(attendee, 'organisers')).toBe(false);
      expect(matchesFilter(shell, 'speakers')).toBe(false);
    });

    it('counts every segment in one pass', () => {
      expect(filterCounts(everyone)).toEqual({
        all: 5,
        arrived: 4,
        unclaimed: 1,
        organisers: 1,
        speakers: 1,
      });
    });

    it('offers every segment it can count', () => {
      expect(PEOPLE_FILTERS.map((f) => f.id).sort()).toEqual(
        Object.keys(filterCounts(everyone)).sort(),
      );
    });
  });

  describe('search', () => {
    it('matches the full name, the username or the UID, case-insensitively', () => {
      expect(matchesSearch(organiser, 'lovel')).toBe(true);
      expect(matchesSearch(organiser, 'ADA')).toBe(true);
      expect(matchesSearch(organiser, 'A1B2C')).toBe(true);
      expect(matchesSearch(organiser, 'grace')).toBe(false);
    });

    it('matches everyone when it is empty or only spaces', () => {
      for (const p of everyone) expect(matchesSearch(p, '   ')).toBe(true);
    });

    it('does not exclude a shell for having no username or UID', () => {
      expect(matchesSearch(shell, 'turing')).toBe(true);
      expect(matchesSearch(shell, 'a1b2c')).toBe(false);
    });
  });

  describe('order', () => {
    it('sorts by full name by default', () => {
      expect(sortPeople(everyone, 'name').map((p) => p.name)).toEqual([
        'Ada Lovelace',
        'Alan Turing',
        'Grace Hopper',
        'Jo Park',
        'Sam Chen',
      ]);
    });

    it('sorts by who was here most recently, leaving the never-seen last', () => {
      expect(sortPeople(everyone, 'seen').map((p) => p.id)).toEqual([1, 3, 2, 4, 5]);
    });

    it('does not reorder the list it was given', () => {
      const before = everyone.map((p) => p.id);
      sortPeople(everyone, 'seen');
      expect(everyone.map((p) => p.id)).toEqual(before);
    });
  });

  /** You are the row you most often want and the one you can identify
   *  without reading it, so hunting for yourself alphabetically in a room of
   *  two hundred is friction with nothing to show for it. */
  it('puts you first, whatever the order or segment', () => {
    const me = { ...attendee, isMine: true };
    const withMe = [organiser, speaker, me, departed, shell];
    expect(filterPeople(withMe, 'all', '', 'name')[0]?.id).toBe(me.id);
    expect(filterPeople(withMe, 'all', '', 'seen')[0]?.id).toBe(me.id);
    expect(filterPeople(withMe, 'arrived', '', 'name')[0]?.id).toBe(me.id);
    // And keeps the rest in the order they asked for.
    expect(filterPeople(withMe, 'all', '', 'name').map((p) => p.name)).toEqual([
      'Sam Chen',
      'Ada Lovelace',
      'Alan Turing',
      'Grace Hopper',
      'Jo Park',
    ]);
  });

  it('leaves you out when the segment does not hold you', () => {
    const me = { ...attendee, isMine: true };
    expect(filterPeople([organiser, me, shell], 'unclaimed', '', 'name').map((p) => p.id)).toEqual([
      shell.id,
    ]);
  });

  it('applies the segment, the search and the order together', () => {
    expect(filterPeople(everyone, 'arrived', 'a', 'name').map((p) => p.name)).toEqual([
      'Ada Lovelace',
      'Grace Hopper',
      'Jo Park',
      'Sam Chen',
    ]);
    expect(filterPeople(everyone, 'unclaimed', 'ada', 'name')).toEqual([]);
  });

  describe('the badge a row wears', () => {
    it('names the three states an organiser acts on differently', () => {
      expect(personStatus(shell)).toEqual({ kind: 'unclaimed' });
      expect(personStatus(departed)).toEqual({ kind: 'signed-out' });
      expect(personStatus(speaker)).toEqual({ kind: 'role', role: 'speaker' });
    });
  });
});
