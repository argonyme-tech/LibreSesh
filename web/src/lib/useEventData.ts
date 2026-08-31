import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type {
  BreakDto,
  BundleDto,
  ChangeEvent,
  ContributionDto,
  EventDto,
  PersonDto,
  RoomDto,
  SessionDto,
  TagDto,
  TrackDto,
} from '@shared/types';
import { ApiError, api } from './api';

type Status = 'loading' | 'gate' | 'ready' | 'error';

interface State {
  status: Status;
  bundle: BundleDto | null;
  /** Contributions for sessions whose detail has been opened. */
  contributions: Record<number, ContributionDto[]>;
  error: string | null;
  connected: boolean;
}

type Action =
  | { kind: 'loading' }
  | { kind: 'loaded'; bundle: BundleDto }
  | { kind: 'gate' }
  | { kind: 'error'; message: string }
  | { kind: 'connected'; connected: boolean }
  | { kind: 'contributions'; sessionId: number; items: ContributionDto[] }
  | { kind: 'setStarred'; sessionId: number; starred: boolean }
  | { kind: 'change'; change: ChangeEvent };

const initial: State = {
  status: 'loading',
  bundle: null,
  contributions: {},
  error: null,
  connected: false,
};

const upsert = <T extends { id: number }>(list: T[], item: T): T[] => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
};

/**
 * The bundle endpoint returns rooms by sort order and tags by name. Patching an
 * entity in place would quietly break that ordering — and room order *is* the
 * calendar's column order — so re-sort after every upsert.
 */
const byRoomOrder = (rooms: RoomDto[]): RoomDto[] =>
  rooms.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

const byTrackOrder = (tracks: TrackDto[]): TrackDto[] =>
  [...tracks].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

/** Same order the bundle uses: by clock, every-day rows before pinned ones. */
const byBreakTime = (breaks: BreakDto[]): BreakDto[] =>
  breaks
    .slice()
    .sort(
      (a, b) =>
        a.startMin - b.startMin ||
        Number(a.date !== null) - Number(b.date !== null) ||
        a.id - b.id,
    );

const byTagName = (tags: TagDto[]): TagDto[] =>
  tags.slice().sort((a, b) => a.name.localeCompare(b.name));

const byPersonName = (people: PersonDto[]): PersonDto[] =>
  people.slice().sort((a, b) => a.name.localeCompare(b.name));

const bumpCount = (counts: Record<number, number>, sessionId: number, by: number) => ({
  ...counts,
  [sessionId]: Math.max(0, (counts[sessionId] ?? 0) + by),
});

/** Apply one SSE change to the in-memory bundle. Every case is keyed by id, so
 *  replaying the same event twice is harmless. */
