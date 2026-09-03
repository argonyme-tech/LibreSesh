import { describe, expect, it } from 'vitest';
import { LINK_RULE, safeLink } from '../server/src/shared/links.js';

/**
 * What may go in an `href`. The rule used to be an allow-list of two, which
 * refused a session streamed over IPFS or Swarm along with everything else
 * anyone might invent. It is a deny-list now, and the things it denies are
 * the ones that run code on the reader's machine rather than fetching
 * something from somewhere.
 */
describe('what counts as a link', () => {
  it('takes the web, and the protocols people actually stream over', () => {
    for (const url of [
      'https://stream.example.org/hall',
      'http://stream.example.org/hall',
      'ipfs://bafybeigdyrztabc123/stream.m3u8',
      'ipns://k51qzi5uqu5dabc123',
      'bzz://abc123def456/live',
      'magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367a88a',
      'rtmp://media.example.org/live/hall',
      'rtsp://camera.example.org/room-b',
      'matrix:r/room:example.org',
      'mailto:organiser@example.org',
    ]) {
      expect(safeLink(url), url).not.toBeNull();
    }
  });

  /** The whole reason the list exists: these render into an anchor, and
   *  following one would run script in the reader's own page. */
  it('never takes one that runs something instead of fetching something', () => {
    for (const url of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)',
      'vbscript:msgbox(1)',
      'data:text/html,<script>alert(1)</script>',
      'blob:https://example.org/abc',
      'file:///etc/passwd',
      'about:config',
      'filesystem:https://example.org/temporary/x',
    ]) {
      expect(safeLink(url), url).toBeNull();
    }
  });

  it('refuses text that is not a URI at all', () => {
    for (const url of ['not a url', 'people.example.com', '', '   ']) {
      expect(safeLink(url), url).toBeNull();
    }
  });

  it('resolves a relative link only when given something to resolve against', () => {
    // Markdown in a bio may say [the board](/e/conf/proposals); a link field
    // may not, because a bare word there is a typo, not a path.
    expect(safeLink('/e/conf/proposals', 'https://sesh.example.org')).toBe(
      'https://sesh.example.org/e/conf/proposals',
    );
    expect(safeLink('/e/conf/proposals')).toBeNull();
  });

  it('is not fooled by the case or the padding of a scheme', () => {
    expect(safeLink('HTTPS://example.org/x')).toBe('https://example.org/x');
    expect(safeLink('  https://example.org/x  ')).toBe('https://example.org/x');
  });

  it('says what the rule is, in words a person typing a link can act on', () => {
    expect(LINK_RULE).toMatch(/ipfs:/);
    expect(LINK_RULE).toMatch(/javascript:/);
  });
});
