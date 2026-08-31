import { useMemo, useState } from 'react';
import type { RoomDto, SessionDto } from '@shared/types';

/** Mímir add-on (SPEC: design/mimir-en-libresesh.md §7): advisory rhythm
 *  checks over the published schedule. Strictly additive — a chip that is off
 *  by default, a panel that only lists, and nothing that ever blocks a save.
 *  "Señalar, no decidir": every finding names what, why, and the rule, and the
 *  organiser is free to ignore all of it. */

interface Warning {
  key: string;
  what: string;
  why: string;
  rule: string;
}

const MINUTE = 60_000;
/** Attention span hard limit (B4): a block beyond this wants a real break. */
const MAX_BLOCK_MIN = 90;
/** Gap below this doesn't count as a break between back-to-back sessions. */
const MIN_BREAK_MIN = 10;

export function rhythmWarnings(sessions: SessionDto[], rooms: RoomDto[]): Warning[] {
  const roomName = (id: number) => rooms.find((r) => r.id === id)?.name ?? `room ${id}`;
  const warnings: Warning[] = [];

  for (const s of sessions) {
    const min = Math.round((Date.parse(s.endsAt) - Date.parse(s.startsAt)) / MINUTE);
    if (min > MAX_BLOCK_MIN) {
      warnings.push({
        key: `long-${s.id}`,
        what: `“${s.title}” runs ${min} min in one piece`,
        why: `Attention holds roughly ${MAX_BLOCK_MIN} minutes; beyond that the room is still seated but no longer there.`,
        rule: 'Hard limit: ~90 min with a real cut.',
      });
    }
  }

  // Back-to-back chains per room: sessions that individually fit but add up
  // to a block with no real pause between them.
  const byRoom = new Map<number, SessionDto[]>();
  for (const s of sessions) {
    const list = byRoom.get(s.roomId) ?? [];
    list.push(s);
    byRoom.set(s.roomId, list);
  }
  for (const [roomId, list] of byRoom) {
    const ordered = list.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    let chainStart = 0;
    for (let i = 1; i <= ordered.length; i++) {
      const gap =
        i < ordered.length
          ? (Date.parse(ordered[i].startsAt) - Date.parse(ordered[i - 1].endsAt)) / MINUTE
          : Infinity;
      if (gap >= MIN_BREAK_MIN) {
        const chain = ordered.slice(chainStart, i);
        const total = Math.round(
          (Date.parse(chain[chain.length - 1].endsAt) - Date.parse(chain[0].startsAt)) / MINUTE,
        );
        // A chain of one is already covered by the per-session check above.
        if (chain.length > 1 && total > MAX_BLOCK_MIN) {
          warnings.push({
            key: `chain-${roomId}-${chain[0].id}`,
            what: `${chain.length} back-to-back sessions in ${roomName(roomId)} make a ${total} min block`,
            why: `Each piece fits, but the room never gets a pause between them.`,
            rule: `A pause every ~${MAX_BLOCK_MIN} min keeps the field workable.`,
          });
        }
        chainStart = i;
      }
    }
  }

  return warnings;
}

export function RhythmCheck({ sessions, rooms }: { sessions: SessionDto[]; rooms: RoomDto[] }) {
  const [open, setOpen] = useState(false);
  const warnings = useMemo(() => rhythmWarnings(sessions, rooms), [sessions, rooms]);

  // Nothing to say: no chip at all. Vanilla schedules stay untouched.
  if (warnings.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`rounded-lg border px-3 py-2 text-xs font-medium ${
          open
            ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
            : 'border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 hover:border-indigo-400 dark:hover:border-indigo-600'
        }`}
      >
        ◆ Rhythm
        <span className="ml-1 text-stone-400 dark:text-stone-500">{warnings.length}</span>
      </button>
      {open && (
        <div
          role="region"
          aria-label="Rhythm notes"
          className="w-full rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/20 p-3 text-sm"
        >
          <ul className="space-y-2">
            {warnings.map((w) => (
              <li key={w.key} className="text-stone-700 dark:text-stone-300">
                <span className="font-medium">{w.what}.</span> {w.why}{' '}
                <span className="text-xs text-indigo-700 dark:text-indigo-400">{w.rule}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            Advisory only — nothing here blocks anything. Rearrange, or ignore.
          </p>
        </div>
      )}
    </>
  );
}
