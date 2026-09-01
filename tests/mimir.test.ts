import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { actorWithRole, makeHarness, seedEvent, type Agent, type Harness } from './helpers.js';

/** Mímir add-on routes: catalog, prompt, chat. The in-memory test DB has no
 *  data directory, so file-backed routes answer with their empty/unavailable
 *  shapes — which is exactly the vanilla-deployment behaviour to pin down. */
describe('mimir routes', () => {
  let harness: Harness;
  let admin: Agent;
  let attendee: Agent;
  let viewer: Agent;

  beforeEach(async () => {
    harness = makeHarness();
    seedEvent(harness.db);
    admin = await actorWithRole(harness, 'testconf', 'admin-pw');
    attendee = await actorWithRole(harness, 'testconf', 'user-pw');
    viewer = await actorWithRole(harness, 'testconf', 'viewer-pw');
  });
  afterEach(() => harness.close());

  it('serves an empty catalog when none has been uploaded', async () => {
    const res = await attendee.get('/api/e/testconf/mimir/catalog').expect(200);
    expect(res.body).toEqual({ version: 1, dynamics: [] });
  });

  it('keeps the catalog away from viewers and its upload admin-only', async () => {
    await viewer.get('/api/e/testconf/mimir/catalog').expect(403);
    await attendee
      .put('/api/e/testconf/mimir/catalog')
      .send({ version: 1, dynamics: [] })
      .expect(403);
  });

  it('answers 503 with a clear code when the chat engine has no key', async () => {
    delete process.env.MIMIR_API_KEY;
    const res = await admin
      .post('/api/e/testconf/mimir/chat')
      .send({ messages: [{ role: 'user', content: 'hola' }] })
      .expect(503);
    expect(res.body.error.code).toBe('no_engine');
  });

  it('keeps the chat admin-only', async () => {
    await attendee
      .post('/api/e/testconf/mimir/chat')
      .send({ messages: [{ role: 'user', content: 'hola' }] })
      .expect(403);
  });
});
