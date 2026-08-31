import { Router } from 'express';
import { requireRole } from '../auth.js';
import type { Ctx } from '../context.js';
import { limit } from '../ratelimit.js';
import type { AttendeeDto, Role } from '../shared/types.js';

interface Row {
  identity_id: number;
  uid: string;
  name: string;
  role: Role | null;
  joined_at: string;
  last_seen_at: string;
  person_id: number | null;
}

/**
 * Everyone who has ever passed this event's gate, for organisers (the other
 * half of the People roster, which lists only speaker/host *profiles*). There
 * is no anonymous read — everything about an event sits behind
 * `requireRole('viewer')`, and both gate paths write a display name and a
 * role before letting anyone in — so holding either row is exactly the same
 * thing as having ever seen the event. The only identities missing are the
 * ones that never got in: bounced off the gate, or failed the password.
 *
 * The set only grows: logout clears the role but the name row stays, so this
 * is also the table that answers "whose UID is that?" for any actor in the
 * audit log.
 */
export function attendeeRoutes(ctx: Ctx): Router {
  const router = Router({ mergeParams: true });

  router.get('/attendees', requireRole(ctx.db, 'admin'), limit(ctx.limiter, 'read'), (req, res) => {
    const eventId = req.event.id;
    const rows = ctx.db
      .prepare<[number, number, number], Row>(
        // MIN(x, y) is NULL if either side is; the COALESCE pair makes each
        // side fall back to the other, so one-sided rows still get a date.
        `SELECT i.id AS identity_id,
                i.public_id AS uid,
                COALESCE(ei.display_name, i.display_name) AS name,
                r.role AS role,
                MIN(COALESCE(ei.claimed_at, r.granted_at),
                    COALESCE(r.granted_at, ei.claimed_at)) AS joined_at,
                i.last_seen_at AS last_seen_at,
                p.id AS person_id
           FROM identities i
      LEFT JOIN event_identities ei ON ei.event_id = ? AND ei.identity_id = i.id
      LEFT JOIN roles r ON r.event_id = ? AND r.identity_id = i.id
      LEFT JOIN people p ON p.event_id = ? AND p.identity_id = i.id AND p.deleted_at IS NULL
          WHERE ei.identity_id IS NOT NULL OR r.identity_id IS NOT NULL
          ORDER BY name COLLATE NOCASE, i.id`,
      )
      .all(eventId, eventId, eventId);

    const attendees: AttendeeDto[] = rows.map((row) => ({
      uid: row.uid,
      name: row.name,
      role: row.role,
      joinedAt: row.joined_at,
      lastSeenAt: row.last_seen_at,
      personId: row.person_id,
      isMe: row.identity_id === req.identity.id,
    }));
    res.json(attendees);
  });

  return router;
}
