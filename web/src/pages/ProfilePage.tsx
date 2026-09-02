import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { PersonDetailDto, PersonDto, PersonLink } from '@shared/types';
import { ApiError, api, type PersonWrite } from '../lib/api';
import { dayLabel, fmtMin, place, rowId, todayInZone } from '../lib/format';
import { renderMarkdown } from '../lib/markdown';
import { useEventData } from '../lib/useEventData';
import { EditIcon } from '../components/icons';
import {
  EmptyState,
  Field,
  FormError,
  FormStack,
  IconButton,
  Modal,
  PrimaryButton,
  SecondaryButton,
  Spinner,
  inputClass,
  useToast,
} from '../components/ui';

type Status = 'loading' | 'ok' | 'notfound' | 'error';

/** Which field is open. One at a time on purpose: each save is its own request,
 *  and two fields in flight at once is how a profile ends up saving half of
 *  what you wrote. */
type FieldKey = 'displayName' | 'name' | 'bio' | 'links';

// Same wrappers DetailSheet uses for session descriptions.
const PROSE =
  'prose-sm text-sm leading-relaxed text-stone-700 dark:text-stone-300 [&_a]:text-blue-700 dark:[&_a]:text-blue-400 [&_a]:underline [&_code]:rounded [&_code]:bg-stone-100 dark:[&_code]:bg-stone-800 [&_code]:px-1 [&_li]:ml-4 [&_li]:list-disc [&_p]:mb-2';

