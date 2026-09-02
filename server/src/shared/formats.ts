/**
 * The formats most events run, offered as one-click suggestions the first time
 * an organiser opens the Formats section. Not an enum and not a default set:
 * nothing is created until someone picks it, an event may define none of these
 * and invent its own, and an unconference usually does.
 *
 * No lengths here, deliberately. A workshop is a workshop at ninety minutes or
 * at a whole afternoon; how long one runs is the session's business, and the
 * hints below describe the shape of the thing rather than its clock.
 */
export interface FormatSuggestion {
  name: string;
  /** Shown under the chip so the list explains itself to a first-time organiser. */
  hint: string;
}

export const SUGGESTED_FORMATS: readonly FormatSuggestion[] = [
  { name: 'Keynote', hint: 'One speaker, large room, sets the theme.' },
  { name: 'Talk', hint: 'The standard presentation plus questions.' },
  {
    name: 'Lightning talks',
    hint: 'Five minutes each, back to back. Ignite and Pecha Kucha are stricter variants.',
  },
  { name: 'Panel', hint: 'Three to five people and a moderator.' },
  {
    name: 'Fireside chat',
    hint: 'One guest, one interviewer, looser than a talk.',
  },
  {
    name: 'Workshop',
    hint: 'Hands-on and longer; participants bring laptops or materials.',
  },
  {
    name: 'Poster session',
    hint: 'Presenters stand by their work, attendees roam and ask.',
  },
  { name: 'Demo', hint: 'A short live walkthrough, often in a shared room.' },
  { name: 'Hackathon', hint: 'Collaborative building over hours or days.' },
  { name: 'Excursion', hint: 'A field trip or site visit, off the venue.' },
  { name: 'Walk & talk', hint: 'A conversation that happens outdoors.' },
  { name: 'Jam', hint: 'Open, unstructured, whoever turns up.' },
] as const;
