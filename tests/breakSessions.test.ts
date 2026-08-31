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
 * Lunch, dinner, the coffee break. Programme furniture: on the schedule so
 * nobody books over it by accident, but it competes for nothing — which is the
 * whole difference between a break and a session that holds the floor.
 */
describe('breaks', () => {
  let harness: Harness;
  let eventId: number;
  let fixedRoom: number;
  let openRoom: number;
  let admin: Agent;
  let user: Agent;

  const LUNCH_START = 720;
  const LUNCH_END = 780;

  const lunch = (overrides: Record<string, unknown> = {}) =>
    admin.post('/api/e/testconf/sessions').send({
      roomId: openRoom,
      type: 'official',
      background: true,
      title: 'Lunch',
      startsAt: at(DAY_ONE, LUNCH_START),
      endsAt: at(DAY_ONE, LUNCH_END),
      ...overrides,
    });

  const attendeeSession = (startMin: number, endMin: number, roomId = openRoom) =>
    user.post('/api/e/testconf/sessions').send({
      roomId,
      title: 'Lunchtime lightning talk',
      startsAt: at(DAY_ONE, startMin),
      endsAt: at(DAY_ONE, endMin),
    });

  beforeEach(async () => {
    harness = makeHarness();
    eventId = seedEvent(harness.db);
    fixedRoom = seedRoom(harness.db, eventId, { name: 'Main Hall' });
    openRoom = seedRoom(harness.db, eventId, { name: 'Open Room', openBooking: 1, sortOrder: 1 });
    admin = await actorWithRole(harness, 'testconf', 'admin-pw');
    user = await actorWithRole(harness, 'testconf', 'user-pw');
  });
  afterEach(() => harness.close());

  it('is off by default', async () => {
    const res = await lunch({ background: undefined }).expect(201);
    expect(res.body.background).toBe(false);
  });

  it('reports the flag on the session it was set on', async () => {
    const res = await lunch().expect(201);
    expect(res.body.background).toBe(true);
    expect(res.body.blocksOpenBooking).toBe(false);
  });

  it('does not stop an attendee booking through it', async () => {
    await lunch().expect(201);
    await attendeeSession(LUNCH_START, LUNCH_END).expect(201);
  });

  it('does not count as a double booking of its own room', async () => {
    // The attendee's session lands in the very room the break names, at the
    // very same minutes. A break is not using the room in that sense.
    await lunch().expect(201);
    await attendeeSession(LUNCH_START + 10, LUNCH_END - 10).expect(201);
  });

  it('is not itself refused for overlapping what is already in the room', async () => {
    await attendeeSession(LUNCH_START, LUNCH_END).expect(201);
    await lunch().expect(201);
  });

  it('refuses the flag on an open session', async () => {
    const res = await admin
      .post('/api/e/testconf/sessions')
      .send({
        roomId: openRoom,
        type: 'open',
        background: true,
        title: 'Not allowed',
        startsAt: at(DAY_ONE, LUNCH_START),
        endsAt: at(DAY_ONE, LUNCH_END),
      })
      .expect(400);
    expect(res.body.error.message).toMatch(/break/i);
  });

  it('ignores the flag from an attendee', async () => {
    const res = await user
      .post('/api/e/testconf/sessions')
      .send({
        roomId: openRoom,
        background: true,
        title: 'Mine',
        startsAt: at(DAY_ONE, LUNCH_START),
        endsAt: at(DAY_ONE, LUNCH_END),
      })
      .expect(201);
    expect(res.body.background).toBe(false);
  });

  it('is independent of holding the floor, and can be both', async () => {
    const dinner = await lunch({
      title: 'Conference dinner',
      blocksOpenBooking: true,
      startsAt: at(DAY_ONE, 1140),
      endsAt: at(DAY_ONE, 1260),
    }).expect(201);
    expect(dinner.body.background).toBe(true);
    expect(dinner.body.blocksOpenBooking).toBe(true);
    // The hold half still bites: nobody books against the dinner.
    const res = await attendeeSession(1140, 1260).expect(409);
    expect(res.body.error.code).toBe('blocked');
  });

  it('an organiser can turn a break back into an ordinary session', async () => {
    const created = await lunch().expect(201);
    const patched = await admin
      .patch(`/api/e/testconf/sessions/${created.body.id}`)
      .send({ background: false })
      .expect(200);
    expect(patched.body.background).toBe(false);
  });

  it('repeats onto every day of a run', async () => {
    const res = await admin
      .post('/api/e/testconf/sessions/repeat')
      .send({
        roomId: fixedRoom,
        type: 'official',
        background: true,
        title: 'Lunch',
        startsAt: at(DAY_ONE, LUNCH_START),
        endsAt: at(DAY_ONE, LUNCH_END),
        repeat: { until: DAY_TWO },
      })
      .expect(201);
    expect(res.body.sessions).toHaveLength(2);
    for (const s of res.body.sessions) expect(s.background).toBe(true);
  });
});
