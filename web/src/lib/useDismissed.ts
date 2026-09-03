import { useEffect, useState } from 'react';

/**
 * One memory for every note Mímir can be told to stop repeating.
 *
 * Rhythm notes and asides each had their own copy of this — a key, a
 * try/catch around localStorage, a list of ids — and the copies had already
 * diverged in what "bring back" meant. Worse, each instance loaded the list
 * once and wrote back its own stale snapshot, so with one aside per pitch card
 * hiding note B silently un-hid note A. Read-modify-write from storage on
 * every change, and every mounted instance told, fixes that; keeping it in one
 * place keeps it fixed.
 *
 * `localStorage` is a per-viewer convenience that can be blocked outright, so
 * every read and write is guarded and everything renders correctly with no
 * stored value at all. Ids are `scope:key`, so a note hidden on one session is
 * not hidden on every other one.
 */
const KEY = 'mimir-dismissed';
const listeners = new Set<() => void>();

const read = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string') : [];
  } catch {
    return [];
  }
};

const write = (keys: string[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    /* storage blocked — the change lives in this render only */
  }
  for (const notify of listeners) notify();
};

/** Hide one note. Reads the live list first so siblings' hides survive. */
export function dismiss(scope: string, key: string): void {
  const id = `${scope}:${key}`;
  const current = read();
  if (!current.includes(id)) write([...current, id]);
}

/** Bring back every note hidden under a scope. */
export function restore(scope: string): void {
  const prefix = `${scope}:`;
  write(read().filter((k) => !k.startsWith(prefix)));
}

export function useDismissed(scope: string) {
  const [all, setAll] = useState<string[]>(read);
  useEffect(() => {
    const onChange = () => setAll(read());
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, []);
  const prefix = `${scope}:`;
  return {
    isDismissed: (key: string) => all.includes(`${prefix}${key}`),
    dismiss: (key: string) => dismiss(scope, key),
    restore: () => restore(scope),
    /** How many of this scope's notes are hidden. */
    hidden: all.filter((k) => k.startsWith(prefix)).length,
  };
}
