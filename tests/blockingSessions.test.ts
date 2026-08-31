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
 * A session marked `blocksOpenBooking` holds the floor: while it runs, an
 * attendee may place nothing anywhere in the event. Organisers and speakers
 * are not stopped — the schedule badges what they place as competing instead.
 */
describe('sessions that hold the floor', () => {
  let harness: Harness;
  let eventId: number;
  let fixedRoom: number;
  let openRoom: number;
  let secondOpenRoom: number;
  let admin: Agent;
  let user: Agent;
  let speaker: Agent;

  // The keynote: 10:00–11:00 on day one, in the room nobody may book.
  const KEYNOTE_START = 600;
  const KEYNOTE_END = 660;

  const keynote = (overrides: Record<string, unknown> = {}) =>
    admin.post('/api/e/testconf/sessions').send({
      roomId: fixedRoom,
      type: 'official',
      blocksOpenBooking: true,
      title: 'Opening keynote',
      startsAt: at(DAY_ONE, KEYNOTE_START),
      endsAt: at(DAY_ONE, KEYNOTE_END),
      ...overrides,
    });

  /** An attendee's open session, in a bookable room, over the given minutes. */
  const attendeeSession = (agent: Agent, startMin: number, endMin: number, roomId = openRoom) =>
    agent.post('/api/e/testconf/sessions').send({
      roomId,
      title: 'Lightning talk',
      startsAt: at(DAY_ONE, startMin),
      endsAt: at(DAY_ONE, endMin),
    });

  beforeEach(async () => {
    harness = makeHarness();
    eventId = seedEvent(harness.db);
    fixedRoom = seedRoom(harness.db, eventId, { name: 'Main Hall' });
    openRoom = seedRoom(harness.db, eventId, { name: 'Open Room', openBooking: 1, sortOrder: 1 });
    secondOpenRoom = seedRoom(harness.db, eventId, {
      name: 'Other Open Room',
      openBooking: 1,
      sortOrder: 2,
    });
    admin = await actorWithRole(harness, 'testconf', 'admin-pw');
    user = await actorWithRole(harness, 'testconf', 'user-pw');
    speaker = await actorWithRole(harness, 'testconf', 'user-pw');
    const { body: me } = await speaker.get('/api/me').expect(200);
    harness.db
      .prepare('UPDATE roles SET role = ? WHERE identity_id = ? AND event_id = ?')
      .run('speaker', me.id as number, eventId);
  });
  afterEach(() => harness.close());

  it('is off by default, and an event that marks nothing behaves as before', async () => {
    const res = await keynote({ blocksOpenBooking: undefined }).expect(201);
    expect(res.body.blocksOpenBooking).toBe(false);
    await attendeeSession(user, KEYNOTE_START, KEYNOTE_END).expect(201);
  });

  it('reports the flag on the session it was set on', async () => {
    const res = await keynote().expect(201);
    expect(res.body.blocksOpenBooking).toBe(true);
  });

  it('stops an attendee booking underneath it, in every open room', async () => {
    await keynote().expect(201);
    for (const roomId of [openRoom, secondOpenRoom]) {
      const res = await attendeeSession(user, KEYNOTE_START, KEYNOTE_END, roomId).expect(409);
      expect(res.body.error.code).toBe('blocked');
      expect(res.body.error.message).toContain('Opening keynote');
    }
  });

  it('counts a partial overlap on either side', async () => {
    await keynote().expect(201);
    // Starts before the keynote and runs into it.
    await attendeeSession(user, KEYNOTE_START - 30, KEYNOTE_START + 10).expect(409);
    // Starts inside it and runs past the end.
    await attendeeSession(user, KEYNOTE_END - 10, KEYNOTE_END + 30).expect(409);
    // Swallows it whole.
    await attendeeSession(user, KEYNOTE_START - 30, KEYNOTE_END + 30).expect(409);
  });

  it('leaves the minutes either side of it free', async () => {
    await keynote().expect(201);
    // Ending exactly as it starts, and starting exactly as it ends: the
    // overlap test is half-open, so back-to-back is not competing.
    await attendeeSession(user, KEYNOTE_START - 60, KEYNOTE_START).expect(201);
    await attendeeSession(user, KEYNOTE_END, KEYNOTE_END + 60).expect(201);
  });

  it('holds only its own hour, not the rest of the event', async () => {
    await keynote().expect(201);
    await attendeeSession(user, KEYNOTE_END + 120, KEYNOTE_END + 180).expect(201);
    await user
      .post('/api/e/testconf/sessions')
      .send({
        roomId: openRoom,
        title: 'Next day',
        startsAt: at(DAY_TWO, KEYNOTE_START),
        endsAt: at(DAY_TWO, KEYNOTE_END),
      })
      .expect(201);
  });

  it('lets an organiser and a speaker through', async () => {
    await keynote().expect(201);
    await admin
      .post('/api/e/testconf/sessions')
      .send({
        roomId: openRoom,
        type: 'official',
        title: 'Runs alongside',
        startsAt: at(DAY_ONE, KEYNOTE_START),
        endsAt: at(DAY_ONE, KEYNOTE_END),
      })
      .expect(201);
    await attendeeSession(speaker, KEYNOTE_START, KEYNOTE_END, secondOpenRoom).expect(201);
  });

  it('stops an attendee dragging an existing session into the window', async () => {
    await keynote().expect(201);
    const mine = await attendeeSession(user, KEYNOTE_END + 120, KEYNOTE_END + 180).expect(201);
    const res = await user
      .patch(`/api/e/testconf/sessions/${mine.body.id}`)
      .send({ startsAt: at(DAY_ONE, KEYNOTE_START), endsAt: at(DAY_ONE, KEYNOTE_END) })
      .expect(409);
    expect(res.body.error.code).toBe('blocked');
  });

  it('still lets an attendee edit a session a later keynote landed on top of', async () => {
    // Booked first, blocked afterwards: the organiser's later decision must not
    // strand the session as uneditable.
    const mine = await attendeeSession(user, KEYNOTE_START, KEYNOTE_END).expect(201);
    await keynote().expect(201);
    await user
      .patch(`/api/e/testconf/sessions/${mine.body.id}`)
      .send({ title: 'A better title' })
      .expect(200);
    // Moving it somewhere else is still fine; moving it is only refused when
    // the destination is itself blocked.
    await user
      .patch(`/api/e/testconf/sessions/${mine.body.id}`)
      .send({ startsAt: at(DAY_ONE, KEYNOTE_END + 60), endsAt: at(DAY_ONE, KEYNOTE_END + 120) })
      .expect(200);
  });

  it('refuses the flag on an open session', async () => {
    const res = await admin
      .post('/api/e/testconf/sessions')
      .send({
        roomId: openRoom,
        type: 'open',
        blocksOpenBooking: true,
        title: 'Not allowed',
        startsAt: at(DAY_ONE, KEYNOTE_START),
        endsAt: at(DAY_ONE, KEYNOTE_END),
      })
      .expect(400);
    expect(res.body.error.message).toMatch(/official/i);
  });

  it('ignores the flag from an attendee, who cannot close the grid', async () => {
    const mine = await attendeeSession(user, KEYNOTE_START, KEYNOTE_END).expect(201);
    expect(mine.body.blocksOpenBooking).toBe(false);
    // And re-asserting it on their own session changes nothing.
    const patched = await user
      .patch(`/api/e/testconf/sessions/${mine.body.id}`)
      .send({ blocksOpenBooking: true })
      .expect(200);
    expect(patched.body.blocksOpenBooking).toBe(false);
  });

  it('refuses to open a session while it still holds the floor', async () => {
    const created = await keynote({ roomId: openRoom }).expect(201);
    // Opening it and lifting the hold are two decisions. Doing only the first
    // would leave a flag on a session no rule would ever read it from.
    await admin
      .patch(`/api/e/testconf/sessions/${created.body.id}`)
      .send({ type: 'open' })
      .expect(400);
    // Sending both together is what the form does, and it works.
    const patched = await admin
      .patch(`/api/e/testconf/sessions/${created.body.id}`)
      .send({ type: 'open', blocksOpenBooking: false })
      .expect(200);
    expect(patched.body.blocksOpenBooking).toBe(false);
    await attendeeSession(user, KEYNOTE_START, KEYNOTE_END, secondOpenRoom).expect(201);
  });

  it('lets an organiser lift the hold, which reopens the hour', async () => {
    const created = await keynote().expect(201);
    await attendeeSession(user, KEYNOTE_START, KEYNOTE_END).expect(409);
    await admin
      .patch(`/api/e/testconf/sessions/${created.body.id}`)
      .send({ blocksOpenBooking: false })
      .expect(200);
    await attendeeSession(user, KEYNOTE_START, KEYNOTE_END).expect(201);
  });

  it('stops holding the hour once it is deleted', async () => {
    const created = await keynote().expect(201);
    await admin.delete(`/api/e/testconf/sessions/${created.body.id}`).expect(204);
    await attendeeSession(user, KEYNOTE_START, KEYNOTE_END).expect(201);
  });

  it('carries the flag onto every day of a repeated run', async () => {
    const res = await admin
      .post('/api/e/testconf/sessions/repeat')
      .send({
        roomId: fixedRoom,
        type: 'official',
        blocksOpenBooking: true,
        title: 'Daily plenary',
        startsAt: at(DAY_ONE, KEYNOTE_START),
        endsAt: at(DAY_ONE, KEYNOTE_END),
        repeat: { until: DAY_TWO },
      })
      .expect(201);
    expect(res.body.sessions).toHaveLength(2);
    for (const s of res.body.sessions) expect(s.blocksOpenBooking).toBe(true);
    // Day two is held too, which is the whole point of putting it on the run.
    await user
      .post('/api/e/testconf/sessions')
      .send({
        roomId: openRoom,
        title: 'Day two clash',
        startsAt: at(DAY_TWO, KEYNOTE_START),
        endsAt: at(DAY_TWO, KEYNOTE_END),
      })
      .expect(409);
  });
});
