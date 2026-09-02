/**
 * The formats most events run, offered as one-click suggestions the first time
 * an organiser opens the Formats section. Not an enum and not a default set:
 * nothing is created until someone picks it, an event may define none of these
 * and invent its own, and an unconference usually does.
 *
 * `defaultMin` is what the session form prefills when the format is picked on
 * a new session. Absent where the format says nothing useful about length — a
 * site visit is however long the site visit is.
 */
export interface FormatSuggestion {
  name: string;
  defaultMin?: number;
  /** Shown under the chip so the list explains itself to a first-time organiser. */
  hint: string;
}

export const SUGGESTED_FORMATS: readonly FormatSuggestion[] = [
  { name: 'Keynote', defaultMin: 60, hint: 'One speaker, large room, sets the theme.' },
  { name: 'Talk', defaultMin: 30, hint: 'The standard presentation plus questions.' },
  {
    name: 'Lightning talks',
    defaultMin: 60,
    hint: 'Five minutes each, back to back. Ignite and Pecha Kucha are stricter variants.',
  },
  { name: 'Panel', defaultMin: 60, hint: 'Three to five people and a moderator.' },
  {
    name: 'Fireside chat',
    defaultMin: 45,
    hint: 'One guest, one interviewer, looser than a talk.',
  },
  {
    name: 'Workshop',
    defaultMin: 120,
    hint: 'Hands-on and longer; participants bring laptops or materials.',
  },
  {
    name: 'Poster session',
    defaultMin: 90,
    hint: 'Presenters stand by their work, attendees roam and ask.',
  },
  { name: 'Demo', defaultMin: 20, hint: 'A short live walkthrough, often in a shared room.' },
  { name: 'Hackathon', hint: 'Collaborative building over hours or days.' },
  { name: 'Excursion', hint: 'A field trip or site visit, off the venue.' },
  { name: 'Walk & talk', defaultMin: 60, hint: 'A conversation that happens outdoors.' },
  { name: 'Jam', defaultMin: 90, hint: 'Open, unstructured, whoever turns up.' },
] as const;
