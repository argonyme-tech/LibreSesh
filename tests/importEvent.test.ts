import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ImportResult } from '../server/src/importEvent.js';
import { localDate, localMinuteOfDay } from '../server/src/shared/time.js';
import {
  actorWithRole,
  agentFor,
  DAY_ONE,
  DAY_TWO,
  makeHarness,
  seedEvent,
  TEST_TIMEZONE,
  type Agent,
  type Harness,
} from './helpers.js';

/** The shape a transcribed schedule arrives in: names and wall-clock times. */
const document = () => ({
  format: 'libresesh.event' as const,
  version: 1 as const,
  event: {
    name: 'Photo Conf',
    slug: 'photoconf',
    timezone: TEST_TIMEZONE,
    startDate: DAY_ONE,
    endDate: DAY_TWO,
  },
  rooms: [{ name: 'Main hall', capacity: 200 }, { name: 'Side room' }],
  tracks: [{ name: 'Design' }, { name: 'Infrastructure' }],
  tags: [{ name: 'beginner' }],
  sessions: [
    {
      room: 'Main hall',
      track: 'Design',
      tags: ['beginner'],
      title: 'Opening keynote',
      speaker: 'Ada Lovelace',
      date: DAY_ONE,
      start: '09:00',
      end: '10:00',
    },
    {
      room: 'Side room',
      title: 'Hallway track, formalised',
      date: DAY_ONE,
      start: '11:00',
      end: '11:30',
    },
  ],
});

