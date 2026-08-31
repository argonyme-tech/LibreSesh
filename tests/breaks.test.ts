import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DAY_ONE,
  DAY_TWO,
  actorWithRole,
  at,
  makeHarness,
  seedEvent,
  seedRoom,
  type Agent,
  type Harness,
} from './helpers.js';

/**
 * Lunch, dinner, the coffee break. Event furniture: it belongs to no room and
 * nobody hosts it, which is why it is not a session — and why almost every
 * test here is about what a break *cannot* do.
 */
describe('breaks', () => {
  let harness: Harness;
  let eventId: number;
  let openRoom: number;
  let admin: Agent;
  let user: Agent;

  const LUNCH = { label: 'Lunch', startMin: 720, endMin: 840 };

  const createBreak = (overrides: Record<string, unknown> = {}) =>
    admin.post('/api/e/testconf/breaks').send({ ...LUNCH, ...overrides });

  beforeEach(async () => {
    harness = makeHarness();
    eventId = seedEvent(harness.db);
    openRoom = seedRoom(harness.db, eventId, { name: 'Open Room', openBooking: 1 });
    admin = await actorWithRole(harness, 'testconf', 'admin-pw');
    user = await actorWithRole(harness, 'testconf', 'user-pw');
  });
  afterEach(() => harness.close());

  it('defaults to every day of the event', async () => {
    const res = await createBreak().expect(201);
    expect(res.body).toMatchObject({ label: 'Lunch', startMin: 720, endMin: 840, date: null });
  });

  it('can be pinned to one day', async () => {
    const res = await createBreak({ label: 'Dinner', date: DAY_TWO }).expect(201);
    expect(res.body.date).toBe(DAY_TWO);
  });

  it('refuses a day outside the event', async () => {
    const res = await createBreak({ date: '2026-07-01' }).expect(400);
    expect(res.body.error.message).toMatch(/outside the event dates/i);
  });

  it('refuses an end at or before its start', async () => {
    await createBreak({ endMin: 720 }).expect(400);
    await createBreak({ endMin: 600 }).expect(400);
  });

  it('refuses times off the 5-minute grid', async () => {
    const res = await createBreak({ startMin: 722 }).expect(400);
    expect(res.body.error.message).toMatch(/5-minute/i);
  });

  it('is organisers-only', async () => {
    await user.post('/api/e/testconf/breaks').send(LUNCH).expect(403);
  });

  it('comes back in the bundle, ordered by clock', async () => {
    await createBreak({ label: 'Coffee', startMin: 930, endMin: 960 }).expect(201);
    await createBreak().expect(201);
    const res = await user.get('/api/e/testconf/bundle').expect(200);
    expect(res.body.breaks.map((b: { label: string }) => b.label)).toEqual(['Lunch', 'Coffee']);
  });

  it('stops nobody booking through it', async () => {
    await createBreak().expect(201);
    await user
      .post('/api/e/testconf/sessions')
      .send({
        roomId: openRoom,
        title: 'Lunchtime lightning talk',
        startsAt: at(DAY_ONE, 720),
        endsAt: at(DAY_ONE, 780),
      })
      .expect(201);
  });

  it('can be edited and deleted', async () => {
    const created = await createBreak().expect(201);
    const patched = await admin
      .patch(`/api/e/testconf/breaks/${created.body.id}`)
      .send({ label: 'Long lunch', startMin: 720, endMin: 900, date: DAY_ONE })
      .expect(200);
    expect(patched.body).toMatchObject({ label: 'Long lunch', endMin: 900, date: DAY_ONE });

    await admin.delete(`/api/e/testconf/breaks/${created.body.id}`).expect(204);
    const res = await admin.get('/api/e/testconf/bundle').expect(200);
    expect(res.body.breaks).toEqual([]);
  });

  it('does not reach another event', async () => {
    const other = seedEvent(harness.db, { slug: 'otherconf' });
    expect(other).not.toBe(eventId);
    const created = await createBreak().expect(201);
    await admin.delete(`/api/e/otherconf/breaks/${created.body.id}`).expect(401);
  });

  it('is not a session flag any more', async () => {
    const res = await admin
      .post('/api/e/testconf/sessions')
      .send({
        roomId: openRoom,
        type: 'official',
        background: true,
        title: 'Not a break',
        startsAt: at(DAY_ONE, 720),
        endsAt: at(DAY_ONE, 780),
      })
      .expect(201);
    expect(res.body.background).toBeUndefined();
  });
});
