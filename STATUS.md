# Project Status

The shared queue: what is in flight, what is blocked, and what is planned.
Shipped work moves to [CHANGELOG.md](CHANGELOG.md) and is not repeated here.

Last updated: 2026-08-31

## In Progress

Working directly on `main`. 0.2.0 was tagged 2026-08-30; what shipped is in
CHANGELOG.md under `[0.2.0]`, and what has landed since is under
`[Unreleased]`. What is left of the UI-overhaul plan lives in
`_planning/plans/2026-08-29-ui-overhaul-permissions-pitches.md`:

- **Whole-app UI sweep.** The primitives landed and the admin page is done.
  21 underline usages remain across ProfilePage (5), SchedulePage (4),
  ProposalBoard (4), DetailSheet (4), EventListPage (1), NewEventPage (1),
  Tour (1) and Gate (1, the "already here on another device" link added with
  device linking). The count excludes the `[&_a]:underline` in prose wrappers —
  links inside rendered markdown keep their underline deliberately — and the
  five in `ui.tsx`, which are the primitives themselves. Re-counted 2026-08-31
  after the Backup and Audit tabs and the gate's name-collision link: still 21,
  because all three use the primitives (`secondaryButtonClass`, `linkClass`)
  rather than a bare `underline`.
- **ARCHITECTURE.md concurrency paragraph.** §Realtime documents broadcast and
  heartbeats but never states the model: last-write-wins, `assertNotStale`
  409 on an `updated_at` mismatch, no CRDT by design.

## Blockers

_None._ The identity design question that sat here is decided and shipped —
see `_planning/specs/identity-and-people.md` §Decisions for the reasoning and
CHANGELOG `[Unreleased]` for what landed.

---

# Backlog

_The only queue of future work, priority-ordered. Top High-Priority item = next up._

## High Priority

- **The drop still flickers, and the fix so far only made it smaller.**
  Reported 2026-08-31, after the two fixes in CHANGELOG `[Unreleased]` landed
  (`461e7ab`, `9b95de7`): a dragged block and a permission switch still show a
  visible pop, "just maybe a bit less glitchy". What is already ruled out is
  the double-application — the drop hold is absolute now, so the server's echo
  of our own write cannot move the block a second time. What is left is
  unidentified, and it needs eyes on a real browser: neither dev container nor
  the test suite has a DOM, so `drawnAt` and `overlay` are tested as pure
  functions and the actual paint is not.

  Leading suspect for the grid, not yet confirmed: **lane re-layout.**
  `drawnAt` overrides a block's `startMin`, `durMin` and `columnIndex`, but not
  its lane — `laneLayout` recomputes from `placed`, which follows the echoed
  row, so `lane.lane` and `lane.lanes` can change while the block is still
  held, moving its `left` and `width` sideways mid-hold. That would be exactly
  one horizontal pop at echo time. If confirmed, the fix is the same shape as
  the last one: lay the grid out from the drawn positions rather than the raw
  rows, so a held block lanes against where it is drawn.

  Second suspect, cheaper to test: nothing on the block transitions position —
  the class list carries `transition-shadow` only — so every correction, however
  small and however correct, arrives as an instant jump. A short transform
  transition on `top`/`left` would make a legitimate re-layout read as movement
  instead of a glitch, and would also mask the tail of whatever the real cause
  turns out to be. Worth doing on its own merits; not a substitute for finding
  the cause.

  For the permissions matrix there is no remaining suspect on file. The
  optimistic overlay does move the switch on click, so if it still flicks, the
  next thing to establish is *which* of the three states is wrong and when —
  note that `busy !== null` disables every switch in the table during a save,
  and a disabled `Toggle` restyles, which is a visible change that is not a
  revert and could easily read as one.

- **Pitch board.** Always show the creator, default the creator as host, and
  split the board into hot/new. The plan is
  `_planning/plans/2026-08-29-ui-overhaul-permissions-pitches.md`, whose
  up/down-vote assumption is **withdrawn** (decided 2026-08-31): interest stays
  one-way, so no `proposal_votes` table, no migration, and `interestCount`
  keeps its name and its meaning in `EventExport`. The button already wears an
  up-arrow rather than a star, which was only ever about the glyph colliding
  with "on my agenda".

- **Instance-level audit rows have no screen — and no pruning.** A
  whole-database backup, an event created from the landing page, or any
  device-link mint/redeem/failure carries no `event_id`, so those rows are
  invisible in Manage Event → Audit, which is per-event by design. They are the
  instance owner's business and there is no instance admin page to put them on.
  Noticed 2026-08-31: `pruneAudit` deletes by `event_id`, so these rows also
  grow without limit — slowly (they are all rare actions), but forever.

