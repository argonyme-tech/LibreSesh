import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Note } from '../lib/mimirNotes';

/**
 * Mímir speaking somewhere that is not her own page.
 *
 * One primitive for every surface, because appearing in five places with five
 * looks is not a co-facilitator, it is five features. Indigo is her, here as
 * everywhere else; the ◆ is the same mark that opens her tab.
 *
 * The constraints are what make it welcome beside somebody else's work rather
 * than an interruption of it:
 *
 * - Nothing to say means nothing rendered. Not an empty panel, not a quiet
 *   badge — no element at all, so a healthy programme never grows chrome it
 *   did not ask for.
 * - Never a colour that means danger. These are notes, not errors: nothing
 *   here blocks a save, and the palette should not imply otherwise.
 * - Dismissible per note, remembered per device, and reversible. An organiser
 *   who has decided a note is wrong should not be told again for the whole
 *   event, and should be able to bring it back when they change their mind.
 * - Every note says what was counted, so a reader can check it against the
 *   grid instead of trusting her.
 *
 * `localStorage` is a per-viewer convenience and can be blocked outright, so
 * every read and write is wrapped and the component renders correctly with no
 * stored value at all.
 */
const KEY = 'mimir-asides-dismissed';

const load = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

const save = (keys: string[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys));
  } catch {
    /* storage blocked — dismissal just will not persist */
  }
};

export function MimirAside({
  notes,
  scope,
  slug,
  compact = false,
}: {
  notes: Note[];
  /** Namespaces the dismissals, so hiding a note on one session does not hide
   *  the same kind of note on every other one. */
  scope: string;
  /** Present when there is somewhere fuller to go. */
  slug?: string;
  /** Inline in a list row: one line each, no heading. */
  compact?: boolean;
}) {
  const [dismissed, setDismissed] = useState<string[]>(load);
  const idOf = (n: Note) => `${scope}:${n.key}`;
  const live = notes.filter((n) => !dismissed.includes(idOf(n)));

  const drop = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    save(next);
  };
  const restore = () => {
    const next = dismissed.filter((d) => !d.startsWith(`${scope}:`));
    setDismissed(next);
    save(next);
  };

  // Nothing to say: nothing at all.
  if (notes.length === 0) return null;

  if (live.length === 0) {
    return (
      <button
        type="button"
        onClick={restore}
        className="text-xs text-stone-400 hover:text-indigo-500 dark:text-stone-500 dark:hover:text-indigo-400"
      >
        ◆ {notes.length} note{notes.length === 1 ? '' : 's'} hidden
      </button>
    );
  }

  if (compact) {
    return (
      <ul className="mt-1 space-y-0.5">
        {live.map((n) => (
          <li key={n.key} className="text-xs text-indigo-700 dark:text-indigo-400">
            <span aria-hidden="true">◆</span>{' '}
            <span className="font-medium">{n.what}</span>
            <span className="text-stone-500 dark:text-stone-400"> — {n.because}</span>
            <button
              type="button"
              onClick={() => drop(idOf(n))}
              aria-label={`Hide: ${n.what}`}
              className="ml-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <aside
      aria-label="Mímir"
      className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-sm dark:border-indigo-900 dark:bg-indigo-950/20"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          <span aria-hidden="true">◆</span> Mímir
        </span>
        <span className="text-[11px] text-stone-500 dark:text-stone-400">
          advisory — nothing here blocks anything
        </span>
        {slug && (
          <Link
            to={`/e/${slug}/mimir`}
            className="ml-auto text-[11px] text-indigo-700 underline dark:text-indigo-400"
          >
            open Mímir
          </Link>
        )}
      </div>
      <ul className="space-y-1.5">
        {live.map((n) => (
          <li key={n.key} className="text-stone-700 dark:text-stone-300">
            <b className="text-stone-800 dark:text-stone-100">{n.what}.</b> {n.because}
            {n.hint && (
              <span className="text-stone-500 dark:text-stone-400"> {n.hint}</span>
            )}{' '}
            <button
              type="button"
              onClick={() => drop(idOf(n))}
              className="rounded border border-stone-300 px-1.5 py-0.5 text-[11px] text-stone-500 hover:border-indigo-400 dark:border-stone-600 dark:text-stone-400"
            >
              Hide
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
