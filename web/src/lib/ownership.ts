import type { PersonDto, SessionDto } from '@shared/types';

/**
 * Who on a bill can actually touch the session.
 *
 * The server's rule (sessionRules.ts, `assertMayMutate`, since 486077a): being
 * credited on a session is the whole qualification — one of five co-hosts as
 * much as the only name, whatever role the person holds. It used to demand at
 * least the speaker role as well, and that locked a speaker out of their own
 * talk for the ordinary reason that they came in through the gate as an
 * attendee, which is the role almost every speaker holds.
 *
 * So the only way somebody on the bill cannot edit it is that nobody holds
 * the profile: an organiser typed the name onto the session and the person
 * has not yet claimed it (or been sent a code, or asked for it — there are
 * three routes now, and profile_claims is the newest). The moment it is
 * claimed, they are in. Archived profiles keep their sessions and their
 * holder, so archiving changes nothing here.
 *
 * One home for this, because the first version said it four times with the
 * old rule in three of them, and a note that says "cannot edit" about a
 * person who can is worse than no note.
 */
export function cannotEditOwn(p: PersonDto): boolean {
  return !p.claimed;
}

/** The people credited on a session who cannot edit it, in billing order. */
export function stuckSpeakers(session: SessionDto, people: readonly PersonDto[]): PersonDto[] {
  return session.speakers
    .map((sp) => people.find((p) => p.id === sp.id))
    .filter((p): p is PersonDto => p !== undefined && cannotEditOwn(p));
}
