import { useMemo, useState } from 'react';
import { useDismissed } from '../lib/useDismissed';
import type { BreakDto, RoomDto, SessionDto, TrackDto } from '@shared/types';
import { windowOn } from '@shared/trackHours';
import { fmtMin, place } from '../lib/format';
import { BREAK_BITE_MIN, LONG_BLOCK_MIN, MIN_BREAK_MIN, breakOn, overlap } from '../lib/rhythm';

/** Mímir add-on (SPEC: design/mimir-en-libresesh.md §7): advisory rhythm
 *  checks over the published schedule. Strictly additive — a chip that is off
 *  by default, a panel that only lists, and nothing that ever blocks a save.
 *  "Señalar, no decidir": every finding names what, why, and the rule, and the
 *  organiser is free to ignore all of it.
 *
 *  Every note here is arithmetic on something the organiser declared, never an
 *  impression. That is the whole difference between a note worth reading and a
 *  co-pilot with opinions: "this session runs 13:20–14:40 and lunch is
 *  13:00–14:00" can be checked; "the rhythm feels heavy" cannot, and invites
 *  an argument the software has no standing in.
 *
 *  Until breaks existed, a pause had to be inferred from a gap in the grid —
 *  which cannot tell a lunch from a room nobody booked. Track hours and the
 *  floor-holding flag are the same story: they used to live in someone's head,
 *  so a check could only guess at them. They are written down now. */

interface Warning {
  key: string;
  what: string;
  why: string;
  rule: string;
}

const MINUTE = 60_000;

