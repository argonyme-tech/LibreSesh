import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import type { Ctx } from '../context.js';
import type { Db } from '../db.js';
import { NameResolver } from '../eventIdentity.js';
import { limit } from '../ratelimit.js';
import type { AuditEntryDto, AuditPageDto } from '../shared/types.js';
import { parse } from '../validation.js';

const PAGE = 50;

const querySchema = z.object({
  /** Keyset, not offset: the log only ever grows at the head, and an offset
   *  would skip or repeat rows as it does. */
  before: z.coerce.number().int().positive().optional(),
});

interface Row {
  id: number;
  identity_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  at: string;
}

/**
 * What each entity is *called*, for the rows on this page only.
 *
 * "deleted session 12" is a row in a table; "deleted session — Opening
 * keynote" is something an organiser can act on. Soft deletes are what make
 * this possible: the title of a deleted session is still there to look up. A
 * hard-deleted or never-existed id simply resolves to nothing and the entry
 * falls back to its id.
 */
const LABEL_SOURCES: Record<string, { table: string; column: string }> = {
  session: { table: 'sessions', column: 'title' },
  room: { table: 'rooms', column: 'name' },
  tag: { table: 'tags', column: 'name' },
  track: { table: 'tracks', column: 'name' },
  person: { table: 'people', column: 'name' },
  proposal: { table: 'proposals', column: 'title' },
  contribution: { table: 'contributions', column: 'body' },
  event: { table: 'events', column: 'name' },
};

function labelsFor(db: Db, rows: Row[]): Map<string, string> {
  const wanted = new Map<string, Set<number>>();
  for (const row of rows) {
    if (row.entity_id === null || !(row.entity in LABEL_SOURCES)) continue;
    const ids = wanted.get(row.entity) ?? new Set<number>();
    ids.add(row.entity_id);
    wanted.set(row.entity, ids);
  }

  const out = new Map<string, string>();
  for (const [entity, ids] of wanted) {
    const source = LABEL_SOURCES[entity];
    if (!source) continue;
    const list = [...ids];
    const found = db
      .prepare<number[], { id: number; label: string }>(
        // Table and column come from the constant map above, never from input.
        `SELECT id, ${source.column} AS label FROM ${source.table}
          WHERE id IN (${list.map(() => '?').join(',')})`,
      )
      .all(...list);
    for (const row of found) {
      out.set(`${entity}:${row.id}`, row.label.slice(0, 80));
    }
  }
  return out;
}

/**
 * The write log, read back (SPEC §8). It has been filled since the first
 * migration and had no reader until now — which meant the recovery story for
 * vandalism was "restore from Trash and guess who did it".
 *
 * Scoped to one event, so an organiser sees their own conference and not the
 * instance. Instance-level rows (a whole-database backup, an event created
 * from the landing page) carry no event id and deliberately do not appear
 * here; they are for whoever holds the instance password, and there is no
 * screen for that yet.
 */
export function auditRoutes(ctx: Ctx): Router {
  const router = Router({ mergeParams: true });

  router.get('/audit', requireRole(ctx.db, 'admin'), limit(ctx.limiter, 'read'), (req, res) => {
    const { before } = parse(querySchema, req.query);

    // One more than the page, to learn whether there is another page without
    // a second COUNT query.
    const rows = ctx.db
      .prepare<[number, number, number], Row>(
        `SELECT id, identity_id, action, entity, entity_id, at
           FROM audit
          WHERE event_id = ? AND (? = 0 OR id < ?)
          ORDER BY id DESC
          LIMIT ${PAGE + 1}`,
      )
      .all(req.event.id, before ?? 0, before ?? 0);

    const page = rows.slice(0, PAGE);
    const names = new NameResolver(ctx.db, req.event.id);
    const labels = labelsFor(ctx.db, page);

    // The UID (public_id) for each actor on this page. Identity row ids never
    // leave the server; the random hex code is the number admins see.
    const actorIds = [...new Set(page.flatMap((r) => (r.identity_id === null ? [] : [r.identity_id])))];
    const uids = new Map(
      actorIds.length === 0
        ? []
        : ctx.db
            .prepare<number[], { id: number; public_id: string }>(
              `SELECT id, public_id FROM identities WHERE id IN (${actorIds.map(() => '?').join(',')})`,
            )
            .all(...actorIds)
            .map((r) => [r.id, r.public_id] as const),
    );

    const entries: AuditEntryDto[] = page.map((row) => ({
      id: row.id,
      at: row.at,
      // A row can outlive its actor's identity only if that identity was
      // removed, which nothing does today — but the log is append-only and
      // must render whatever it holds.
      actorName: row.identity_id === null ? '' : names.get(row.identity_id),
      actorUid: row.identity_id === null ? null : (uids.get(row.identity_id) ?? null),
      action: row.action,
      entity: row.entity,
      entityId: row.entity_id,
      entityLabel:
        row.entity_id === null ? '' : (labels.get(`${row.entity}:${row.entity_id}`) ?? ''),
    }));

    const payload: AuditPageDto = {
      entries,
      nextCursor: rows.length > PAGE ? (page[page.length - 1]?.id ?? null) : null,
    };
    res.json(payload);
  });

  return router;
}
