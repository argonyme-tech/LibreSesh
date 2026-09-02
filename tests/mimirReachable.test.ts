import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Mímir has to be reachable by clicking.
 *
 * Replanting the add-on onto the newer LibreSesh, the route was wired, the API
 * client was wired, the page compiled and every test passed — and the tab was
 * unreachable. Nothing linked to it and the floating button was mounted
 * nowhere, so the only way in was typing the URL. It looked finished from
 * every angle except using it.
 *
 * A typecheck cannot catch that and neither can a unit test of the page: an
 * orphan route is valid code. These assert the entry points exist, so the next
 * time the schedule is rebuilt the loss is a red test rather than a silence.
 */
const SCHEDULE = readFileSync(
  join(__dirname, '..', 'web', 'src', 'pages', 'SchedulePage.tsx'),
  'utf8',
);
const APP = readFileSync(join(__dirname, '..', 'web', 'src', 'App.tsx'), 'utf8');

describe('Mímir can be reached by clicking', () => {
  it('has a route at all', () => {
    expect(APP).toMatch(/path="\/e\/:slug\/mimir"/);
  });

  it('is linked from the schedule, where everyone starts', () => {
    // Beside Pitches: both are ways of looking at the programme, so neither
    // belongs up in the account chrome.
    expect(SCHEDULE).toMatch(/to=\{`\/e\/\$\{slug\}\/mimir`\}/);
  });

  it('mounts the floating panel on the schedule', () => {
    expect(SCHEDULE).toContain('<MimirFab');
    expect(SCHEDULE).toMatch(/import \{ MimirFab \} from "\.\.\/components\/MimirChat"/);
  });

  it('shows the rhythm notes where the schedule is', () => {
    // The notes are about the grid, so they belong on the page showing it —
    // not only inside Mímir's own tab, which an organiser opens on purpose.
    expect(SCHEDULE).toContain('<RhythmCheck');
  });

  it('gives the rhythm check the declared data, not just the sessions', () => {
    // Breaks and track hours are what turned these notes from an inference
    // about gaps into arithmetic. Dropping them on the way in would silently
    // return the component to guessing.
    const call = SCHEDULE.slice(SCHEDULE.indexOf('<RhythmCheck'));
    for (const prop of ['breaks=', 'tracks=', 'timezone=']) {
      expect(call.slice(0, 400), `RhythmCheck is missing ${prop}`).toContain(prop);
    }
  });
});