export function rhythmWarnings(
  sessions: SessionDto[],
  rooms: RoomDto[],
  // Optional so a caller with an older bundle still gets the length checks
  // rather than nothing at all.
  { breaks = [], tracks = [], timezone = 'UTC' }: {
    breaks?: BreakDto[];
    tracks?: TrackDto[];
    timezone?: string;
  } = {},
): Warning[] {
  const roomName = (id: number) => rooms.find((r) => r.id === id)?.name ?? `room ${id}`;
  const trackOf = (id: number | null) => (id === null ? undefined : tracks.find((t) => t.id === id));
  const warnings: Warning[] = [];

  for (const s of sessions) {
    const min = Math.round((Date.parse(s.endsAt) - Date.parse(s.startsAt)) / MINUTE);
    if (min > LONG_BLOCK_MIN) {
      warnings.push({
        key: `long-${s.id}`,
        what: `“${s.title}” runs ${min} min in one piece`,
        why: `Attention holds roughly ${LONG_BLOCK_MIN} minutes; beyond that the room is still seated but no longer there.`,
        rule: 'Hard limit: ~90 min with a real cut.',
      });
    }

    const at = place(s, timezone);

    // Eating a declared meal. The organiser said when lunch is; this is the
    // one check that could never be made by looking at the grid.
    for (const b of breaks) {
      if (!breakOn(b, at.date)) continue;
      const bite = overlap(at.startMin, at.endMin, b.startMin, b.endMin);
      if (bite >= BREAK_BITE_MIN) {
        warnings.push({
          key: `break-${s.id}-${b.id}`,
          what: `“${s.title}” takes ${bite} min out of ${b.label} (${fmtMin(b.startMin)}–${fmtMin(b.endMin)})`,
          why: 'Whoever comes has to skip the meal, and whoever eats misses the session — so the room is half there either way.',
          rule: `${b.label} is declared for this day.`,
        });
      }
    }

    // Outside the hours its own strand declares.
    const track = trackOf(s.trackId);
    const hours = track ? windowOn(track, at.date) : null;
    if (track && hours && (at.startMin < hours.startMin || at.endMin > hours.endMin)) {
      warnings.push({
        key: `hours-${s.id}`,
        what: `“${s.title}” runs ${fmtMin(at.startMin)}–${fmtMin(at.endMin)}, outside ${track.name} (${fmtMin(hours.startMin)}–${fmtMin(hours.endMin)})`,
        why: 'The strand has a shape for a reason — the hours are where its kind of work belongs in the day.',
        rule: `${track.name} accepts sessions ${fmtMin(hours.startMin)}–${fmtMin(hours.endMin)} on this day.`,
      });
    }

    // A session that holds the floor closes open booking for everybody, for
    // its whole length. Worth saying out loud when it is long.
    if (s.blocksOpenBooking && min > LONG_BLOCK_MIN) {
      warnings.push({
        key: `floor-${s.id}`,
        what: `“${s.title}” holds the floor for ${min} min`,
        why: 'While it runs nobody can place an open session anywhere in the event, so that is the whole unconference closed, not one room.',
        rule: 'A held floor is the event choosing for everyone.',
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
        if (chain.length > 1 && total > LONG_BLOCK_MIN) {
          warnings.push({
            key: `chain-${roomId}-${chain[0].id}`,
            what: `${chain.length} back-to-back sessions in ${roomName(roomId)} make a ${total} min block`,
            why: `Each piece fits, but the room never gets a pause between them.`,
            rule: `A pause every ~${LONG_BLOCK_MIN} min keeps the field workable.`,
          });
        }
        chainStart = i;
      }
    }
  }

  // Load: the same person giving one session straight after another. A session
  // has several speakers now, so this is answerable — it was not before.
  //
  // Named as a fact about the schedule, never about the person: "these two
  // sessions are back to back" is structure, and "they are taking on too much"
  // is a judgement Mímir has no standing to make.
  const byPerson = new Map<number, { name: string; sessions: SessionDto[] }>();
  for (const s of sessions) {
    for (const sp of s.speakers) {
      const entry = byPerson.get(sp.id) ?? { name: sp.name, sessions: [] };
      entry.sessions.push(s);
      byPerson.set(sp.id, entry);
    }
  }
  for (const [personId, { name, sessions: theirs }] of byPerson) {
    const ordered = theirs.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    for (let i = 1; i < ordered.length; i++) {
      const gap = (Date.parse(ordered[i].startsAt) - Date.parse(ordered[i - 1].endsAt)) / MINUTE;
      if (gap < MIN_BREAK_MIN) {
        warnings.push({
          key: `load-${personId}-${ordered[i].id}`,
          what: `${name} gives “${ordered[i - 1].title}” and “${ordered[i].title}” back to back${gap > 0 ? ` (${Math.round(gap)} min between)` : ''}`,
          why: 'Whoever holds a room needs longer than the room does — the second one starts with no time to put the first one down.',
          rule: `At least ${MIN_BREAK_MIN} min between sessions the same person gives.`,
        });
        break; // one note per person is enough to look at the whole day
      }
    }
  }

  return warnings;
}

export function RhythmCheck({
  sessions,
  rooms,
  breaks = [],
  tracks = [],
  timezone = 'UTC',
}: {
  sessions: SessionDto[];
  rooms: RoomDto[];
  breaks?: BreakDto[];
  tracks?: TrackDto[];
  timezone?: string;
}) {
  const [open, setOpen] = useState(false);
  const { isDismissed, dismiss, restore, hidden } = useDismissed('rhythm');
  const all = useMemo(
    () => rhythmWarnings(sessions, rooms, { breaks, tracks, timezone }),
    [sessions, rooms, breaks, tracks, timezone],
  );
  const warnings = all.filter((w) => !isDismissed(w.key));

  // Nothing to say: no chip at all. Vanilla schedules stay untouched.
  if (all.length === 0) return null;
  if (warnings.length === 0) {
    // Everything dismissed: a whisper of a chip so the notes can come back.
    return (
      <button
        type="button"
        onClick={restore}
        className="rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-3 py-2 text-xs text-stone-400 dark:text-stone-500 hover:border-indigo-400"
        title="All rhythm notes ignored — click to bring them back"
      >
        ◆ {all.length} ignored
      </button>
    );
  }

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
                <span className="text-xs text-indigo-700 dark:text-indigo-400">{w.rule}</span>{' '}
                <button
                  type="button"
                  onClick={() => dismiss(w.key)}
                  className="ml-1 rounded border border-stone-300 dark:border-stone-600 px-1.5 py-0.5 text-[11px] text-stone-500 dark:text-stone-400 hover:border-indigo-400"
                >
                  Ignore
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
            Advisory only — nothing here blocks anything. Rearrange, or ignore
            {hidden > 0 && (
              <>
                {' · '}
                <button type="button" onClick={restore} className="underline">
                  bring back {hidden} ignored
                </button>
              </>
            )}
            .
          </p>
        </div>
      )}
    </>
  );
}
