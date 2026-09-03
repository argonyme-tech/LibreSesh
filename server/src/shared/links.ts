/**
 * What may go in an `href`.
 *
 * The rule used to be an allow-list of two, http and https, which is safe and
 * too small: a session streamed over IPFS or Swarm, a talk pointing at a
 * magnet link, a room whose feed is an RTMP URL — all real, all refused. The
 * rule is now the other way round. Anything that parses as a URI is a link,
 * *except* the handful of schemes that do not fetch something so much as run
 * something on the reader's machine.
 *
 * A deny-list is the riskier shape in general, so this one is deliberately
 * wide, and it leans on the URL parser rather than on matching text. The
 * parser lowercases the scheme and strips leading control characters and
 * spaces, which is what defeats `JavaScript:` and ` javascript:` and the rest
 * of that family; a hand-rolled `startsWith` check does not.
 */
const NEVER_FOLLOWED = new Set([
  // Runs script in the reader's page. The whole reason this list exists.
  'javascript:',
  'vbscript:',
  // Carries its own payload, which can be a document with script in it.
  'data:',
  'blob:',
  'filesystem:',
  // Reaches for the reader's own machine, or the browser's own settings.
  'file:',
  'about:',
  'chrome:',
]);

/**
 * The link to put in an `href`, or null when it must not be followed.
 *
 * `base` is for markdown, where a relative link is a normal thing to write
 * and resolves against the page. Without one a link must carry its own
 * scheme, which is what stops `people.example.com` being read as a path.
 */
export function safeLink(raw: string, base?: string): string | null {
  try {
    const url = new URL(raw.trim(), base);
    return NEVER_FOLLOWED.has(url.protocol.toLowerCase()) ? null : url.href;
  } catch {
    return null;
  }
}

/** Said to whoever typed the link, not to a log. */
export const LINK_RULE =
  'A link needs a scheme it can be opened with — https:, ipfs:, bzz:, magnet: and the like — and cannot be a javascript: or data: link';
