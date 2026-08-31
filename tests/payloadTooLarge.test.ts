import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agentFor, makeHarness, type Agent, type Harness } from './helpers.js';

/**
 * The body cap is `express.json({ limit: '256kb' })` in app.ts, and it fires
 * before any route runs. It used to reach the terminal handler as an unknown
 * error and come back a 500 — which told someone importing a large programme
 * that the server was broken, rather than that their file was too big.
 */
describe('a request body over the cap', () => {
  let harness: Harness;
  let agent: Agent;

  beforeEach(async () => {
    harness = makeHarness();
    agent = agentFor(harness);
    await agent.get('/api/me').expect(200);
  });
  afterEach(() => harness.close());

  const oversized = () => ({ event: { name: 'x'.repeat(300_000) } });

  it('is a 413 naming the limit, not a 500', async () => {
    const res = await agent
      .post('/api/events/import')
      .set('X-Instance-Key', 'instance-pw')
      .send(oversized());

    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ error: { code: 'too_large' } });
    expect(res.body.error.message).toMatch(/256 KB/);
  });

  it('answers the same way on any route, not just import', async () => {
    const res = await agent.post('/api/events').send(oversized());
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('too_large');
  });
});
