import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AttendeeDto } from '@shared/types';
import { api } from '../lib/api';
import { relativeTime, uid } from '../lib/format';
import { EmptyState, RoleBadge, Section, Spinner, useToast } from '../components/ui';

/**
 * The other half of the People tab: not the speaker/host profiles, but every
 * identity that has ever entered the event — picked a name or been handed a
 * role. This is where an organiser matches a UID from the audit log to a
 * person, and where "how many people are actually in here?" gets answered.
 */
export function AdminAttendees({ slug, userLabel }: { slug: string; userLabel?: string }) {
  const toast = useToast();
  const [attendees, setAttendees] = useState<AttendeeDto[] | null>(null);

  useEffect(() => {
    api
      .attendees(slug)
      .then(setAttendees)
      .catch((err: Error) => {
        toast.show(err.message);
        setAttendees([]);
      });
    // toast is stable enough for a mount-only fetch; slug changes remount the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <Section
      title="Everyone who has joined"
      description="Everyone who has ever passed the gate, with the UID the audit log refers to. Reading the schedule requires entering, and entering records a name and a role — so everyone who can see this event is here. Signing out keeps the entry, minus the role."
    >
      {attendees === null ? (
        <Spinner label="Loading attendees…" />
      ) : attendees.length === 0 ? (
        <EmptyState>Nobody has entered this event yet.</EmptyState>
      ) : (
        <>
          <ul>
            {attendees.map((a) => (
              <li
                key={a.uid}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-stone-100 py-2 text-sm last:border-0 dark:border-stone-800"
              >
                <span className="min-w-32 font-medium">{a.name}</span>
                <span
                  title="Identity — the same at every event on this instance"
                  className="font-mono text-xs text-stone-400 dark:text-stone-500"
                >
                  ({uid(a.uid)})
                </span>
                {a.isMe && (
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600 dark:bg-stone-700 dark:text-stone-300">
                    you
                  </span>
                )}
                {a.role !== null && <RoleBadge role={a.role} userLabel={userLabel} />}
                {a.personId !== null && (
                  <Link
                    to={`/e/${slug}/p/${a.personId}`}
                    className="text-xs font-semibold text-stone-500 underline-offset-2 hover:underline dark:text-stone-400"
                  >
                    profile
                  </Link>
                )}
                <time
                  dateTime={a.lastSeenAt}
                  title={`Last seen ${new Date(a.lastSeenAt).toLocaleString()}`}
                  className="ml-auto shrink-0 text-xs text-stone-400 dark:text-stone-500"
                >
                  {relativeTime(a.lastSeenAt)}
                </time>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
            {attendees.length} {attendees.length === 1 ? 'person has' : 'people have'} entered this
            event. Times are when each was last seen anywhere on this instance.
          </p>
        </>
      )}
    </Section>
  );
}