function applyChange(state: State, change: ChangeEvent): State {
  const bundle = state.bundle;
  if (!bundle) return state;
  const isAdmin = bundle.role === 'admin';

  switch (change.type) {
    case 'session.created':
    case 'session.updated': {
      const session = change.entity as SessionDto;
      return { ...state, bundle: { ...bundle, sessions: upsert(bundle.sessions, session) } };
    }
    case 'session.deleted': {
      const { id } = change.entity as { id: number };
      const { [id]: _dropped, ...contributions } = state.contributions;
      return {
        ...state,
        contributions,
        bundle: { ...bundle, sessions: bundle.sessions.filter((s) => s.id !== id) },
      };
    }
    case 'contribution.created': {
      const item = change.entity as ContributionDto;
      const loaded = state.contributions[item.sessionId];
      return {
        ...state,
        contributions: loaded
          ? { ...state.contributions, [item.sessionId]: upsert(loaded, item) }
          : state.contributions,
        bundle: {
          ...bundle,
          contributionCounts: bumpCount(bundle.contributionCounts, item.sessionId, 1),
        },
      };
    }
    case 'contribution.deleted': {
      const { id, sessionId } = change.entity as { id: number; sessionId: number };
      const loaded = state.contributions[sessionId];
      return {
        ...state,
        contributions: loaded
          ? { ...state.contributions, [sessionId]: loaded.filter((c) => c.id !== id) }
          : state.contributions,
        bundle: {
          ...bundle,
          contributionCounts: bumpCount(bundle.contributionCounts, sessionId, -1),
        },
      };
    }
    case 'contribution.hidden': {
      const item = change.entity as ContributionDto;
      const loaded = state.contributions[item.sessionId];
      if (!loaded) return state;
      // Non-admins lose sight of a hidden contribution entirely.
      const next =
        item.hidden && !isAdmin
          ? loaded.filter((c) => c.id !== item.id)
          : upsert(loaded, item);
      return {
        ...state,
        contributions: { ...state.contributions, [item.sessionId]: next },
        bundle: {
          ...bundle,
          contributionCounts: isAdmin
            ? bundle.contributionCounts
            : bumpCount(bundle.contributionCounts, item.sessionId, item.hidden ? -1 : 1),
        },
      };
    }
    case 'room.created':
    case 'room.updated':
      return {
        ...state,
        bundle: {
          ...bundle,
          rooms: byRoomOrder(upsert(bundle.rooms, change.entity as RoomDto)),
        },
      };
    case 'room.deleted': {
      const { id } = change.entity as { id: number };
      return { ...state, bundle: { ...bundle, rooms: bundle.rooms.filter((r) => r.id !== id) } };
    }
    case 'tag.created':
    case 'tag.updated':
      return {
        ...state,
        bundle: { ...bundle, tags: byTagName(upsert(bundle.tags, change.entity as TagDto)) },
      };
    case 'tag.deleted': {
      const { id } = change.entity as { id: number };
      return {
        ...state,
        bundle: {
          ...bundle,
          tags: bundle.tags.filter((t) => t.id !== id),
          sessions: bundle.sessions.map((s) =>
            s.tagIds.includes(id) ? { ...s, tagIds: s.tagIds.filter((t) => t !== id) } : s,
          ),
        },
      };
    }
    case 'track.created':
    case 'track.updated':
      return {
        ...state,
        bundle: {
          ...bundle,
          tracks: byTrackOrder(upsert(bundle.tracks, change.entity as TrackDto)),
        },
      };
    case 'track.deleted': {
      const { id } = change.entity as { id: number };
      // The server clears the track from its sessions in the same write, so
      // the bundle has to do the same or a column lingers with nothing in it.
      return {
        ...state,
        bundle: {
          ...bundle,
          tracks: bundle.tracks.filter((t) => t.id !== id),
          sessions: bundle.sessions.map((s) => (s.trackId === id ? { ...s, trackId: null } : s)),
        },
      };
    }
    case 'break.created':
    case 'break.updated':
      return {
        ...state,
        bundle: {
          ...bundle,
          breaks: byBreakTime(upsert(bundle.breaks, change.entity as BreakDto)),
        },
      };
    case 'break.deleted': {
      const { id } = change.entity as { id: number };
      return { ...state, bundle: { ...bundle, breaks: bundle.breaks.filter((b) => b.id !== id) } };
    }
    case 'person.created':
    case 'person.updated':
      return {
        ...state,
        bundle: { ...bundle, people: byPersonName(upsert(bundle.people, change.entity as PersonDto)) },
      };
    case 'person.deleted': {
      const { id } = change.entity as { id: number };
      return {
        ...state,
        bundle: {
          ...bundle,
          people: bundle.people.filter((p) => p.id !== id),
          // The server detaches the person's sessions; mirror that so a stale
          // speaker name never lingers on the grid.
          sessions: bundle.sessions.map((s) =>
            s.speakerId === id ? { ...s, speakerId: null, speaker: '' } : s,
          ),
        },
      };
    }
    case 'event.updated':
      return { ...state, bundle: { ...bundle, event: change.entity as EventDto } };
    case 'permissions.updated':
      return {
        ...state,
        bundle: { ...bundle, permissions: change.entity as BundleDto['permissions'] },
      };
    default:
      return state;
  }
}

