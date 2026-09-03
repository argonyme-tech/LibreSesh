import type { Db } from './db.js';
import { newPublicId } from './identity.js';

/**
 * Adopt a database migrated by the pre-squash numbering onto the current one.
 *
 * Upstream squashed migrations 001–017 into `001_baseline.sql` on 2026-08-31,
 * noting that no instance held data worth keeping. This fork was already
 * deployed, so its `migrations` table names seventeen files this build no
 * longer ships, and the downgrade guard in `migrate()` refuses to start rather
 * than guess. It is right to refuse — it cannot tell an older sibling from a
 * newer stranger. This is how it tells: the pre-squash series is a known,
 * finite set, and a database whose bookkeeping is exactly that set is a
 * sibling.
 *
 * It lives in the server rather than in a hand-run script because the failure
 * it prevents is a crash-loop on deploy, and a fix nobody is present to run is
 * not a fix. `migrate()` calls it before the guard, once, and only when the
 * applied set matches exactly.
 *
 * Renaming the bookkeeping rows is the smaller half. Replaying the old series
 * does not land on the baseline schema — three things were folded into the
 * squash without a numbered migration, and each has to be re-established here
 * or the bridged instance diverges from every fresh one for the rest of its
 * life:
 *
 * - `identities.public_id` did not exist. The table is rebuilt to the baseline
 *   DDL — column order included, so `sqlite_master` matches — and every row is
 *   minted a UID with the app's own generator.
 * - `idx_people_identity` lacked `AND deleted_at IS NULL`. Without the clause a
 *   tombstone holds its owner's slot: soft-delete a claimed profile and that
 *   attendee's next profile edit fails with a constraint error they cannot
 *   get past. That is the bug upstream fixed in the squash.
 * - `idx_identities_ics_token`, which the table rebuild above would otherwise
 *   drop along with the table.
 * - Whatever else the tests find. `tests/adoptSquash.test.ts` replays the old
 *   series through this and asserts the resulting schema is byte-for-byte the
 *   baseline's, so a fourth difference cannot be introduced quietly.
 *
 * One transaction, foreign keys off for the table rebuild (SQLite's documented
 * recipe), `foreign_key_check` clean before commit or nothing is kept.
 */

/** The pre-squash series, all of which `001_baseline.sql` now stands for. */
export const PRE_SQUASH = [
  '001_init.sql',
  '002_user_role_label.sql',
  '003_people.sql',
  '004_stars_and_ics.sql',
  '005_proposals.sql',
  '006_session_livestream.sql',
  '007_permissions.sql',
  '008_room_colors.sql',
  '009_event_display_names.sql',
  '010_week_rail_threshold.sql',
  '011_tracks.sql',
  '012_open_booking.sql',
  '013_link_codes.sql',
  '014_speaker_role.sql',
  '015_speaker_codes.sql',
  '016_audit_retention.sql',
] as const;

/** Ours. It kept its number in the end: upstream's own 010–016 landed two
 *  days after the squash, so 017 is the next free one again. The map stays
 *  because the bookkeeping row still has to be recognised as ours. */
export const RENAMED: ReadonlyMap<string, string> = new Map([
  ['017_proposal_phase.sql', '017_proposal_phase.sql'],
]);

/**
 * Is this bookkeeping exactly the pre-squash series? Every old file present,
 * nothing present that the series (or its one renamed successor) does not
 * account for. A stray name means a database this code was not written for,
 * and the guard's refusal is the right answer for it.
 */
export function isPreSquash(applied: ReadonlySet<string>): boolean {
  for (const name of PRE_SQUASH) if (!applied.has(name)) return false;
  for (const name of applied) {
    if (!(PRE_SQUASH as readonly string[]).includes(name) && !RENAMED.has(name)) return false;
  }
  return true;
}

export interface Adoption {
  /** UIDs minted for identities that had none. */
  minted: number;
  /** Bookkeeping rows after adoption, sorted. */
  recorded: string[];
}

/** The baseline's `identities`, verbatim except for comments. Column order is
 *  part of the contract: `sqlite_master` is compared in the tests. */
const IDENTITIES_BASELINE = `CREATE TABLE identities (
  id INTEGER PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  ics_token TEXT
)`;

export function adoptSquashedSeries(db: Db): Adoption {
  // The rebuild below drops and recreates a table other tables reference, so
  // enforcement has to be off for its duration. The pragma cannot change inside
  // a transaction, hence out here; `foreign_key_check` at the end stands in.
  db.pragma('foreign_keys = OFF');
  try {
    const result = db.transaction((): Adoption => {
      const stamp = new Date().toISOString();

      // 1. identities → baseline shape, every row given a UID.
      const identityCols = new Set(
        (db.prepare('PRAGMA table_info(identities)').all() as { name: string }[]).map((c) => c.name),
      );
      let minted = 0;
      if (!identityCols.has('public_id')) {
        db.exec('ALTER TABLE identities ADD COLUMN public_id TEXT');
        const rows = db.prepare<[], { id: number }>('SELECT id FROM identities').all();
        const set = db.prepare('UPDATE identities SET public_id = ? WHERE id = ?');
        for (const row of rows) {
          set.run(newPublicId(db), row.id);
          minted += 1;
        }
      }
      db.exec(IDENTITIES_BASELINE.replace('CREATE TABLE identities', 'CREATE TABLE identities_new'));
      db.exec(
        `INSERT INTO identities_new (id, public_id, token, display_name, created_at, last_seen_at, ics_token)
         SELECT id, public_id, token, display_name, created_at, last_seen_at, ics_token FROM identities`,
      );
      db.exec('DROP TABLE identities');
      db.exec('ALTER TABLE identities_new RENAME TO identities');
      // Dropping the table took its indexes with it. This one is the
      // baseline's, verbatim; the schema test is what noticed it was missing.
      db.exec(
        'CREATE UNIQUE INDEX idx_identities_ics_token ON identities(ics_token) WHERE ics_token IS NOT NULL',
      );

      // 2. The partial index the squash narrowed.
      db.exec('DROP INDEX IF EXISTS idx_people_identity');
      db.exec(
        `CREATE UNIQUE INDEX idx_people_identity ON people(event_id, identity_id)
           WHERE identity_id IS NOT NULL AND deleted_at IS NULL`,
      );

      // 3. Bookkeeping: the series becomes the baseline; ours takes its new number.
      const del = db.prepare('DELETE FROM migrations WHERE name = ?');
      for (const name of PRE_SQUASH) del.run(name);
      db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(
        '001_baseline.sql',
        stamp,
      );
      const rename = db.prepare('UPDATE migrations SET name = ? WHERE name = ?');
      for (const [from, to] of RENAMED) rename.run(to, from);

      const bad = db.prepare('PRAGMA foreign_key_check').all();
      if (bad.length > 0) {
        throw new Error(`Adoption left ${bad.length} dangling foreign key(s); rolled back.`);
      }

      const recorded = db
        .prepare<[], { name: string }>('SELECT name FROM migrations ORDER BY name')
        .all()
        .map((r) => r.name);
      return { minted, recorded };
    })();
    return result;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}
