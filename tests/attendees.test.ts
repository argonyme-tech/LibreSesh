import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AttendeeDto } from '../server/src/shared/types.js';
import { actorWithRole, agentFor, makeHarness, seedEvent, type Harness } from './helpers.js';

describe('attendees', () => {
  let harness: Harness;
  let admin: Awaited<ReturnType<typeof actorWithRole>>;

  beforeEach(async () => {
    harness = makeHarness();
    seedEvent(harness.db);
    admin = await actorWithRole(harness, 'testconf', 'admin-pw');
  });
  afterEach(() => harness.close());

  const read = async (): Promise<AttendeeDto[]> =>
    (await admin.get('/api/e/testconf/attendees').expect(200)).body as AttendeeDto[];

  it('is admin-only', async () => {
    const viewer = await actorWithRole(harness, 'testconf', 'viewer-pw');
    await viewer.get('/api/e/testconf/attendees').expect(403);
  });

  it('lists everyone who holds a role or a name, with hex UIDs', async () => {
    const user = await actorWithRole(harness, 'testconf', 'user-pw');
    await user.patch('/api/e/testconf/me').send({ displayName: 'Ada' }).expect(200);

    const list = await read();
    expect(list).toHaveLength(2);

    const me = list.find((a) => a.isMe);
    const ada = list.find((a) => a.name === 'Ada');
    expect(me?.role).toBe('admin');
    expect(ada?.role).toBe('user');
    expect(ada?.isMe).toBe(false);
    for (const a of list) {
      expect(a.uid).toMatch(/^[0-9a-f]{5}$/);
      expect(a.joinedAt).toBeTruthy();
      expect(a.lastSeenAt).toBeTruthy();
    }
  });

  it('does not list an identity that never entered the event', async () => {
    const lurker = agentFor(harness);
    await lurker.get('/api/me').expect(200); // has an identity, but no name or role here
    expect(await read()).toHaveLength(1); // just the admin
  });

  it('links the profile an attendee holds', async () => {
    await admin.patch('/api/e/testconf/me/profile').send({}).expect(200);
    const [me] = await read();
    expect(me?.personId).not.toBeNull();
  });

  it('gives two identities distinct UIDs and keeps them stable', async () => {
    const other = await actorWithRole(harness, 'testconf', 'user-pw');
    await other.get('/api/e/testconf/bundle').expect(200);
    const first = await read();
    const second = await read();
    expect(new Set(first.map((a) => a.uid)).size).toBe(first.length);
    expect(second.map((a) => a.uid).sort()).toEqual(first.map((a) => a.uid).sort());
  });
});
