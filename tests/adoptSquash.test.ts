import Database from 'better-sqlite3';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrate, type Db } from '../server/src/db.js';
import { adoptSquashedSeries, isPreSquash, PRE_SQUASH } from '../server/src/adoptSquash.js';

/**
 * A database migrated by the pre-squash series has to end up indistinguishable
 * from one created fresh — not "close enough", indistinguishable — because it
 * will then live for years under migrations written against the baseline, and
 * any difference is a bug that fires only on that one instance, on a day
 * nobody is looking.
 *
 * So the check is the whole of `sqlite_master`: every table, every index,
 * every DDL string, compared after the old series has been replayed, adopted,
 * and brought forward. The first draft of the bridge passed a column-by-column
 * comparison and still shipped with the wrong `idx_people_identity` — indexes
 * were not being compared. This is.
 */
const REAL = join(__dirname, '..', 'server', 'migrations');
const OLD = join(__dirname, 'fixtures', 'pre-squash');

/** Comments, whitespace and identifier quoting are not schema. SQLite
 *  rewrites a renamed table's DDL as `CREATE TABLE "name"` and leaves a space
 *  before the comma of every column added by ALTER TABLE; neither changes what
 *  the table is. */
const normalise = (sql: string) =>
  sql
    .replace(/--[^\n]*/g, '')
    .replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\(\s*/g, '(')
    .replace(/\s*\)/g, ')')
    .trim();

const schemaOf = (db: Db) =>
  (
    db
      .prepare(
        "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type, name",
      )
      .all() as { type: string; name: string; tbl_name: string; sql: string }[]
  ).map((r) => `${r.type} ${r.name} on ${r.tbl_name}: ${normalise(r.sql)}`);

const fresh = () => {
  const db = new Database(':memory:');
  migrate(db, REAL);
  return db;
};

/** A pre-squash database, with a little life in it so the rebuild has rows to
 *  carry across and the constraints something to constrain. */
const preSquash = () => {
  const db = new Database(':memory:');
  migrate(db, OLD);
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO events (slug, name, timezone, start_date, end_date, day_start_min, day_end_min, viewer_pw_hash, user_pw_hash, admin_pw_hash, archived, created_at) VALUES ('ev', 'Ev', 'UTC', '2026-09-01', '2026-09-02', 540, 1080, 'x', 'x', 'x', 0, ?)",
  ).run(now);
  db.prepare(
    'INSERT INTO identities (token, display_name, created_at, last_seen_at) VALUES (?, ?, ?, ?)',
  ).run('tok-a', 'Ada', now, now);
  db.prepare(
    'INSERT INTO identities (token, display_name, created_at, last_seen_at) VALUES (?, ?, ?, ?)',
  ).run('tok-b', 'Bob', now, now);
  db.prepare(
    'INSERT INTO people (event_id, name, identity_id, created_at, updated_at) VALUES (1, ?, 1, ?, ?)',
  ).run('Ada', now, now);
  return db;
};

describe('recognising the pre-squash series', () => {
  it('matches exactly the old set, with or without our renamed one', () => {
    expect(isPreSquash(new Set(PRE_SQUASH))).toBe(true);
    expect(isPreSquash(new Set([...PRE_SQUASH, '017_proposal_phase.sql']))).toBe(true);
  });

  it('refuses a fresh database, a partial set, and a stray name', () => {
    expect(isPreSquash(new Set(['001_baseline.sql']))).toBe(false);
    expect(isPreSquash(new Set(PRE_SQUASH.slice(0, 10)))).toBe(false);
    // A name this code cannot account for means a database it was not written
    // for; silently dropping it would make the runner replay finished work.
    expect(isPreSquash(new Set([...PRE_SQUASH, '018_something_else.sql']))).toBe(false);
  });
});

describe('adopting the pre-squash series', () => {
  it('lands on exactly the baseline schema, indexes included', () => {
    const bridged = preSquash();
    // The runner adopts on its own when it sees the old set, then applies
    // everything that landed after the squash.
    migrate(bridged, REAL);

    const a = schemaOf(fresh());
    const b = schemaOf(bridged);
    // Diff-friendly: the first mismatch names the object.
    expect(b).toEqual(a);
  });

  it('records the same bookkeeping as a fresh database', () => {
    const bridged = preSquash();
    migrate(bridged, REAL);
    const names = (db: Db) =>
      (db.prepare('SELECT name FROM migrations ORDER BY name').all() as { name: string }[]).map(
        (r) => r.name,
      );
    expect(names(bridged)).toEqual(names(fresh()));
  });

  it('keeps every row and mints a UID for each identity', () => {
    const bridged = preSquash();
    const { minted } = adoptSquashedSeries(bridged);
    expect(minted).toBe(2);
    const rows = bridged
      .prepare('SELECT id, public_id, display_name FROM identities ORDER BY id')
      .all() as { id: number; public_id: string; display_name: string }[];
    expect(rows.map((r) => r.display_name)).toEqual(['Ada', 'Bob']);
    expect(rows.map((r) => r.id)).toEqual([1, 2]); // ids survive: people.identity_id points at them
    for (const r of rows) expect(r.public_id).toMatch(/^[0-9a-f]{5}$/);
    expect(new Set(rows.map((r) => r.public_id)).size).toBe(2);
  });

  it('lets a soft-deleted claimed profile be replaced — the bug the squash fixed', () => {
    const bridged = preSquash();
    migrate(bridged, REAL);
    const now = new Date().toISOString();
    // Organiser deletes Ada's profile: a tombstone that still carries identity_id.
    bridged.prepare('UPDATE people SET deleted_at = ? WHERE id = 1').run(now);
    // Ada edits her profile: the app inserts a new live row for the same identity.
    expect(() =>
      bridged
        .prepare(
          'INSERT INTO people (event_id, name, identity_id, created_at, updated_at) VALUES (1, ?, 1, ?, ?)',
        )
        .run('Ada again', now, now),
    ).not.toThrow();
  });

  it('is not repeated once adopted', () => {
    const bridged = preSquash();
    migrate(bridged, REAL);
    const before = schemaOf(bridged);
    migrate(bridged, REAL);
    expect(schemaOf(bridged)).toEqual(before);
  });

  it('leaves a database it does not recognise to the guard', () => {
    const odd = preSquash();
    odd
      .prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)')
      .run('018_from_elsewhere.sql', new Date().toISOString());
    expect(() => migrate(odd, REAL)).toThrow(/018_from_elsewhere\.sql/);
  });
});
