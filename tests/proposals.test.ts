import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DAY_ONE,
  actorWithRole,
  at,
  makeHarness,
  seedEvent,
  seedRoom,
  seedTag,
  type Agent,
  type Harness,
} from './helpers.js';

describe('proposal pool', () => {
  let harness: Harness;
  let openRoom: number;
  let tagId: number;
  let admin: Agent;
  let pitcher: Agent;
  let other: Agent;
  let viewer: Agent;

  beforeEach(async () => {
    harness = makeHarness();
    const eventId = seedEvent(harness.db);
    openRoom = seedRoom(harness.db, eventId, { name: 'Open Room', openBooking: 1 });
    tagId = seedTag(harness.db, eventId, 'Community');
    admin = await actorWithRole(harness, 'testconf', 'admin-pw');
    pitcher = await actorWithRole(harness, 'testconf', 'user-pw');
    other = await actorWithRole(harness, 'testconf', 'user-pw');
    viewer = await actorWithRole(harness, 'testconf', 'viewer-pw');
  });
  afterEach(() => harness.close());

  const pitch = (agent: Agent, body: Record<string, unknown> = {}) =>
    agent.post('/api/e/testconf/proposals').send({ title: 'Repair café', ...body });

  it('lets an attendee pitch without picking a room or a time', async () => {
    const res = await pitch(pitcher, { description: 'Bring broken things' }).expect(201);
    expect(res.body).toMatchObject({
      title: 'Repair café',
      placedSessionId: null,
      interestCount: 0,
      interested: false,
    });
    expect(res.body.createdByName).toMatch(/^attendee_/);
  });

  describe('decision phase (Mímir add-on)', () => {
    it('defaults to concern so vanilla pitches are unchanged', async () => {
      const res = await pitch(pitcher).expect(201);
      expect(res.body.phase).toBe('concern');
    });

    it('accepts an explicit phase on create and on patch', async () => {
      const res = await pitch(pitcher, { phase: 'inquiry' }).expect(201);
      expect(res.body.phase).toBe('inquiry');
      const patched = await pitcher
        .patch(`/api/e/testconf/proposals/${res.body.id}`)
        .send({ phase: 'proposal' })
        .expect(200);
      expect(patched.body.phase).toBe('proposal');
    });

    it('keeps the phase when a patch does not mention it', async () => {
      const res = await pitch(pitcher, { phase: 'decision' }).expect(201);
      const patched = await pitcher
        .patch(`/api/e/testconf/proposals/${res.body.id}`)
        .send({ title: 'Repair café v2' })
        .expect(200);
      expect(patched.body.phase).toBe('decision');
    });

    it('rejects a phase outside the sequence', async () => {
      await pitch(pitcher, { phase: 'vibes' }).expect(400);
    });
  });

  it('shows up in the bundle', async () => {
    await pitch(pitcher).expect(201);
    const bundle = await viewer.get('/api/e/testconf/bundle').expect(200);
    expect(bundle.body.proposals).toHaveLength(1);
    expect(bundle.body.proposals[0].title).toBe('Repair café');
  });

  it('blocks viewers from pitching', async () => {
    await pitch(viewer).expect(403);
  });

  it('creates a person from a new speaker name', async () => {
    const res = await pitch(pitcher, { speakerName: 'Ada Lovelace' }).expect(201);
    expect(res.body.speaker).toBe('Ada Lovelace');
    const bundle = await viewer.get('/api/e/testconf/bundle').expect(200);
    expect(bundle.body.people.map((p: { name: string }) => p.name)).toContain('Ada Lovelace');
  });

  it('carries tags and rejects one from another event', async () => {
    const ok = await pitch(pitcher, { tagIds: [tagId] }).expect(201);
    expect(ok.body.tagIds).toEqual([tagId]);

    const otherEvent = seedEvent(harness.db, { slug: 'other' });
    const foreign = seedTag(harness.db, otherEvent, 'Foreign');
    await pitch(pitcher, { tagIds: [foreign] }).expect(400);
  });

  describe('interest', () => {
    it('counts per person and is visible to everyone', async () => {
      const p = await pitch(pitcher).expect(201);
      await viewer.put(`/api/e/testconf/proposals/${p.body.id}/interest`).expect(204);
      await other.put(`/api/e/testconf/proposals/${p.body.id}/interest`).expect(204);

      const asViewer = await viewer.get('/api/e/testconf/bundle').expect(200);
      expect(asViewer.body.proposals[0].interestCount).toBe(2);
      expect(asViewer.body.proposals[0].interested).toBe(true);

      const asPitcher = await pitcher.get('/api/e/testconf/bundle').expect(200);
      expect(asPitcher.body.proposals[0].interestCount).toBe(2);
      expect(asPitcher.body.proposals[0].interested).toBe(false);
    });

    it('is idempotent and reversible', async () => {
      const p = await pitch(pitcher).expect(201);
      await viewer.put(`/api/e/testconf/proposals/${p.body.id}/interest`).expect(204);
      await viewer.put(`/api/e/testconf/proposals/${p.body.id}/interest`).expect(204);
      await viewer.delete(`/api/e/testconf/proposals/${p.body.id}/interest`).expect(204);

      const bundle = await viewer.get('/api/e/testconf/bundle').expect(200);
      expect(bundle.body.proposals[0].interestCount).toBe(0);
      expect(bundle.body.proposals[0].interested).toBe(false);
    });
  });

  describe('editing', () => {
    it('lets the pitcher and an organiser edit, but not a stranger', async () => {
      const p = await pitch(pitcher).expect(201);
      await pitcher
        .patch(`/api/e/testconf/proposals/${p.body.id}`)
        .send({ title: 'Renamed' })
        .expect(200);
      await admin
        .patch(`/api/e/testconf/proposals/${p.body.id}`)
        .send({ description: 'Moderated' })
        .expect(200);
      await other
        .patch(`/api/e/testconf/proposals/${p.body.id}`)
        .send({ title: 'Hijacked' })
        .expect(403);
    });

    it('lets the pitcher withdraw it', async () => {
      const p = await pitch(pitcher).expect(201);
      await pitcher.delete(`/api/e/testconf/proposals/${p.body.id}`).expect(204);
      const bundle = await viewer.get('/api/e/testconf/bundle').expect(200);
      expect(bundle.body.proposals).toEqual([]);
    });
  });

  describe('placing on the grid', () => {
    const place = (agent: Agent, id: number, overrides: Record<string, unknown> = {}) =>
      agent.post(`/api/e/testconf/proposals/${id}/place`).send({
        roomId: openRoom,
        startsAt: at(DAY_ONE, 600),
        endsAt: at(DAY_ONE, 660),
        ...overrides,
      });

    it('creates a session and links the pitch to it', async () => {
      const p = await pitch(pitcher, { tagIds: [tagId], speakerName: 'Ada' }).expect(201);
      const res = await place(admin, p.body.id).expect(201);

      expect(res.body.session.title).toBe('Repair café');
      expect(res.body.session.tagIds).toEqual([tagId]);
      expect(res.body.session.speaker).toBe('Ada');
      // The pitcher keeps ownership so they can still edit their open session.
      expect(res.body.session.createdBy).toBe((await pitcher.get('/api/me')).body.id);

      const bundle = await viewer.get('/api/e/testconf/bundle').expect(200);
      expect(bundle.body.proposals[0].placedSessionId).toBe(res.body.session.id);
      expect(bundle.body.sessions).toHaveLength(1);
    });

    it('is admin-only', async () => {
      const p = await pitch(pitcher).expect(201);
      await place(pitcher, p.body.id).expect(403);
      await place(viewer, p.body.id).expect(403);
    });

    it('moves everyone who was interested onto the session as a star', async () => {
      const p = await pitch(pitcher).expect(201);
      await viewer.put(`/api/e/testconf/proposals/${p.body.id}/interest`).expect(204);
      await other.put(`/api/e/testconf/proposals/${p.body.id}/interest`).expect(204);

      const placed = await place(admin, p.body.id).expect(201);
      const sessionId = placed.body.session.id;

      const asViewer = await viewer.get('/api/e/testconf/bundle').expect(200);
      expect(asViewer.body.starredSessionIds).toContain(sessionId);
      const asOther = await other.get('/api/e/testconf/bundle').expect(200);
      expect(asOther.body.starredSessionIds).toContain(sessionId);
      // The pitcher never registered interest, so they are not starred.
      const asPitcher = await pitcher.get('/api/e/testconf/bundle').expect(200);
      expect(asPitcher.body.starredSessionIds).not.toContain(sessionId);
      expect(asViewer.body.starCounts[sessionId]).toBe(2);
    });

    it('refuses to place the same pitch twice', async () => {
      const p = await pitch(pitcher).expect(201);
      await place(admin, p.body.id).expect(201);
      const again = await place(admin, p.body.id, {
        startsAt: at(DAY_ONE, 700),
        endsAt: at(DAY_ONE, 760),
      }).expect(409);
      expect(again.body.error.code).toBe('placed');
    });

    it('refuses a slot that is already taken', async () => {
      const first = await pitch(pitcher).expect(201);
      const second = await pitch(other, { title: 'Another' }).expect(201);
      await place(admin, first.body.id).expect(201);
      const clash = await place(admin, second.body.id).expect(409);
      expect(clash.body.error.code).toBe('overlap');
    });

    it('rejects a time off the five-minute grid', async () => {
      const p = await pitch(pitcher).expect(201);
      await place(admin, p.body.id, {
        startsAt: at(DAY_ONE, 600).replace(':00:00', ':03:00'),
      }).expect(400);
    });

    it('stops the pitch being edited once it is placed', async () => {
      const p = await pitch(pitcher).expect(201);
      await place(admin, p.body.id).expect(201);
      const res = await pitcher
        .patch(`/api/e/testconf/proposals/${p.body.id}`)
        .send({ title: 'Too late' })
        .expect(409);
      expect(res.body.error.code).toBe('placed');
    });
  });

  it('is blocked while the event is archived', async () => {
    await admin.patch('/api/e/testconf/settings').send({ archived: true }).expect(200);
    await pitch(pitcher).expect(409);
  });
});