describe('event import from JSON', () => {
  let harness: Harness;
  let importer: Agent;

  beforeEach(async () => {
    harness = makeHarness();
    importer = agentFor(harness);
    await importer.get('/api/me').expect(200);
  });

  afterEach(() => harness.close());

  const post = async (
    doc: unknown,
    { key = 'instance-pw', dryRun = false } = {},
  ): Promise<ImportResult> => {
    const res = await importer
      .post(`/api/events/import${dryRun ? '?dryRun=1' : ''}`)
      .set('X-Instance-Key', key)
      .send(doc)
      .expect(dryRun ? 200 : 201);
    return res.body as ImportResult;
  };

  const failure = async (doc: unknown, status: number): Promise<string> => {
    const res = await importer
      .post('/api/events/import')
      .set('X-Instance-Key', 'instance-pw')
      .send(doc)
      .expect(status);
    return (res.body as { error: { message: string } }).error.message;
  };

  it('needs the instance password', async () => {
    await importer.post('/api/events/import').send(document()).expect(403);
    await importer
      .post('/api/events/import')
      .set('X-Instance-Key', 'not-the-password')
      .send(document())
      .expect(403);
  });

  it('builds the event, its rooms, tracks, tags and sessions', async () => {
    const result = await post(document());

    expect(result.counts).toEqual({ rooms: 2, tracks: 2, tags: 1, sessions: 2, people: 1 });
    expect(result.warnings).toEqual([]);

    const admin = await actorWithRole(harness, 'photoconf', result.generatedPasswords.adminPassword!);
    const bundle = (await admin.get('/api/e/photoconf/bundle').expect(200)).body as {
      rooms: { name: string; capacity: number | null }[];
      tracks: { name: string }[];
      sessions: {
        title: string;
        startsAt: string;
        endsAt: string;
        speaker: string;
        trackId: number | null;
        tagIds: number[];
      }[];
    };

    // Array order is column order: the rooms come back as they were printed.
    expect(bundle.rooms.map((r) => r.name)).toEqual(['Main hall', 'Side room']);
    expect(bundle.rooms[0]?.capacity).toBe(200);
    expect(bundle.tracks.map((t) => t.name)).toEqual(['Design', 'Infrastructure']);

    const keynote = bundle.sessions.find((s) => s.title === 'Opening keynote');
    expect(keynote).toBeDefined();
    // 09:00 was local time in the event's zone, not UTC.
    expect(localDate(new Date(keynote!.startsAt), TEST_TIMEZONE)).toBe(DAY_ONE);
    expect(localMinuteOfDay(new Date(keynote!.startsAt), TEST_TIMEZONE)).toBe(9 * 60);
    expect(localMinuteOfDay(new Date(keynote!.endsAt), TEST_TIMEZONE)).toBe(10 * 60);
    expect(keynote!.speaker).toBe('Ada Lovelace');
    expect(keynote!.trackId).not.toBeNull();
    expect(keynote!.tagIds).toHaveLength(1);
  });

  it('mints the passwords left blank, and they open the event', async () => {
    const result = await post(document());
    expect(Object.keys(result.generatedPasswords).sort()).toEqual([
      'adminPassword',
      'userPassword',
      'viewerPassword',
    ]);
    await actorWithRole(harness, 'photoconf', result.generatedPasswords.viewerPassword!);
  });

  it('keeps a supplied password to itself', async () => {
    const doc = document();
    const result = await post({
      ...doc,
      event: { ...doc.event, adminPassword: 'a-typed-admin-password' },
    });
    expect(result.generatedPasswords.adminPassword).toBeUndefined();
    await actorWithRole(harness, 'photoconf', 'a-typed-admin-password');
  });

  it('reuses one profile for a speaker named twice', async () => {
    const doc = document();
    doc.sessions[1] = { ...doc.sessions[1]!, speaker: 'ada   lovelace' };
    const result = await post(doc);
    expect(result.counts.people).toBe(1);
  });

  describe('dry run', () => {
    it('reports the same counts and writes nothing', async () => {
      const result = await post(document(), { dryRun: true });

      expect(result.dryRun).toBe(true);
      expect(result.eventId).toBeNull();
      expect(result.counts).toEqual({ rooms: 2, tracks: 2, tags: 1, sessions: 2, people: 1 });

      const events = (await agentFor(harness).get('/api/events').expect(200)).body as unknown[];
      expect(events).toHaveLength(0);
      // The slug is still free, so the real run can follow the rehearsal.
      await post(document());
    });

    it('fails the same way a real import would', async () => {
      const doc = document();
      doc.sessions[0] = { ...doc.sessions[0]!, room: 'Balcony' };
      await importer
        .post('/api/events/import?dryRun=1')
        .set('X-Instance-Key', 'instance-pw')
        .send(doc)
        .expect(400);
    });
  });

  describe('contradictions in the document', () => {
    it('refuses a session in a room nobody declared, naming the row', async () => {
      const doc = document();
      doc.sessions[0] = { ...doc.sessions[0]!, room: 'Balcony' };
      const message = await failure(doc, 400);
      expect(message).toContain('sessions[0] "Opening keynote"');
      expect(message).toContain('Balcony');
    });

    it('refuses an undeclared track or tag', async () => {
      const withTrack = document();
      withTrack.sessions[0] = { ...withTrack.sessions[0]!, track: 'Governance' };
      expect(await failure(withTrack, 400)).toContain('Governance');

      const withTag = document();
      withTag.sessions[0] = { ...withTag.sessions[0]!, tags: ['advanced'] };
      expect(await failure(withTag, 400)).toContain('advanced');
    });

    it('refuses a session outside the event dates', async () => {
      const doc = document();
      doc.sessions[0] = { ...doc.sessions[0]!, date: '2026-07-04' };
      const message = await failure(doc, 400);
      expect(message).toContain('2026-07-04');
      expect(message).toContain('outside the event dates');
    });

    it('refuses two rooms with the same name', async () => {
      const doc = document();
      doc.rooms = [{ name: 'Main hall' }, { name: 'main  hall' }];
      expect(await failure(doc, 400)).toContain('Two rooms');
    });

    it('refuses a slug that is taken', async () => {
      seedEvent(harness.db, { slug: 'photoconf' });
      expect(await failure(document(), 409)).toContain('slug is already taken');
    });

    it('refuses a time that is not on the five-minute grid', async () => {
      const doc = document();
      doc.sessions[0] = { ...doc.sessions[0]!, start: '09:03' };
      expect(await failure(doc, 400)).toContain('sessions[0]');
    });

    it('leaves nothing behind when a later row fails', async () => {
      const doc = document();
      doc.sessions[1] = { ...doc.sessions[1]!, room: 'Balcony' };
      await failure(doc, 400);

      const events = (await agentFor(harness).get('/api/events').expect(200)).body as unknown[];
      expect(events).toHaveLength(0);
    });
  });

  describe('warnings', () => {
    it('flags a session the schedule will not show', async () => {
      const doc = document();
      doc.event = { ...doc.event, dayStartMin: 600 };
      doc.sessions[0] = { ...doc.sessions[0]!, start: '09:00', end: '09:30' };
      const result = await post(doc);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('sessions[0] "Opening keynote"');
      expect(result.warnings[0]).toContain('outside the hours');
      // A warning is not a refusal: the session is in the event.
      expect(result.counts.sessions).toBe(2);
    });

    it('flags a double booking without refusing it', async () => {
      const doc = document();
      doc.sessions[1] = {
        ...doc.sessions[1]!,
        room: 'Main hall',
        start: '09:30',
        end: '10:30',
        track: undefined as unknown as string,
      };
      const result = await post(doc);

      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('overlaps');
      expect(result.counts.sessions).toBe(2);
    });
  });

  it('takes instants instead of local times', async () => {
    const doc = document();
    doc.sessions = [
      {
        room: 'Main hall',
        title: 'Written by a program',
        startsAt: '2026-06-01T07:00:00.000Z',
        endsAt: '2026-06-01T08:00:00.000Z',
      } as (typeof doc.sessions)[number],
    ];
    const result = await post(doc);
    expect(result.counts.sessions).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  // The template is what anyone starts from, so a stale one is worse than
  // none. This is the only thing that keeps it honest.
  it('imports the example document shipped in docs/', async () => {
    const path = new URL('../docs/examples/schedule-import.example.json', import.meta.url);
    const doc = JSON.parse(readFileSync(path, 'utf8')) as unknown;
    const result = await post(doc, { dryRun: true });

    expect(result.warnings).toEqual([]);
    expect(result.counts).toEqual({ rooms: 3, tracks: 2, tags: 2, sessions: 4, people: 2 });
  });

  it('refuses a document with both time forms, or a key it does not know', async () => {
    const both = document();
    both.sessions[0] = { ...both.sessions[0]!, startsAt: '2026-06-01T07:00:00.000Z' } as never;
    expect(await failure(both, 400)).toContain('not both');

    expect(await failure({ ...document(), session: [] }, 400)).toBeTruthy();
  });
});