- **The importer can repeat a session, but only into a new event, and only
  from curl.** `repeat: { until, days, except }` landed 2026-08-31, so a long
  programme's daily officials and fixed track hours are three rows rather than
  sixty. Two halves of the same job are still missing:
  - **Importing into an *existing* event.** The route only creates. There is no
    way to add twenty days to the event you are already running, which is the
    case that asked for repeats in the first place. Wants
    `POST /events/:slug/import`, gated on event admin rather than the instance
    key, matching rooms/tracks/tags to the existing ones by name instead of
    creating duplicates — same transaction and same `dryRun` as now.
  - **Any UI at all.** Both routes are curl-only, so "prepopulate my event"
    is currently a JSON file and a shell. The obvious front door is a
    *duplicate a day* action on the grid — pick a day, pick the days to copy it
    to — which is the same expansion `planSessions` already does, behind a
    button instead of a document.

  Two smaller things noticed alongside: `POST /events/:slug/clone` copies rooms
  and tags but **not tracks**, which post-date it and look simply forgotten;
  and a track carries no time of its own, so "Tech runs 14:00–16:00" is said by
  a repeating session rather than by the track. Track defaults in the import
  document would be cheap; `start_min`/`end_min` on the `tracks` table is the
  bigger version and changes what a track means in the session form, the grid
  and the filters — worth doing only to make the app *enforce* track hours.

- **Nothing imports an event *export*.** `POST /events/import` builds an event
  from a JSON schedule, but does not read `GET /export.json` back: an export is
  a record of ids, instants and authorship belonging to identities the target
  instance has never seen, and reading one back wants a new slug, fresh ids and
  a decision about those names. So the encrypted whole-DB backup is still the
  only restore path.

- **Compact button overrides do nothing.** `SecondaryButton className="py-1"`
  and the `py-1.5` variants in DetailSheet, ProfilePage, ProposalBoard and
  AdminPermissions are dead: Tailwind emits `.py-1` and `.py-1.5` *before* the
  primitives' `.py-2.5`, so the base always wins and those buttons are full
  height. Verified in the built CSS on 2026-08-31. Predates the button-height
  fix — that change kept the situation identical rather than creating it. Wants
  either a real `size` prop on the button primitives or `tailwind-merge`; a
  call site cannot win this with a class name.

- **The gate doesn't suggest device linking to a merged-out device.** After a
  both-claimed merge the losing device is signed out; when it next hits the
  gate, nothing says "if this is you, link this device instead of re-entering".
  A person who re-enters recreates the two-identity split the organiser just
  merged away. Wants one line on the gate (likely only when the arriving
  identity holds no role but does hold an event name here — exactly the
  signed-out shape). Scenario documented in ARCHITECTURE §Merging two people.

- **Number fields accept nonsense.** Room capacity is `type="number" min={0}`,
  which the browser enforces on the spinner but not on typing or paste; the
  client strips a minus sign and `parseCapacity` floors it, and the server
  takes whatever arrives. Same shape wherever a number is typed. Wants one
  validated numeric input primitive rather than a guard per field.

- **No write path under flaky connectivity.** Reads recover well — `EventSource`
  auto-reconnects and `useEventData` refetches the whole bundle on reopen, and
  the header shows "reconnecting…". Writes do not: every mutation is a bare
  `fetch` with no queue or retry, so a star/note/edit attempted while offline
  fails with a toast and is lost. There is also no service worker, so a cold
  load with no connectivity renders nothing. Full offline editing is an explicit
  v1 non-goal (SPEC §Non-goals — no CRDT), but a small outbox that retries
  queued writes on reconnect would cover the hallway-wifi case without one.

- **Dependency bumps — all need major upgrades, none currently exploitable here.**
  Assessed 2026-08-28:
  - `vitest` 2.x, _critical_ — only reachable when the Vitest **UI server** is
    listening. We never run `vitest --ui`. Fix is vitest@4 (breaking).
  - `vite` 5.x, _high_ — `server.fs.deny` bypass **on Windows**. Dev-only, and
    this project builds on Linux. Fix is vite@8 (breaking).
  - `esbuild` (via Vite), _moderate_ — any website can call the dev server and
    read the response. Worth knowing because our dev server binds `0.0.0.0`
    for the container; does not affect production, which serves static files.
  - `react-router-dom` 6.x, _moderate_ — the one advisory that ships. Open
    redirect via a backslash in `<Link>`/`useNavigate`; the companion SSR
    `deserializeErrors` issue does not apply (no SSR). Every navigation we
    build is prefixed with a literal `/e/`, so a path cannot start `//` or
    `\\`. Fix is react-router-dom@7 (breaking).
