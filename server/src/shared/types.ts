/** API payload types shared by the server and the web client. */

export type Role = 'viewer' | 'user' | 'speaker' | 'admin';
export type SessionType = 'official' | 'open';
export type ContributionKind = 'note' | 'link' | 'question';

export interface Me {
  id: number;
  /** The name you are offered when entering a new event. Inside an event the
   *  name that counts is `BundleDto.displayName`. */
  displayName: string;
  /** Role held per event slug. Absent slug = no access. */
  roles: Record<string, Role>;
  /** Public-demo instance. Only labels the build as a demo — it does **not**
   *  mean this event's gate is open; see `demoEventSlugs`. */
  demoMode: boolean;
  /** The events whose gate offers roles as buttons instead of asking for a
   *  password. Everything else on a demo instance is a real event with real
   *  passwords. Empty unless the instance is in demo mode. */
  demoEventSlugs: string[];
}

/** A short-lived phrase that lets another device adopt this identity. */
export interface LinkCodeDto {
  phrase: string;
  expiresAt: string;
}

/**
 * Passwords the server invented for roles the creator left blank. Returned
 * once, on creation: they are stored hashed and cannot be read back later.
 */
export interface GeneratedPasswords {
  viewerPassword?: string;
  userPassword?: string;
  adminPassword?: string;
}

export interface EventSummary {
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  archived: boolean;
}

export interface EventDto extends EventSummary {
  id: number;
  timezone: string;
  dayStartMin: number;
  /** Longest event that still shows one flat strip of day tabs; above it the
   *  days split into a rail of weeks. */
  weekRailFrom: number;
  dayEndMin: number;
  /** What this event calls its middle role, e.g. "attendee". */
  userRoleLabel: string;
  /** How many audit entries this event keeps; 0 keeps everything. */
  auditKeep: number;
}

export interface RoomDto {
  id: number;
  name: string;
  description: string;
  capacity: number | null;
  /** Hex, from the ROOM_COLORS palette by default but free-form. */
  color: string;
  /** Attendees may schedule their own sessions in this room. */
  openBooking: boolean;
  sortOrder: number;
}

export interface TagDto {
  id: number;
  name: string;
  color: string;
}

export interface PersonLink {
  label: string;
  url: string;
}

export interface PersonDto {
  id: number;
  name: string;
  bio: string;
  links: PersonLink[];
  /** True when this profile belongs to the requesting identity. */
  isMine: boolean;
  /** True when some attendee owns it, so only they and organisers may edit. */
  claimed: boolean;
  updatedAt: string;
}

export interface PersonDetailDto {
  person: PersonDto;
  sessions: SessionDto[];
}

