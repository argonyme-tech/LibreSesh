import type { PersonDto, Role } from '@shared/types';

/**
 * The People list, as decisions that can be made without a DOM.
 *
 * Everyone who enters an event is a person in it, so one list now holds both
 * halves of what used to be two: the people who have arrived, and the shells
 * an organiser typed in for people they are expecting. These predicates are
 * what tells them apart, and the merge dialog reuses them for its search.
 */

export type PeopleFilter = 'all' | 'arrived' | 'unclaimed' | 'organisers' | 'speakers';

/**
 * The segments are lenses, not a partition: an organiser has also arrived, so
 * they are counted under both. The one real split is arrived vs unclaimed.
 *
 * "Arrived" rather than "attendees" on purpose — `user` is a role whose label
 * an organiser can change, and this segment is not that role, it is everyone
 * whose profile somebody holds.
 */
export const PEOPLE_FILTERS: { id: PeopleFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'unclaimed', label: 'Unclaimed' },
  { id: 'organisers', label: 'Organisers' },
  { id: 'speakers', label: 'Speakers' },
];

export function matchesFilter(person: PersonDto, filter: PeopleFilter): boolean {
  switch (filter) {
    case 'all':
      return true;
    case 'arrived':
      return person.claimed;
    case 'unclaimed':
      return !person.claimed;
    case 'organisers':
      return person.role === 'admin';
    case 'speakers':
      return person.role === 'speaker';
  }
}

/** Free text against the three things that identify somebody: their full
 *  name, their username, and the UID the audit log calls them. */
export function matchesSearch(person: PersonDto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  return [person.name, person.username ?? '', person.holderUid ?? ''].some((field) =>
    field.toLowerCase().includes(q),
  );
}

export type PeopleSort = 'name' | 'seen';

/**
 * By name, or by who was here most recently. A profile nobody holds has never
 * been seen, so it sorts last under `seen` rather than first — it is not new,
 * it is absent.
 */
export function sortPeople(people: PersonDto[], sort: PeopleSort): PersonDto[] {
  const rows = [...people];
  if (sort === 'name') {
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  }
  return rows.sort((a, b) => (b.lastSeenAt ?? '').localeCompare(a.lastSeenAt ?? ''));
}

export function filterPeople(
  people: PersonDto[],
  filter: PeopleFilter,
  query: string,
  sort: PeopleSort = 'name',
): PersonDto[] {
  return sortPeople(
    people.filter((p) => matchesFilter(p, filter) && matchesSearch(p, query)),
    sort,
  );
}

/** How many each segment would show, for the counts on the control. Ignores
 *  the search box: a count that moved as you typed would make the segments
 *  look like they were losing people. */
export function filterCounts(people: PersonDto[]): Record<PeopleFilter, number> {
  const counts = { all: 0, arrived: 0, unclaimed: 0, organisers: 0, speakers: 0 };
  for (const person of people) {
    for (const { id } of PEOPLE_FILTERS) {
      if (matchesFilter(person, id)) counts[id] += 1;
    }
  }
  return counts;
}

/**
 * The one badge a row wears. `signed out` is the state that has no name
 * anywhere else: somebody holds this profile, but they left the event (or an
 * organiser took their role away), so they are neither an unclaimed shell nor
 * a person with a role.
 */
export type PersonStatus = { kind: 'role'; role: Role } | { kind: 'signed-out' } | { kind: 'unclaimed' };

export function personStatus(person: PersonDto): PersonStatus {
  if (!person.claimed) return { kind: 'unclaimed' };
  if (person.role == null) return { kind: 'signed-out' };
  return { kind: 'role', role: person.role };
}

/* ------------------------------------------------------------------ merge */

/**
 * Merging is the one thing an organiser cannot undo, and the wrong pick moves
 * somebody's sessions — and possibly their whole history in the event — onto a
 * stranger. So the dialog does not just list names alphabetically and hope:
 * it puts the rows that look like the same human first, and says why it thinks
 * so, leaving the judgement where it belongs.
 */
export interface MergeSuggestion {
  person: PersonDto;
  score: number;
  /** Shown on the row. The organiser is agreeing with a reason, not a rank. */
  why: string;
}