- **Cloning still demands all three passwords.** Creating an event lets you
  leave any of them blank — a four-word phrase is generated and shown once on
  a confirmation screen — but `POST /events/:slug/clone` kept the old
  all-required schema. Deliberate for now: the clone UI has nowhere to reveal
  a generated secret, and an organiser who never sees one cannot hand it out.
  Wants the same reveal screen, then `resolveEventPasswords` wired into the
  clone route so the two creation paths stop disagreeing.

- **Manual browser pass — now with a specific backlog.** Automated coverage is
  server-side, so everything below shipped on a read-through alone (no browser
  in this dev container, no component tests). Each wants a real look, ideally
  on a phone. From 2026-08-31:
  - **Manage Event is seven tabs now** (Programme / People / Permissions /
    Settings / Trash / Backup / Audit) with the choice in `?tab=`. Check the
    tab strip wraps sanely on a narrow screen, and that arrow-key navigation
    moves focus as a `tablist` should;
  - the **Audit** list: long names and long titles on one line, the filter box,
    "Load older entries" at the page boundary;
  - the **Backup** tab: the passphrase mismatch warning, and that the encrypted
    download actually saves with its `.lsbk` name from a real browser rather
    than supertest;
  - the gate's **"Enter as Ada 2"** link, which is only reachable by taking a
    name that is already held;
  - buttons are 38px tall now, matching the inputs beside them — worth one
    sweep for anything that looked balanced at 32px.

  From 2026-08-30:
  - the `Modal` rewrite — overlay scrolls, `dvh` cap — against the tallest
    modal there is, and the one it was reported on ("Link another device");
  - the schedule header on a narrow screen: theme now lives in the profile
    menu, Manage/Arrange/Add sit together and go icon-only below `sm`. Watch
    where the action row chooses to wrap;
  - the tour no longer auto-starting for an organiser, while "?" still opens
    it;
  - the drag, now-line and 360px checks that were already outstanding.
- **Deploy paths, and what is actually proven.** Railway builds from
  `deploy/Dockerfile` (`railway.json` pins the builder — Railway's Node
  autodetection runs a plain `npm ci`, which honours our `ignore-scripts=true`
  and so never builds better-sqlite3). Two failures found the hard way on
  2026-08-30, both now startup errors instead of silent damage:
  no volume attached, so a rebuild destroyed the event on it; then a
  root-owned volume the unprivileged app could not write, surfacing only as
  `SQLITE_CANTOPEN`. `server/src/preflight.ts` reports every misconfiguration
  at once, and `deploy/entrypoint.sh` chowns the volume before dropping to
  `node`.
  **Still unproven:** there is no `docker` in this dev container, so the
  entrypoint's _root_ branch and the `gosu` install have never executed — the
  next deploy is their first real run. `deploy/docker-compose.yml`, the Caddy
  front end and `deploy/backup.sh` have never been run at all; treat the first
  VPS deploy as their test. Railway notes: `_planning/deployment-guide.md` §10.
- **No component test coverage, and no error boundary.** 384 tests, and the
  only web-side ones (`format.test.ts`, `calendar.test.ts`) cover pure
  functions — there is no jsdom/testing-library stack, so nothing renders a
  component. The drag maths, the SSE reducer and the clash detection are the
  parts most likely to regress silently, and the Calendar column refactor on
  2026-08-30 went in on a read-through alone. The build-stamp crash the same
  day — a component that threw on every render, blanking the page, while the
  whole suite stayed green — is what the gap costs. A React error boundary
  would have contained it; there is still none.

## Low Priority / Ideas

- **A real series, and a root event other events inherit from.** Deferred
  2026-08-31, deliberately and not for want of time. `repeat` expands to
  ordinary rows precisely because the event it was built for is one whose
  sessions *drift* — the planned 14:00 becomes 14:20 on the day, and a series
  that asked "does moving Tuesday move all of them?" would be answering the
  wrong question every single time. So the shipped design is right for this
  event, and the two ideas below are right for a different one, where a
  programme is planned centrally and holds:
  - **A series.** A repeat that persists, so editing the rule re-times every
    day at once. Wants a `session_series` table, a decision about what an edit
    to one occurrence means (detach? fork the rule?), and the grid to say which
    sessions are governed rather than free — none of which is worth carrying
    for an event that overrides its own plan daily.
  - **Events inheriting from a root.** A recurring meetup or a multi-city
    conference where the rooms, tracks, tags and the shape of a day are
    declared once and each instance overrides what differs. Today the closest
    thing is `POST /events/:slug/clone`, which is a copy and forgets its
    parent. Inheritance is a different data model, not a bigger clone.

  Both wait for a version that has an event asking for them. Filing them here
  rather than building them keeps the current answer honest: repetition is an
  authoring convenience and it stops at the door.

