import type { Role } from '@shared/types';

/**
 * Invite links: a QR that carries an event password.
 *
 * The password rides in the **fragment**, and that is the whole design:
 *
 * - a fragment is never sent to the server, so the secret stays out of access
 *   logs, `Referer` headers and any proxy in between — a query string would
 *   put an event's password in Caddy's log for every scan;
 * - the gate strips it with `history.replaceState` the moment it reads it, so
 *   the URL left in the address bar is a bare `/e/:slug`. An attendee who
 *   scans the poster and then pastes "the link" into a group chat shares a
 *   page that asks for the password, not one that hands it out.
 *
 * What it does not do is make the QR itself a secret. Anyone who photographs
 * the poster has the password, exactly as if it were printed underneath — an
 * event password is a shared secret read off a wall, and this only saves the
 * typing.
 */
const PASSWORD_KEY = 'k';
const ROLE_KEY = 'r';

export interface Invite {
  password: string;
  /**
   * A label, never a grant. The server derives the real role from the password
   * and this is only what the gate says while you are looking at it, so that
   * "Invited as Attendee" can be shown before anything is submitted.
   */
  role?: Role;
}

const ROLES: readonly Role[] = ['viewer', 'user', 'speaker', 'admin'];

/** Trim a typed origin down to something `${base}/e/slug` can be built on. */
export const normalizeBaseUrl = (raw: string): string => raw.trim().replace(/\/+$/, '');

export function buildInviteUrl(opts: {
  baseUrl: string;
  slug: string;
  password: string;
  role?: Role;
}): string {
  const params = new URLSearchParams();
  params.set(PASSWORD_KEY, opts.password);
  if (opts.role) params.set(ROLE_KEY, opts.role);
  return `${normalizeBaseUrl(opts.baseUrl)}/e/${encodeURIComponent(opts.slug)}#${params.toString()}`;
}

/**
 * Read an invite out of `window.location.hash`. Undefined for anything that
 * is not one — including a bare `#`, which React Router and in-page anchors
 * both produce.
 */
export function parseInvite(hash: string): Invite | undefined {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return undefined;
  const params = new URLSearchParams(raw);
  const password = params.get(PASSWORD_KEY);
  if (!password) return undefined;
  const role = params.get(ROLE_KEY);
  return { password, role: ROLES.includes(role as Role) ? (role as Role) : undefined };
}

let taken: Invite | undefined;
let hasTaken = false;

/**
 * Read the invite out of the address bar and take it back out, once per page
 * load. Idempotent, and cached: the first caller gets the invite and every
 * caller after it gets the same answer from a URL that no longer holds one.
 *
 * Called from `main.tsx` before anything renders, and *not* only from the
 * gate, because the gate does not always appear. An organiser who scans the
 * attendee code already holds a role, walks straight through to the schedule,
 * and would otherwise be left with the password sitting in their address bar
 * with nothing to clear it.
 *
 * Touches the DOM, so it lives beside the pure helpers rather than among them —
 * the tests import those and never this.
 */
export function takeInvite(): Invite | undefined {
  if (hasTaken) return taken;
  hasTaken = true;
  taken = parseInvite(window.location.hash);
  if (taken) {
    // `replaceState`, not `pushState`: it overwrites the current history entry,
    // so Back does not return to a URL carrying the password and the browser's
    // history list never holds one either.
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return taken;
}
