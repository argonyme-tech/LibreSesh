/**
 * Preview, or force, adoption of a pre-squash database onto the current series.
 *
 *   npx tsx scripts/adopt-squashed-migrations.ts <path-to.db> [--dry]
 *
 * The server does this on its own at start-up when it recognises the old
 * series (server/src/adoptSquash.ts, called from migrate()), so in the normal
 * course of things nobody runs this. It exists for the two moments that are
 * not normal: looking before a deploy (`--dry` says whether the database will
 * be adopted and what would be minted), and adopting a copy by hand to inspect
 * the result before trusting the live one to it.
 *
 * What it will not do is touch a database it does not recognise. A stray
 * migration name means an instance this code was not written for, and the
 * guard's refusal is the right answer there.
 */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { adoptSquashedSeries, isPreSquash, PRE_SQUASH } from '../server/src/adoptSquash.js';

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
const applied = new Set(
  (db.prepare('SELECT name FROM migrations').all() as { name: string }[]).map((r) => r.name),
);

if (applied.has('001_baseline.sql')) {
  console.log('Already on the squashed series. Nothing to do.');
  process.exit(0);
}
if (!isPreSquash(applied)) {
  const stray = [...applied].filter((n) => !(PRE_SQUASH as readonly string[]).includes(n));
  console.error(
    `Not the pre-squash series this bridges.\n` +
      `  missing: ${PRE_SQUASH.filter((n) => !applied.has(n)).join(', ') || '(none)'}\n` +
      `  unrecognised: ${stray.join(', ') || '(none)'}`,
  );
  process.exit(1);
}

const identities = (db.prepare('SELECT COUNT(*) AS n FROM identities').get() as { n: number }).n;
console.log(
  `${path}\n  ${applied.size} pre-squash rows → 001_baseline.sql (+ 010_proposal_phase.sql if present)\n` +
    `  identities rebuilt to baseline, ${identities} UID(s) to mint\n  idx_people_identity narrowed to live rows`,
);

if (dry) {
  console.log('\n--dry: nothing written.');
  process.exit(0);
}

const { minted, recorded } = adoptSquashedSeries(db);
console.log(`\nDone. Minted ${minted}. Recorded: ${recorded.join(', ')}`);
console.log('The next start applies 002–009 and takes its own backup first.');
db.close();