function reducer(state: State, action: Action): State {
  switch (action.kind) {
    case 'loading':
      return { ...state, status: state.bundle ? state.status : 'loading', error: null };
    case 'loaded':
      return { ...state, status: 'ready', bundle: action.bundle, error: null };
    case 'gate':
      return { ...state, status: 'gate', bundle: null, error: null };
    case 'error':
      return { ...state, status: state.bundle ? 'ready' : 'error', error: action.message };
    case 'connected':
      return { ...state, connected: action.connected };
    case 'contributions':
      return {
        ...state,
        contributions: { ...state.contributions, [action.sessionId]: action.items },
      };
    // Stars are private, so there is no server change event — local state is the
    // source of truth and callers flip it optimistically.
    case 'setStarred': {
      if (!state.bundle) return state;
      const has = state.bundle.starredSessionIds.includes(action.sessionId);
      if (has === action.starred) return state;
      return {
        ...state,
        bundle: {
          ...state.bundle,
          starredSessionIds: action.starred
            ? [...state.bundle.starredSessionIds, action.sessionId]
            : state.bundle.starredSessionIds.filter((id) => id !== action.sessionId),
        },
      };
    }
    case 'change':
      return applyChange(state, action.change);
    default:
      return state;
  }
}

export interface EventData extends State {
  reload: () => Promise<void>;
  loadContributions: (sessionId: number) => Promise<void>;
  apply: (change: ChangeEvent) => void;
  /** Optimistically set a session's starred state in local bundle state. */
  setStarred: (sessionId: number, starred: boolean) => void;
}

/**
 * Loads an event's bundle and keeps it fresh from the SSE stream. On a stream
 * reconnect the whole bundle is refetched — cheap, and simpler than replaying
 * missed events (SPEC §6).
 */
export function useEventData(slug: string): EventData {
  const [state, dispatch] = useReducer(reducer, initial);
  const hadError = useRef(false);

  const reload = useCallback(async () => {
    dispatch({ kind: 'loading' });
    try {
      dispatch({ kind: 'loaded', bundle: await api.bundle(slug) });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) dispatch({ kind: 'gate' });
      else dispatch({ kind: 'error', message: (err as Error).message });
    }
  }, [slug]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const source = new EventSource(`/api/e/${encodeURIComponent(slug)}/stream`);

    source.addEventListener('open', () => {
      dispatch({ kind: 'connected', connected: true });
      if (hadError.current) {
        hadError.current = false;
        void reload();
      }
    });
    source.addEventListener('change', (ev) => {
      dispatch({ kind: 'change', change: JSON.parse((ev as MessageEvent<string>).data) });
    });
    source.addEventListener('error', () => {
      hadError.current = true;
      dispatch({ kind: 'connected', connected: false });
    });

    return () => source.close();
    // Re-subscribing on every bundle change would thrash the stream; the status
    // transition into `ready` is the only trigger that matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, state.status === 'ready', reload]);

  const loadContributions = useCallback(
    async (sessionId: number) => {
      try {
        const detail = await api.session(slug, sessionId);
        dispatch({ kind: 'contributions', sessionId, items: detail.contributions });
        dispatch({ kind: 'change', change: { type: 'session.updated', entity: detail.session } });
      } catch (err) {
        dispatch({ kind: 'error', message: (err as Error).message });
      }
    },
    [slug],
  );

  const apply = useCallback((change: ChangeEvent) => dispatch({ kind: 'change', change }), []);

  const setStarred = useCallback(
    (sessionId: number, starred: boolean) =>
      dispatch({ kind: 'setStarred', sessionId, starred }),
    [],
  );

  return useMemo(
    () => ({ ...state, reload, loadContributions, apply, setStarred }),
    [state, reload, loadContributions, apply, setStarred],
  );
}