/** Lowercased, punctuation dropped, runs of space collapsed: `"A. Lovelace"`
 *  and `"a  lovelace"` become the same string, which is the whole point. */
const norm = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[.,'’`_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const namesOf = (person: PersonDto): string[] =>
  [norm(person.name), person.username === null ? '' : norm(person.username)].filter(
    (n) => n !== '',
  );

/** "a" against "ada": one is the other's opening letter, which is what an
 *  initial is. Equal strings are not an initial match, they are the same word. */
const isInitialOf = (a: string, b: string): boolean =>
  a !== b && ((a.length === 1 && b.startsWith(a)) || (b.length === 1 && a.startsWith(b)));

function scorePair(a: string, b: string): MergeSuggestion['why'] | null {
  if (a === b) return 'same name';

  const at = a.split(' ');
  const bt = b.split(' ');
  const surname = at[at.length - 1] ?? '';
  const otherSurname = bt[bt.length - 1] ?? '';
  const sameSurname = surname !== '' && surname === otherSurname;

  if (sameSurname && at.length === bt.length && at.length > 1) {
    const rest = at.slice(0, -1).every((token, i) => {
      const other = bt[i] ?? '';
      return token === other || isInitialOf(token, other);
    });
    if (rest) return 'initials match';
  }
  if (a.length >= 3 && b.length >= 3 && (a.includes(b) || b.includes(a))) {
    return 'one name contains the other';
  }
  if (sameSurname && at.length > 1 && bt.length > 1) return 'same surname';
  return null;
}

const WEIGHT: Record<string, number> = {
  'same name': 100,
  'initials match': 80,
  'one name contains the other': 60,
  'same surname': 40,
};

/**
 * The candidates that look like `survivor`, best first. Compares full names
 * and usernames on both sides, so "Ada Lovelace" finds "@ada" too.
 */
export function suggestDuplicates(
  survivor: PersonDto,
  candidates: PersonDto[],
  limit = 3,
): MergeSuggestion[] {
  const mine = namesOf(survivor);
  const scored: MergeSuggestion[] = [];
  for (const person of candidates) {
    if (person.id === survivor.id) continue;
    let best: { why: string; score: number } | null = null;
    for (const a of mine) {
      for (const b of namesOf(person)) {
        const why = scorePair(a, b);
        if (why === null) continue;
        const score = WEIGHT[why] ?? 0;
        if (best === null || score > best.score) best = { why, score };
      }
    }
    if (best !== null) scored.push({ person, score: best.score, why: best.why });
  }
  return scored
    .sort((x, y) => y.score - x.score || x.person.name.localeCompare(y.person.name))
    .slice(0, limit);
}

export type MergeConsequenceKind = 'sessions-only' | 'claim-moves' | 'work-moves';

export interface MergeConsequence {
  kind: MergeConsequenceKind;
  text: string;
}

/** `@ada (UID: A1B2C)`, or the full name when nobody holds the profile. */
export function personLabel(person: PersonDto): string {
  if (person.username === null) return person.name;
  const holder = person.holderUid == null ? '' : ` (${person.holderUid.toUpperCase()})`;
  return `@${person.username}${holder}`;
}

/**
 * What this particular merge will do, in one sentence. Three cases, and the
 * organiser should be told which one they are in *before* they press the
 * button: the third moves a real person's whole history in the event and puts
 * their device out of it, which is not what "fold a duplicate in" sounds like.
 */
export function mergeConsequence(survivor: PersonDto, loser: PersonDto): MergeConsequence {
  if (!loser.claimed) {
    return {
      kind: 'sessions-only',
      text: 'Their sessions and pitches move here. Nothing else changes.',
    };
  }
  if (!survivor.claimed) {
    return {
      kind: 'claim-moves',
      text: `${personLabel(loser)} becomes the holder of this profile.`,
    };
  }
  return {
    kind: 'work-moves',
    text: `Everything ${personLabel(loser)} did in this event — their stars, notes, and everything they wrote — moves to ${personLabel(survivor)}, and their device is signed out of the event.`,
  };
}
