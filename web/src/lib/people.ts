import type { PersonDto, SessionDto } from '@shared/types';

/**
 * Who on a bill can actually touch the session.
 *
 * The server's rule (sessionRules.ts, `assertMayMutate`) is that a speaker
 * credited on a session may edit it when their identity holds at least the
 * speaker role: `speaksHere && atLeast(role, 'speaker')`. Two things have to
 * be true at once — the profile is claimed by a device, and that device's
 * role is speaker or organiser — and being on the poster is neither.
 *
 * This is the one place the client says so. It used to be spelled out four
 * times, and the copies had already drifted: three of them tested
 * `role === 'user'`, which misses a claimed holder whose role is `viewer`
 * (re-entered with the viewer password) or `null` (signed out of the event —
 * the roles row goes, the claim stays). The server refuses both. A note that
 * says "fine" about a person who then gets a 403 is worse than no note.
 *
 * `role` is sent to organisers only. For anyone else it is absent, and the
 * only thing left to see is whether the profile is claimed at all — which is
 * still worth saying, and is all that is said.
 */
export function cannotEditOwn(p: PersonDto): boolean {
  if (!p.claimed) return true;
  if (p.role === undefined) return false; // not ours to know
  return p.role !== 'speaker' && p.role !== 'admin';
}

/** The people credited on a session who cannot edit it, in billing order. */
export function stuckSpeakers(session: SessionDto, people: readonly PersonDto[]): PersonDto[] {
  return session.speakers
    .map((sp) => people.find((p) => p.id === sp.id))
    .filter((p): p is PersonDto => p !== undefined && cannotEditOwn(p));
}
