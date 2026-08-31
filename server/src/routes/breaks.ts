import { Router } from 'express';
import { requireRole, requireWritable } from '../auth.js';
import { audit } from '../audit.js';
import type { Ctx } from '../context.js';
import type { BreakRow } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { toBreakDto } from '../mappers.js';
import { limit } from '../ratelimit.js';
import { breakPatchSchema, breakSchema, parse } from '../validation.js';

/** Breaks are furniture, not content: a small fixed set an organiser types
 *  once. The cap stops a stuck client painting the grid grey. */
const MAX_BREAKS = 40;

/**
 * Lunch, dinner, the coffee break.
 *
 * The whole shape of this file follows from breaks not being sessions: no
 * room, no track, no author, no soft delete, no attendee-facing write. What is
 * stored is a label and a span of the local clock, plus the day it belongs to
 * — or no day at all, which is the common case and means every day.
 */
export function breakRoutes(ctx: Ctx): Router {
  const router = Router({ mergeParams: true });
  const adminWrite = [requireRole(ctx.db, 'admin'), requireWritable, limit(ctx.limiter, 'write')];

  const load = (eventId: number, id: number): BreakRow => {
    const row = ctx.db
      .prepare<[number, number], BreakRow>('SELECT * FROM breaks WHERE id = ? AND event_id = ?')
      .get(id, eventId);
    if (!row) throw notFound('No such break');
    return row;
  };

  /** A break pinned to a day nobody is at the event is invisible, and silently
   *  so — the grid only ever draws the days between these two dates. */
  const assertDateInEvent = (date: string | null | undefined, start: string, end: string): void => {
    if (!date) return;
    if (date < start || date > end) {
      throw badRequest(`That day is outside the event dates ${start}…${end}`);
    }
  };

  router.post('/breaks', ...adminWrite, (req, res) => {
    const body = parse(breakSchema, req.body);
    assertDateInEvent(body.date, req.event.start_date, req.event.end_date);
    const { n } = ctx.db
      .prepare<[number], { n: number }>('SELECT COUNT(*) AS n FROM breaks WHERE event_id = ?')
      .get(req.event.id) as { n: number };
    if (n >= MAX_BREAKS) throw badRequest(`An event may have at most ${MAX_BREAKS} breaks`);

    const id = Number(
      ctx.db
        .prepare(
          `INSERT INTO breaks (event_id, label, start_min, end_min, date, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          req.event.id,
          body.label,
          body.startMin,
          body.endMin,
          body.date ?? null,
          new Date().toISOString(),
        ).lastInsertRowid,
    );

    const dto = toBreakDto(load(req.event.id, id));
    audit(ctx.db, {
      identityId: req.identity.id,
      eventId: req.event.id,
      action: 'create',
      entity: 'break',
      entityId: id,
    });
    ctx.broker.publish(req.event.slug, 'break.created', dto);
    res.status(201).json(dto);
  });

  router.patch('/breaks/:id', ...adminWrite, (req, res) => {
    const existing = load(req.event.id, Number(req.params.id));
    const body = parse(breakPatchSchema, req.body);
    assertDateInEvent(body.date, req.event.start_date, req.event.end_date);
    ctx.db
      .prepare('UPDATE breaks SET label = ?, start_min = ?, end_min = ?, date = ? WHERE id = ?')
      .run(body.label, body.startMin, body.endMin, body.date ?? null, existing.id);

    const dto = toBreakDto(load(req.event.id, existing.id));
    audit(ctx.db, {
      identityId: req.identity.id,
      eventId: req.event.id,
      action: 'update',
      entity: 'break',
      entityId: existing.id,
    });
    ctx.broker.publish(req.event.slug, 'break.updated', dto);
    res.json(dto);
  });

  /** Hard delete. Nothing references a break and it holds no writing of
   *  anyone's, so there is nothing for the trash to offer back. */
  router.delete('/breaks/:id', ...adminWrite, (req, res) => {
    const existing = load(req.event.id, Number(req.params.id));
    ctx.db.prepare('DELETE FROM breaks WHERE id = ?').run(existing.id);
    audit(ctx.db, {
      identityId: req.identity.id,
      eventId: req.event.id,
      action: 'delete',
      entity: 'break',
      entityId: existing.id,
    });
    ctx.broker.publish(req.event.slug, 'break.deleted', { id: existing.id });
    res.status(204).end();
  });

  return router;
}
