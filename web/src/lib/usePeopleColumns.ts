import { useCallback, useState } from 'react';
import {
  defaultPeopleColumns,
  parsePeopleColumns,
  togglePeopleColumn,
  type PeopleSortColumn,
} from './people';

const STORAGE_KEY = 'libresesh.people-columns';
/** Tailwind's `sm`, which is where the table used to reveal its two extra
 *  columns of its own accord. */
const WIDE = '(min-width: 640px)';

// Read once, at mount. A phone that is rotated mid-session keeps the columns
// it had rather than rearranging the table under the finger reading it; the
// menu is right there for anyone who wants the other set.
function isWide(): boolean {
  try {
    return window.matchMedia(WIDE).matches;
  } catch {
    return true;
  }
}

// Private windows and blocked site data throw on storage access, so every read
// and write is guarded — the table must still render when persistence is gone.
function readStored(fallback: PeopleSortColumn[]): PeopleSortColumn[] {
  try {
    return parsePeopleColumns(localStorage.getItem(STORAGE_KEY), fallback);
  } catch {
    return fallback;
  }
}

function writeStored(columns: PeopleSortColumn[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // Nothing to persist; the choice lasts only for this session.
  }
}

export interface PeopleColumnsControl {
  shown: PeopleSortColumn[];
  showing: (column: PeopleSortColumn) => boolean;
  toggle: (column: PeopleSortColumn) => void;
  /** Back to what this screen would have shown on a first visit. */
  reset: () => void;
  /** Whether it already is, for the control that offers it. */
  isDefault: boolean;
  /** How many of the optional columns are on, for the button's badge. */
  extras: number;
}

/**
 * Which People columns are on, remembered across visits.
 *
 * Per browser rather than per event on purpose: this is a preference about
 * how somebody reads a table, not a fact about the event, and an organiser
 * who wants UIDs wants them in every event they run.
 */
export function usePeopleColumns(): PeopleColumnsControl {
  // The default is the screen's; the stored choice, once made, is the
  // organiser's and outranks it at every width.
  const [fallback] = useState<PeopleSortColumn[]>(() => defaultPeopleColumns(isWide()));
  const [shown, setShown] = useState<PeopleSortColumn[]>(() => readStored(fallback));

  const commit = useCallback((next: PeopleSortColumn[]) => {
    writeStored(next);
    setShown(next);
  }, []);

  return {
    shown,
    showing: (column) => shown.includes(column),
    toggle: (column) => commit(togglePeopleColumn(shown, column)),
    reset: () => commit(fallback),
    isDefault: shown.join() === fallback.join(),
    extras: shown.filter((c) => c !== 'name').length,
  };
}
