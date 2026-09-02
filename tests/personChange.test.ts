import { describe, expect, it } from 'vitest';
import type { PersonDto } from '../server/src/shared/types.js';
import { applyPersonChange } from '../web/src/lib/useEventData.js';

/**
 * A change to one person reaches a client two ways, and they carry different
 * things. The reply to your own request is written for you, so an organiser
 * gets the private facts in it. A broadcast goes to every subscriber at once,
 * so it can carry none of them — and its `isMine` was worked out for whoever
 * caused the change, not for whoever receives it.
 */
const person = (over: Partial<PersonDto> & { id: number; name: string }): PersonDto => ({
  bio: '',
  links: [],
  isMine: false,
  claimed: true,
  username: 'ada',
  creditable: true,
  updatedAt: '2026-09-02T10:00:00.000Z',
  ...over,
});

/** What an organiser holds: the private facts are all present. */
const held = person({
  id: 1,
  name: 'Ada Lovelace',
  role: 'user',
  holderUid: 'a1b2c',
  codeState: 'none',
  lastSeenAt: '2026-09-02T10:00:00.000Z',
  joinedAt: '2026-09-01T09:00:00.000Z',
  sessionCount: 2,
});

/** What the wire carries: no private facts at all, the keys simply absent. */
const broadcast = (over: Partial<PersonDto> = {}): PersonDto =>
  person({ id: 1, name: 'Ada Lovelace', ...over });

describe('applying a change to a person', () => {
  it('takes a role the organiser just set', () => {
    // The reply to PUT /people/:id/role. Keeping the old value here is what
    // made the role select look broken: it snapped back a moment after use.
    const [row] = applyPersonChange([held], { ...held, role: 'admin' });
    expect(row?.role).toBe('admin');
  });

  it('keeps the facts a broadcast could not carry', () => {
    const [row] = applyPersonChange([held], broadcast({ bio: 'Edited by an organiser' }));
    expect(row?.bio).toBe('Edited by an organiser');
    expect(row).toMatchObject({
      role: 'user',
      holderUid: 'a1b2c',
      sessionCount: 2,
      joinedAt: '2026-09-01T09:00:00.000Z',
    });
  });

  it('never lets a frame written for someone else say whose profile this is', () => {
    const mine = { ...held, isMine: true };
    // An organiser edits my bio; their copy of the row is not "mine".
    const [row] = applyPersonChange([mine], broadcast({ isMine: false, bio: 'Moderated' }));
    expect(row?.isMine).toBe(true);
    expect(row?.bio).toBe('Moderated');
  });

  it('does not hand you a second profile you never claimed', () => {
    // Somebody else creates their own profile; the frame says `isMine` for
    // them. You already have one, and nobody has two.
    const mine = person({ id: 1, name: 'Me', isMine: true });
    const theirs = person({ id: 2, name: 'Them', isMine: true });
    const rows = applyPersonChange([mine], theirs);
    expect(rows.find((p) => p.id === 2)?.isMine).toBe(false);
    expect(rows.find((p) => p.id === 1)?.isMine).toBe(true);
  });

  it('trusts a first sighting when you hold no profile at all', () => {
    const rows = applyPersonChange([], person({ id: 7, name: 'Mine', isMine: true }));
    expect(rows[0]?.isMine).toBe(true);
  });
});