export interface SessionDto {
  id: number;
  roomId: number;
  /** null when the event has no tracks, or the session is not on one. */
  trackId: number | null;
  type: SessionType;
  title: string;
  description: string;
  /** Resolved from the linked person; empty when the session has no speaker. */
  speaker: string;
  speakerId: number | null;
  /** Watch-along link, http(s). Empty string means there is no stream, which
   *  is the default — the UI hides the field rather than showing it blank. */
  livestreamUrl: string;
  /** UTC ISO-8601. */
  startsAt: string;
  endsAt: string;
  tagIds: number[];
  createdBy: number;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContributionDto {
  id: number;
  sessionId: number;
  kind: ContributionKind;
  body: string;
  url: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  hidden: boolean;
}

export interface ProposalDto {
  id: number;
  title: string;
  description: string;
  speaker: string;
  speakerId: number | null;
  tagIds: number[];
  createdBy: number;
  createdByName: string;
  /** Set once an organiser has placed it on the grid. */
  placedSessionId: number | null;
  /** How many people said they would come. */
  interestCount: number;
  /** Whether the requesting identity is one of them. */
  interested: boolean;
  /** Mímir add-on: decision phase of the pitch. Everything starts as 'concern'. */
  phase: ProposalPhase;
  createdAt: string;
  updatedAt: string;
}

/** Mímir add-on: the decision phases a pitch moves through. */
export type ProposalPhase = 'concern' | 'inquiry' | 'proposal' | 'decision';

/** A thematic strand across rooms and days. One per session at most, because
 *  the schedule can lay tracks out as its columns. */
export interface TrackDto {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
}

export interface BundleDto {
  event: EventDto;
  role: Role;
  /** What you go by inside this event. Names are unique per event, not
   *  globally, so this is not necessarily `Me.displayName`. */
  displayName: string;
  rooms: RoomDto[];
  tags: TagDto[];
  /** Empty unless the organiser has defined any. */
  tracks: TrackDto[];
  sessions: SessionDto[];
  people: PersonDto[];
  /** Pitches waiting for a slot, plus those already placed. */
  proposals: ProposalDto[];
  /** Sessions this identity has starred for their personal agenda. */
  starredSessionIds: number[];
  /** sessionId -> how many people starred it. An interest signal for
   *  organisers deciding which room a session deserves. */
  starCounts: Record<number, number>;
  /** sessionId -> count of visible contributions. */
  contributionCounts: Record<number, number>;
  /** capability -> roles allowed to use it. Admin is always present. */
  permissions: Record<string, Role[]>;
}

/**
 * The per-event JSON export (`GET /api/e/:slug/export.json`). Its own shape
 * rather than a bag of DTOs: a DTO answers "what does this viewer see now"
 * and changes whenever the UI does, while this is an archive format that has
 * to keep opening in five years. `version` moves when the shape does.
 *
 * Carries no secrets by construction — see `exportEvent` for the list.
 */
export interface EventExport {
  format: 'libresesh.event';
  version: 1;
  exportedAt: string;
  event: {
    slug: string;
    name: string;
    timezone: string;
    startDate: string;
    endDate: string;
    dayStartMin: number;
    dayEndMin: number;
    weekRailFrom: number;
    userRoleLabel: string;
    archived: boolean;
    createdAt: string;
  };
  rooms: {
    id: number;
    name: string;
    description: string;
    capacity: number | null;
    color: string;
    openBooking: boolean;
    sortOrder: number;
  }[];
  tracks: { id: number; name: string; color: string; sortOrder: number }[];
  tags: { id: number; name: string; color: string }[];
  people: {
    id: number;
    name: string;
    bio: string;
    links: PersonLink[];
    /** Whether someone holds this profile — never *who*. */
    claimed: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
  sessions: {
    id: number;
    roomId: number;
    trackId: number | null;
    type: SessionType;
    title: string;
    description: string;
    speakerId: number | null;
    speaker: string;
    livestreamUrl: string;
    startsAt: string;
    endsAt: string;
    tagIds: number[];
    createdByName: string;
    createdAt: string;
    updatedAt: string;
    starCount: number;
  }[];
  proposals: {
    id: number;
    title: string;
    description: string;
    speakerId: number | null;
    speaker: string;
    tagIds: number[];
    placedSessionId: number | null;
    createdByName: string;
    createdAt: string;
    updatedAt: string;
    interestCount: number;
  }[];
  contributions: {
    id: number;
    sessionId: number;
    kind: ContributionKind;
    body: string;
    url: string | null;
    createdByName: string;
    createdAt: string;
    hidden: boolean;
  }[];
}

/**
 * One line of the append-only write log. `entityLabel` is the thing's name at
 * read time — resolved for the page being shown rather than stored, because
 * the log records *what happened*, not what things were called then.
 */
export interface AuditEntryDto {
  id: number;
  at: string;
  /** The actor's display name in this event. Empty if the row has no actor. */
  actorName: string;
  action: string;
  entity: string;
  entityId: number | null;
  /** Title or name, when it could still be looked up; otherwise empty. */
  entityLabel: string;
}

export interface AuditPageDto {
  entries: AuditEntryDto[];
  /** Pass back as `?before=` for the next page. Null at the end of the log. */
  nextCursor: number | null;
}

export interface SessionDetailDto {
  session: SessionDto;
  contributions: ContributionDto[];
}

/** SSE payloads (SPEC §6). */
export type ChangeType =
  | 'session.created'
  | 'session.updated'
  | 'session.deleted'
  | 'contribution.created'
  | 'contribution.deleted'
  | 'contribution.hidden'
  | 'room.created'
  | 'room.updated'
  | 'room.deleted'
  | 'tag.created'
  | 'tag.updated'
  | 'tag.deleted'
  | 'track.created'
  | 'track.updated'
  | 'track.deleted'
  | 'proposal.created'
  | 'proposal.updated'
  | 'proposal.deleted'
  | 'person.created'
  | 'person.updated'
  | 'person.deleted'
  | 'event.updated'
  | 'permissions.updated';

export interface ChangeEvent {
  type: ChangeType;
  /** Full fresh entity, or `{ id }` for deletes. */
  entity: unknown;
}

export interface ApiError {
  error: { code: string; message: string };
}