- **Quadratic voting on pitches.** Floated 2026-08-31 for a future instance,
  explicitly not for this one: it changes what a vote *is* (a budget spent
  across pitches, not a click per pitch), so it wants its own schema and its
  own thinking rather than a column bolted onto `proposal_interest`.

- **Numbered migrations again, before the first deployment that holds data.**
  Since the squash the working practice has been to edit `001_baseline.sql` in
  place — `public_id` went in that way on 2026-08-31. That is free exactly
  while every database is disposable, and stops being free the moment one
  isn't: the runner tracks migrations by filename, so an edit never reaches a
  database that already recorded the file, and the symptom is not a migration
  error but a crash at runtime (`table identities has no column named
  public_id` on the first request from a new browser). Nothing warns about it —
  tests build fresh databases every time, and so does a reseed. Low priority
  because no instance holds data yet, and the remedy until then is to delete
  and recreate. What it wants is a line in the ARCHITECTURE §Migrations
  section naming the deploy as the cut-over, so the first `002_*.sql` is
  written deliberately rather than remembered.

- **A one-line reset for the local database.** Wiping a dev instance is
  currently three commands: stop the api, `rm -f data/app.db data/app.db-wal
  data/app.db-shm`, restart and let boot reseed. Easy to get wrong in the
  direction that hurts — `rm data/app.db*` also takes the `app.db.backup-*`
  copies sitting in the same directory. Wants an `npm run db:reset` that names
  the three files explicitly and leaves `data/.cookie-secret` alone (deleting
  it signs every browser out, which is a different intent and should be its
  own flag). Noted 2026-08-31, prompted by fixture identities —
  `programme_team` and the five seeded attendees — showing up unexplained in
  the admin attendance list. Note the naming collision with the item below: if
  "seed" becomes "mock", this is `db:reset` either way, but its reseed step
  changes name.

- **Rename "seed" to "mock".** Floated 2026-08-31. Worth knowing before
  starting that the word means three unrelated things in this tree, and only
  the first is a mock: the demo fixture generator (`scripts/seed.ts`,
  `server/src/seed.ts`, `npm run seed` / `seed:long`, the `SEED_*` env vars,
  `config.seedDemoEvent`, `demoSeed.test.ts`); the test helpers
  `seedEvent`/`seedRoom`/`seedTag`, which insert real rows through the real
  schema and are not mocks in any sense — `makeRoom` or `insertRoom` would be
  the honest rename there; and `identities.display_name`, described as "the
  seed a newcomer is offered", where the word means a starting value and
  should not be touched at all. So it is three decisions, not one
  find-and-replace: 222 identifier hits across the TypeScript alone, plus
  README, ARCHITECTURE, CHANGELOG and the SPEC.

- **Print / PDF grid.** Unconferences put the grid on a wall. A print
  stylesheet would cover most of it.
- **Restore for rooms and tags.** `/trash` covers sessions and contributions,
  which are the vandalism targets; rooms and tags soft-delete too but have no
  restore path.

---

# Out of scope

Deliberately not built, so nobody re-litigates them by accident. Checked
against the code on 2026-08-30:

- **Per-user accounts** and **WebSockets**. These two matter most: SSE and
  shared per-event passwords are load-bearing design choices, not placeholders.
  The identity model has grown a lot since — profiles, device linking, speaker
  codes — but every bit of it is deliberately account-free: a speaker code
  binds a phrase to a person, and never asks for an email or a password.
- **Email of any kind**, **image uploads**, **multi-language**, and **per-room
  QR codes**. Still true to the letter — there is no mail, upload, i18n or QR
  code anywhere in the tree.

## Voting: pitches yes, programme no

**Pitches are votable, and have been since the board shipped.** The
`proposal.vote` capability (`server/src/shared/capabilities.ts`) is granted to
every role by default, viewers included; `proposal_interest` stores it and the
board sorts by the count. Up/down votes were queued to replace that one-way
interest and were **dropped on 2026-08-31** — interest stays as it is, and
quadratic voting is parked under Low Priority for a future instance. The
hot/new split is still queued, under High Priority.

What stays out is voting on the **programme**: nobody votes a scheduled session
up or down. The board/programme line is the whole of the distinction, and it is
the only thing "no session voting" ever meant.

## Pulled in deliberately

Dark mode, iCal export and personal "my agenda" starring were on this list
originally (SPEC §12) and were pulled in on 2026-08-28. Pitch-board voting was
clarified as in-scope on 2026-08-29.
