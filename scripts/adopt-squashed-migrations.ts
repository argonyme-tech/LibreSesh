/**
 * Bridge a database migrated by the pre-squash numbering onto the current one.
 *
 *   npx tsx scripts/adopt-squashed-migrations.ts <path-to.db> [--dry]
 *
 * Upstream squashed migrations 001–017 into `001_baseline.sql` on 2026-08-31,
 * noting that no instance held data worth keeping. Ours did: this fork was
 * already deployed, so its `migrations` table names seventeen files this build
 * no longer ships, and the downgrade guard in db.ts refuses to start rather
 * than guess. It is right to refuse — it cannot tell an older sibling from a
 * newer stranger. This script is us telling it which one it has.
 *
 * Renaming the rows is most of it: replaying the old 001-017 lands within one
 * column of what `001_baseline.sql` creates, and our `017_proposal_phase.sql`
 * is the same file as the `010_proposal_phase.sql` it was renumbered to. The
 * eight upstream migrations that landed after the squash (002-009: blocking
 * sessions, breaks, track hours, slugs, default view, multi-speaker) are then
 * applied by the ordinary runner on the next start, with its own backup first.
 *
 * The one column is `identities.public_id`, and it is the reason this script
 * exists rather than a note in a README. Upstream introduced it *inside* the
 * squash - no numbered migration ever adds it - which was theirs to do on the
 * stated assumption that no instance held data. Ours does, so this adds the
 * column and mints a UID for every identity already in the table, using the
 * app's own generator rather than a second implementation of it.
 *
 * Nothing else is touched: no event, session, pitch or contribution is read,
 * moved or rewritten. The script identifies the database before it writes -
 * every old migration present, every baseline table present, nothing applied
 * that it cannot account for - and does all of its work in one transaction, so
 * a database that fails a check is left exactly as it was found. Run it with
 * --dry first; the server takes its own backup on the start that follows.
 */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { newPublicId } from '../server/src/identity.js';

/** The pre-squash series, all of which `001_baseline.sql` now stands for. */
const SQUASHED = [
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
];

/** Ours, renumbered when their series restarted at 001. Same file, same SQL. */
const RENAMED = new Map([['017_proposal_phase.sql', '010_proposal_phase.sql']]);

/** Tables the squashed baseline is responsible for. If one is missing, this is
 *  not the database we think it is, and no amount of renaming would help. */
const EXPECTED_TABLES = [
  'events',
  'identities',
  'people',
  'rooms',
  'sessions',
  'tracks',
  'proposals',
  'contributions',
  'tags',
  'stars',
  'roles',
  'audit',
  'link_codes',
];

const [path, ...flags] = process.argv.slice(2);
const dry = flags.includes('--dry');

if (!path) {
  console.error('Usage: npx tsx scripts/adopt-squashed-migrations.ts <path-to.db> [--dry]');
  process.exit(2);
}
if (!existsSync(path)) {
  console.error(`No such database: ${path}`);
  process.exit(2);
}

const db = new Database(path);
const applied = db
  .prepare<[], { name: string }>('SELECT name FROM migrations ORDER BY name')
  .all()
  .map((r) => r.name);

if (applied.includes('001_baseline.sql')) {
  console.log('Already on the squashed series. Nothing to do.');
  process.exit(0);
}

// Refuse on anything unexpected rather than rewriting a database we have not
// identified. A missing old migration means this instance is not the one this
// script was written for.
const missing = SQUASHED.filter((m) => !applied.includes(m));
if (missing.length > 0) {
  console.error(`Not the pre-squash series this bridges — missing: ${missing.join(', ')}`);
  process.exit(1);
}

const tables = new Set(
  db
    .prepare<[], { name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map((r) => r.name),
);
const absent = EXPECTED_TABLES.filter((t) => !tables.has(t));
if (absent.length > 0) {
  console.error(`Schema does not look like the baseline — no ${absent.join(', ')}.`);
  process.exit(1);
}

const stray = applied.filter((m) => !SQUASHED.includes(m) && !RENAMED.has(m));
if (stray.length > 0) {
  console.error(
    `Unrecognised migrations already applied: ${stray.join(', ')}.\n` +
      'Map them by hand before running this — silently dropping their names would ' +
      'make the runner replay work that is already done.',
  );
  process.exit(1);
}

const stamp = new Date().toISOString();
const plan = [
  `${SQUASHED.length} rows → 001_baseline.sql`,
  ...[...RENAMED].filter(([from]) => applied.includes(from)).map(([from, to]) => `${from} → ${to}`),
];
console.log(`${path}\n  ${plan.join('\n  ')}`);

if (dry) {
  console.log('\n--dry: nothing written.');
  process.exit(0);
}

// One transaction: schema, data and bookkeeping move together or not at all.
db.transaction(() => {
  // The column the squash folded in. NOT NULL cannot be added to a populated
  // table in one step, so it arrives nullable, is filled, and the uniqueness
  // that matters is enforced by the index - the same shape the baseline has.
  const identityCols = new Set(
    (db.prepare('PRAGMA table_info(identities)').all() as { name: string }[]).map((c) => c.name),
  );
  if (!identityCols.has('public_id')) {
    db.exec('ALTER TABLE identities ADD COLUMN public_id TEXT');
    const rows = db.prepare<[], { id: number }>('SELECT id FROM identities').all();
    const set = db.prepare('UPDATE identities SET public_id = ? WHERE id = ?');
    for (const row of rows) set.run(newPublicId(db as never), row.id);
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS identities_public_id ON identities (public_id)');
    console.log(`  identities.public_id added, ${rows.length} UID(s) minted`);
  }

  const del = db.prepare('DELETE FROM migrations WHERE name = ?');
  for (const name of SQUASHED) del.run(name);
  db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(
    '001_baseline.sql',
    stamp,
  );
  for (const [from, to] of RENAMED) {
    if (applied.includes(from)) {
      db.prepare('UPDATE migrations SET name = ? WHERE name = ?').run(to, from);
    }
  }
})();

const now = db
  .prepare<[], { name: string }>('SELECT name FROM migrations ORDER BY name')
  .all()
  .map((r) => r.name);
console.log(`\nDone. Recorded: ${now.join(', ')}`);
console.log('The next start applies 002–009 and takes its own backup first.');
db.close();
