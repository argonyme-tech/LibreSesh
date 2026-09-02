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
