import type { AuditEntryDto } from '@shared/types';

/**
 * Mímir add-on: what moved while you were not looking.
 *
 * A live schedule is the whole point of this app — and the cost of it is that
 * the programme changes under everyone and nobody is told. An organiser who
 * steps away for two hours comes back to a grid that looks the same and is
 * not, and there has never been a way to ask "what did I miss".
 *
 * The answer was already being written down. Every mutation goes into the
 * audit log with an action, an entity and a label, and it is read today only
 * when somebody is trying to work out who did something. Read forwards instead
 * of backwards it is a changelog, and needs no new table, no new endpoint and
 * no polling.
 *
 * Two rules shape what comes out:
 *
 * - **The mark is per device**, kept locally. "Since you last looked" is a fact
 *   about a person at a screen, not about the event, and putting it on the
 *   server would make one organiser's catch-up erase another's.
 * - **Say the thing, not the row.** "update session — Opening keynote" is a
 *   log line; "Opening keynote was edited" is an answer. Actions with no
 *   consequence for the programme (a password checked, an export taken) are
 *   dropped entirely rather than padded into the list.
 */
export interface Change {
  id: number;
  at: string;
  who: string;
  /** One sentence, in the reader's terms. */
  said: string;
}

export interface Digest {
  changes: Change[];
  /** Newest id seen, to store as the new mark. Null when nothing qualified. */
  mark: number | null;
  /** Entries that were skipped as not about the programme. Counted, not shown,
   *  so the reader can tell "quiet" from "filtered". */
  ignored: number;
}

/** Actions that change what somebody would see on the grid or the board. The
 *  rest — auth attempts, exports, backups, QR mints — are housekeeping. */
const MEANINGFUL: Record<string, (entity: string, label: string) => string | null> = {
  create: (entity, label) => `${noun(entity, label)} was added`,
  update: (entity, label) => `${noun(entity, label)} was edited`,
  delete: (entity, label) => `${noun(entity, label)} was deleted`,
  restore: (entity, label) => `${noun(entity, label)} was restored from the trash`,
  place: (_e, label) => `${quoted(label) ?? 'A pitch'} was placed on the grid`,
  reorder: (entity) => `The ${entity}s were reordered`,
  merge: (_e, label) => `${quoted(label) ?? 'A profile'} was merged with another`,
  clone: (entity, label) => `${noun(entity, label)} was copied`,
  speaker_code_mint: (_e, label) => `A speaker code was issued${label ? ` for ${label}` : ''}`,
  speaker_code_revoke: (_e, label) => `A speaker code was revoked${label ? ` for ${label}` : ''}`,
};

/** Entities whose label reads better in quotes than as a name. */
const TITLED = new Set(['session', 'proposal', 'contribution']);

const quoted = (label: string): string | null =>
  label ? (label.length > 60 ? `“${label.slice(0, 57)}…”` : `“${label}”`) : null;

function noun(entity: string, label: string): string {
  if (!label) return `A ${entity}`;
  return TITLED.has(entity) ? (quoted(label) as string) : `${entity[0].toUpperCase()}${entity.slice(1)} ${label}`;
}

/**
 * @param entries newest-first, as the audit endpoint returns them.
 * @param since   id of the newest entry already seen, or null for a first look.
 */
export function digest(entries: AuditEntryDto[], since: number | null): Digest {
  const fresh = since === null ? entries : entries.filter((e) => e.id > since);
  const changes: Change[] = [];
  let ignored = 0;

  for (const e of fresh) {
    const phrase = MEANINGFUL[e.action]?.(e.entity, e.entityLabel);
    if (!phrase) {
      ignored += 1;
      continue;
    }
    changes.push({
      id: e.id,
      at: e.at,
      who: e.actorName || 'Someone',
      said: phrase,
    });
  }

  // The mark moves past everything read, including the housekeeping that was
  // filtered out — otherwise those rows come back forever.
  const mark = fresh.length > 0 ? Math.max(...fresh.map((e) => e.id)) : null;
  return { changes, mark, ignored };
}

const KEY = 'mimir-changes-mark';

/** Per device, per event. Storage can be blocked outright, so both sides are
 *  guarded and a missing mark simply means "first look". */
export function readMark(slug: string): number | null {
  try {
    const raw = localStorage.getItem(`${KEY}:${slug}`);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeMark(slug: string, mark: number): void {
  try {
    localStorage.setItem(`${KEY}:${slug}`, String(mark));
  } catch {
    /* storage blocked — the next visit is another first look */
  }
}