/** A speaker or host profile with their sessions (follow-up to SPEC §4). */
export function ProfilePage() {
  const { slug = '', personId = '' } = useParams();
  const id = Number(personId);
  const navigate = useNavigate();
  // The bundle gives us the viewer's role, the timezone and live edits.
  const data = useEventData(slug);

  const [detail, setDetail] = useState<PersonDetailDto | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<FieldKey | null>(null);
  const [merging, setMerging] = useState(false);
  // Drafts live here rather than in each field so an open editor keeps what you
  // typed while the bundle refreshes underneath it.
  const [draftDisplayName, setDraftDisplayName] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftBio, setDraftBio] = useState('');
  const [draftLinks, setDraftLinks] = useState<PersonLink[]>([]);

  useEffect(() => {
    let live = true;
    setStatus('loading');
    api
      .person(slug, id)
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setStatus('ok');
      })
      .catch((err: unknown) => {
        if (!live) return;
        if (err instanceof ApiError && err.status === 401) {
          navigate(`/e/${slug}`, { replace: true });
        } else if (err instanceof ApiError && err.status === 404) {
          setStatus('notfound');
        } else {
          setError((err as Error).message);
          setStatus('error');
        }
      });
    return () => {
      live = false;
    };
  }, [slug, id, navigate]);

  const bundle = data.bundle;
  const timezone = bundle?.event.timezone ?? 'UTC';
  const today = todayInZone(timezone);

  // Prefer the live bundle copy so SSE edits show without a refetch.
  const person: PersonDto | null =
    bundle?.people.find((p) => p.id === id) ?? detail?.person ?? null;

  const sessions = useMemo(() => {
    if (bundle) {
      return bundle.sessions
        .filter((s) => s.speakers.some((p) => p.id === id))
        .slice()
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    }
    return detail?.sessions ?? [];
  }, [bundle, detail, id]);

  const bioHtml = useMemo(
    () => (person?.bio ? renderMarkdown(person.bio) : ''),
    [person?.bio],
  );

  const isAdmin = bundle?.role === 'admin';
  const canEdit = !!person && (person.isMine || isAdmin);

  if (status === 'loading') return <Spinner label="Loading profile…" />;
  if (status === 'notfound' || (status === 'ok' && !person)) {
    return (
      <EmptyState>
        No such profile.{' '}
        <Link to={`/e/${slug}`} className="underline">
          Back to the schedule
        </Link>
      </EmptyState>
    );
  }
  if (status === 'error' || !person) {
    return (
      <EmptyState>
        {error ?? 'Could not load this profile.'}
        <div className="mt-3">
          <Link to={`/e/${slug}`} className="underline">
            Back to the schedule
          </Link>
        </div>
      </EmptyState>
    );
  }

  const displayName = bundle?.displayName ?? '';
  // An organiser editing someone else's profile writes it through the admin
  // route; your own goes through /me/profile, which may still have to create it.
  const asAdmin = !!isAdmin && !person.isMine;
  const close = () => setOpen(null);

  /** Open one field, seeding its draft from what is on screen. Seeding here
   *  rather than at mount is what lets a field you never touched pick up an
   *  edit that arrived over SSE. */
  const edit = (key: FieldKey) => {
    if (key === 'displayName') setDraftDisplayName(displayName);
    if (key === 'name') setDraftName(person.name);
    if (key === 'bio') setDraftBio(person.bio);
    if (key === 'links') {
      setDraftLinks(person.links.length > 0 ? person.links : [{ label: '', url: '' }]);
    }
    setOpen(key);
  };

  /** One field, one PATCH carrying only that field. Both routes take a partial
   *  body, so saving a bio cannot quietly rewrite a name someone else changed
   *  while this page was open. */
  const savePerson = async (body: Partial<PersonWrite>) => {
    const updated = asAdmin
      ? await api.updatePerson(slug, person.id, body)
      : await api.updateMyProfile(slug, body);
    setDetail((d) => (d ? { ...d, person: updated } : d));
    data.apply({ type: 'person.updated', entity: updated });
  };

  const setLink = (i: number, patch: Partial<PersonLink>) =>
    setDraftLinks((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link to={`/e/${slug}`} className="text-xs text-stone-500 dark:text-stone-400 underline">
          ← Schedule
        </Link>

        <div className="mt-4 rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              {open === 'name' ? (
                <FieldForm
                  onClose={close}
                  onSave={async () => {
                    const wanted = draftName.trim();
                    if (!wanted) throw new Error('A profile needs a name.');
                    await savePerson({ name: wanted });
                  }}
                  hint={
                    person.isMine
                      ? 'Your full name — what sessions you give are credited to. Need not be unique.'
                      : 'Their full name — what sessions they give are credited to.'
                  }
                >
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    aria-label="Full name"
                    maxLength={120}
                    className={`${inputClass} text-lg font-semibold`}
                    autoFocus
                  />
                </FieldForm>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">
                    {person.name}
                  </h1>
                  {canEdit && (
                    <IconButton
                      aria-label="Edit full name"
                      title="Edit full name"
                      className="shrink-0"
                      onClick={() => edit('name')}
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </IconButton>
                  )}
                </div>
              )}
              {/* Profile names are checked for clashes but are not the thing
                  that identifies anyone — this id is, and it is the one in the
                  address bar. Per event on purpose: a number that followed a
                  person between events would tie their names together, which
                  is exactly what per-event names exist to avoid. */}
              <p className="mt-0.5 font-mono text-xs text-stone-400 dark:text-stone-500">
                ({rowId(person.id)})
              </p>
            </div>
            {isAdmin && (
              <SecondaryButton className="shrink-0 py-1.5" onClick={() => setMerging(true)}>
                Merge…
              </SecondaryButton>
            )}
          </div>

          <div className="mt-4 space-y-4 border-t border-stone-100 pt-4 dark:border-stone-800">
            {person.isMine && (
              /* Your display name is not part of this profile — it is your
                 identity in the event — so it saves through its own call, and
                 an organiser looking at your profile does not get to touch it. */
              <ProfileField
                label="Username"
                hint="How you appear in this event: the header chip, and anything you post. Unique here; not a login."
                canEdit
                filled={displayName !== ''}
                emptyText="You have no username in this event yet."
                addLabel="Set a username"
                editing={open === 'displayName'}
                onEdit={() => edit('displayName')}
                onClose={close}
                onSave={async () => {
                  const wanted = draftDisplayName.trim();
                  if (!wanted) throw new Error('A username cannot be empty.');
                  if (wanted === displayName) return;
                  await api.renameInEvent(slug, wanted);
                  await data.reload();
                }}
                editor={
                  <input
                    value={draftDisplayName}
                    onChange={(e) => setDraftDisplayName(e.target.value)}
                    aria-label="Username"
                    maxLength={40}
                    className={inputClass}
                    autoFocus
                  />
                }
              >
                <p className="text-sm">{displayName}</p>
              </ProfileField>
            )}

            <ProfileField
              label="Bio"
              canEdit={canEdit}
              filled={person.bio.trim() !== ''}
              emptyText={person.isMine ? 'Nothing about you yet.' : 'No bio yet.'}
              addLabel="Add a bio"
              editing={open === 'bio'}
              onEdit={() => edit('bio')}
              onClose={close}
              onSave={() => savePerson({ bio: draftBio.trim() })}
              editHint="Markdown is supported."
              editor={
                <textarea
                  value={draftBio}
                  onChange={(e) => setDraftBio(e.target.value)}
                  aria-label="Bio"
                  rows={5}
                  maxLength={2000}
                  className={`${inputClass} resize-none`}
                  autoFocus
                />
              }
            >
              <div
                className={PROSE}
                // Markdown is escaped before parsing, so no author markup survives.
                dangerouslySetInnerHTML={{ __html: bioHtml }}
              />
            </ProfileField>

            <ProfileField
              label="Links"
              canEdit={canEdit}
              filled={person.links.length > 0}
              emptyText="No links yet."
              addLabel="Add a link"
              editing={open === 'links'}
              onEdit={() => edit('links')}
              onClose={close}
              onSave={async () => {
                // A row left blank is a row you added and changed your mind
                // about; a half-filled one is a mistake worth saying out loud,
                // because the server would only ever see it as missing.
                const kept = draftLinks.filter(
                  (l) => l.label.trim() !== '' || l.url.trim() !== '',
                );
                if (kept.some((l) => l.label.trim() === '' || l.url.trim() === '')) {
                  throw new Error('Every link needs both a label and an address.');
                }
                await savePerson({
                  links: kept.map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
                });
              }}
              editor={
                <div className="space-y-2">
                  {draftLinks.map((link, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={link.label}
                        onChange={(e) => setLink(i, { label: e.target.value })}
                        placeholder="Label"
                        aria-label={`Link ${i + 1} label`}
                        maxLength={60}
                        className={`${inputClass} w-1/3`}
                        autoFocus={i === 0}
                      />
                      <input
                        value={link.url}
                        onChange={(e) => setLink(i, { url: e.target.value })}
                        placeholder="https://…"
                        aria-label={`Link ${i + 1} address`}
                        inputMode="url"
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setDraftLinks((ls) => ls.filter((_, idx) => idx !== i))}
                        aria-label={`Remove link ${i + 1}`}
                        className="shrink-0 rounded-lg px-2 text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {draftLinks.length < 10 && (
                    <button
                      type="button"
                      onClick={() => setDraftLinks((ls) => [...ls, { label: '', url: '' }])}
                      className="text-xs font-medium text-stone-600 dark:text-stone-300 underline hover:text-stone-900 dark:hover:text-stone-100"
                    >
                      Add another link
                    </button>
                  )}
                </div>
              }
            >
              <ul className="space-y-1">
                {person.links.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-700 dark:text-blue-400 underline"
                    >
                      {link.label || link.url}
                    </a>
                  </li>
                ))}
              </ul>
            </ProfileField>
          </div>

          {isAdmin && (
            <SpeakerAccess
              slug={slug}
              person={person}
              onChanged={() => void data.reload()}
            />
          )}
        </div>

        <h2 className="mb-2 mt-6 text-sm font-semibold">Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-stone-400 dark:text-stone-500">
            {person.isMine
              ? 'You are not hosting anything yet.'
              : `${person.name} is not hosting anything yet.`}
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => {
              const { date, startMin, endMin } = place(session, timezone);
              const label = dayLabel(date, today);
              const room = bundle?.rooms.find((r) => r.id === session.roomId);
              return (
                <li key={session.id}>
                  <Link
                    to={`/e/${slug}/s/${session.id}`}
                    className="block rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 shadow-sm hover:shadow"
                  >
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      {label.top} {label.sub} · {fmtMin(startMin)}–{fmtMin(endMin)} ·{' '}
                      {room?.name ?? 'unknown room'}
                    </div>
                    <div className="text-sm font-medium">{session.title}</div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {merging && bundle && (
        <MergeModal
          slug={slug}
          survivor={person}
          people={bundle.people}
          onClose={() => setMerging(false)}
          onMerged={(updated, loserId) => {
            setDetail((d) => (d ? { ...d, person: updated } : d));
            data.apply({ type: 'person.deleted', entity: { id: loserId } });
            data.apply({ type: 'person.updated', entity: updated });
            void data.reload();
            setMerging(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * One line of a profile, read until you open that one line.
 *
 * There is no page-wide edit mode, and that is what makes an empty profile
 * legible: the bio you have not written can say so *where the bio goes*, with
 * the way to write it right there, instead of being an absence you would only
 * find by opening a dialog that edits everything at once. Each field also
 * saves alone, so a slow-typed bio is not holding a name hostage.
 *
 * Empty *and* not yours to fill is the one case that draws nothing — a
 * stranger reading a sparse profile should see a name and what there is, not a
 * column of blanks.
 */
function ProfileField({
  label,
  hint,
  editHint,
  canEdit,
  filled,
  emptyText,
  addLabel,
  editing,
  onEdit,
  onClose,
  onSave,
  editor,
  children,
}: {
  label: string;
  /** Shown at rest as well as in the editor — for a field whose meaning is not
   *  in its name. */
  hint?: string;
  /** Shown only while editing, for what you need while typing and never after. */
  editHint?: string;
  canEdit: boolean;
  /** Whether there is anything to read. Blank-but-present counts as empty. */
  filled: boolean;
  emptyText: string;
  addLabel: string;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  /** Rejecting keeps the editor open, with the message under the control. */
  onSave: () => Promise<void>;
  editor: ReactNode;
  /** The read view. Only rendered when `filled`. */
  children: ReactNode;
}) {
  if (!editing && !filled && !canEdit) return null;

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-xs font-medium text-stone-600 dark:text-stone-300">{label}</span>
        {!editing && filled && canEdit && (
          <IconButton
            aria-label={`Edit ${label.toLowerCase()}`}
            title={`Edit ${label.toLowerCase()}`}
            onClick={onEdit}
          >
            <EditIcon className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>
      {editing ? (
        <FieldForm onClose={onClose} onSave={onSave} hint={editHint ?? hint}>
          {editor}
        </FieldForm>
      ) : filled ? (
        <>
          {children}
          {hint && <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">{hint}</p>}
        </>
      ) : (
        /* The empty state is the field, not a gap where one would be: what is
           missing, named, with the button that fills it on the same line. */
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-stone-400 dark:text-stone-500">{emptyText}</p>
          {canEdit && (
            <SecondaryButton className="py-1" onClick={onEdit}>
              {addLabel}
            </SecondaryButton>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The editor half of a field: the control, its own Save and Cancel, and the
 * error its own save came back with. Shared so every field fails the same way
 * — inline, under the control, with what you typed still in it — rather than
 * as a toast that takes the message somewhere else on the page.
 */
function FieldForm({
  onSave,
  onClose,
  hint,
  children,
}: {
  onSave: () => Promise<void>;
  onClose: () => void;
  hint?: string;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      // Escape leaves the field, not the page. It stops here so a field inside
      // a dialog does not close the dialog along with itself.
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        e.stopPropagation();
        onClose();
      }}
    >
      {children}
      {hint && <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">{hint}</p>}
      {error && <FormError className="mt-2">{error}</FormError>}
      <div className="mt-2 flex gap-2">
        <PrimaryButton type="submit" className="py-1.5" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </PrimaryButton>
        <SecondaryButton className="py-1.5" onClick={onClose} disabled={busy}>
          Cancel
        </SecondaryButton>
      </div>
    </form>
  );
}

/**
 * Fold a duplicate profile into this one (identity spec, B2). The duplicate's
 * sessions and pitches move here, then it disappears — there is no undo, which
 * is why the sentence spells out the direction before the button.
 */
function MergeModal({
  slug,
  survivor,
  people,
  onClose,
  onMerged,
}: {
  slug: string;
  survivor: PersonDto;
  people: PersonDto[];
  onClose: () => void;
  onMerged: (updated: PersonDto, loserId: number) => void;
}) {
  const toast = useToast();
  const [fromId, setFromId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const candidates = people.filter((p) => p.id !== survivor.id);

  const merge = async () => {
    if (fromId === null || busy) return;
    setBusy(true);
    try {
      const updated = await api.mergePerson(slug, survivor.id, fromId);
      onMerged(updated, fromId);
    } catch (err) {
      toast.show((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Merge a duplicate"
      description={
        <>
          The profile you pick is folded into{' '}
          <span className="font-medium">{survivor.name}</span>: its sessions and pitches move
          here, then it is removed. This cannot be undone.
        </>
      }
      onClose={onClose}
      onSubmit={() => void merge()}
      footer={
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton type="submit" disabled={busy || fromId === null}>
            {busy ? 'Merging…' : 'Merge'}
          </PrimaryButton>
        </>
      }
    >
      {candidates.length === 0 ? (
        <p className="text-sm text-stone-400 dark:text-stone-500">
          There is no other profile to merge.
        </p>
      ) : (
        <FormStack>
          <Field label="Duplicate to fold in">
            <select
              value={fromId === null ? '' : String(fromId)}
              onChange={(e) => setFromId(e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
            >
              <option value="">— pick a profile —</option>
              {candidates.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.claimed ? ' (claimed)' : ''}
                </option>
              ))}
            </select>
          </Field>
        </FormStack>
      )}
    </Modal>
  );
}

/**
 * Organiser-only: mint or revoke this person's speaker phrase. The phrase is
 * shown exactly once, at mint — the server keeps only a hash. Whoever types
 * it at any gate becomes this person with the speaker role, on any number of
 * devices, until it is revoked.
 */
function SpeakerAccess({
  slug,
  person,
  onChanged,
}: {
  slug: string;
  person: PersonDto;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [phrase, setPhrase] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const mint = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.mintSpeakerCode(slug, person.id);
      setPhrase(res.phrase);
      onChanged();
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.revokeSpeakerCode(slug, person.id);
      setPhrase(null);
      toast.show('Speaker phrase revoked');
    } catch (err) {
      toast.show((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-stone-100 pt-3 dark:border-stone-800">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-xs font-semibold text-stone-500 dark:text-stone-400">
          Speaker access
        </span>
        <SecondaryButton className="py-1 text-xs" onClick={() => void mint()} disabled={busy}>
          {phrase ? 'New phrase' : 'Generate phrase'}
        </SecondaryButton>
        <SecondaryButton className="py-1 text-xs" onClick={() => void revoke()} disabled={busy}>
          Revoke
        </SecondaryButton>
      </div>
      {phrase ? (
        <>
          <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-center font-mono text-sm font-semibold dark:border-stone-700 dark:bg-stone-800">
            {phrase}
          </div>
          <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
            Shown once — give it to {person.name}. Typing it at the event gate signs them in as
            this profile with the speaker role, from any device, until you revoke it.
          </p>
        </>
      ) : (
        <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
          A phrase {person.name} can type at the gate to become this profile, with the speaker
          role. Generating a new one replaces the old.
        </p>
      )}
    </div>
  );
}
