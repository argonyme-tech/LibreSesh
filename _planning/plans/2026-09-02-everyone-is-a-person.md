# Everyone who enters is a person

Started 2026-09-02. Spec: `_planning/specs/self-as-speaker-and-merge-ux.md`.
One commit per step, tests with each. Steps 0–2 in the main session on
`dev`; Steps 3–5 are handed to a second agent on `feat/everyone-is-a-person`
(see the spec's "Handing this to another agent").

## Step 0 — every identity that enters gets a person

- [x] `HttpError` carries optional `details`; `ApiError` exposes it.
- [x] `newDisplayName()` deleted; a fresh identity has an empty seed.
- [x] `server/src/people.ts`: `ownProfile`, `ensureOwnProfile`,
      `findUnclaimedNamesake`, `adoptProfile`.
- [x] Gate: `name_required` when no name is given and none held;
      `profile_exists` prompt with `claimProfile`; `ensureOwnProfile` after
      the name claim on both gate paths; `GET /e/:slug/gate` → `heldName`.
- [x] `nameClash` removed from `routes/people.ts`; `PATCH /me/profile` goes
      through `ensureOwnProfile`.
- [x] `NameResolver` falls back to the UID, never an empty string.
- [x] Migration `010_everyone_is_a_person.sql`: backfill `event_identities`
      for role holders without one, then `people` for every event identity.
- [x] Seed: demo attendees get usernames, event names and people rows.
- [x] Gate UI: username required, prefilled from `/gate`, "is that you?"
      prompt. Profile page: "Username" / "Full name" labels and hints.
- [x] Tests: helpers send a username; existing expectations updated; new
      tests for `name_required`, `/gate`, `profile_exists`, non-unique full
      names, the backfill.
- [x] CHANGELOG `[Unreleased]`, ARCHITECTURE paragraph, STATUS.

## Step 1 — "You" in the speaker picker

- [x] `PersonDto.creditable`; server refuses a non-organiser crediting a
      non-creditable person.
- [x] `SpeakerCombobox`: own row pinned as "· you", `@username` on claimed
      rows, non-creditable rows hidden for non-organisers.
- [x] Non-admin new session / pitch starts credited to self.
- [x] Tests.

## Step 2 — `session.credit_others` capability

- [ ] Capability entry, defaults open.
- [ ] `resolveSpeakers` rule: self or already-credited only, when lacking.
- [ ] Combobox offers only self when lacking.
- [ ] Tests.

## Step 3 — one People list with a role control (hand-off)

## Step 4 — the merge dialog (hand-off)

## Step 5 — a way back from the profile page (hand-off)
