# КМБ Video Chat — Project Context

> Working context for the КМБ Video Chat project. Captures decisions, deliverables,
> and current state so work can resume in a fresh session.

_Last updated: 2026-06-26_

---

## What the project is

A no-sign-up group video calling web app for **up to 4 participants** per room.
One **host** creates the room and owns it; **guests** join via a shared participant link.

Features: camera/mic, screen sharing (one sharer at a time), text chat with image/file
attachments, dark/light theming, EN/RU localization. **Desktop only (≥1024px).**

Source materials in this repo:
- `prd-kmb-video-chat.md` (v2.0) — the product requirements (binding for behavior).
- `KMB_VideoChat_Wireframes_with_Overview.html` — wireframe inventory, 16 screens
  (Host H1–H6, Guest G1–G6, System S1–S4).
- (A `prd-videochat-starter-kit.md` is referenced by the wireframes but is not in this folder.)

## Current goal

The user needs the **architecture / specification**, not implementation yet.

## Key architecture decisions (confirmed with user)

| Decision | Choice |
| --- | --- |
| Media transport | **Self-hosted local LiveKit server (SFU)** — approach "B" |
| Frontend | React + TypeScript + Vite, LiveKit Components React SDK, Tailwind, react-i18next |
| Backend | A single small **Node + TypeScript** control-plane service |
| Tokens | LiveKit server SDK `AccessToken` helper — **no hand-rolled JWT** |
| Chat | Fully **backend-owned over Socket.IO** (text + file metadata + server-side history + unread) |
| Attachments | Uploaded to the backend, stored on **local disk** (room-scoped), deleted on room end |
| Room state | In-memory registry on the backend (authoritative); host/guest roles enforced server-side |
| Host-reconnect grace | 60 seconds, driven by LiveKit webhooks + a server timer |

User preference noted: keep things **straightforward / aligned to the technical
requirements**, do not over-engineer.

## Deliverables produced

1. **Architecture / technical spec** (the main deliverable):
   `docs/superpowers/specs/2026-06-26-kmb-video-chat-technical-design.md`
   — system split, backend responsibilities, REST + Socket.IO interfaces, data models,
   frontend screen map (all 16 screens), key flows, exact status/error strings, validation rules.

2. **Backend implementation plan** (goes beyond pure architecture):
   `docs/superpowers/plans/2026-06-26-kmb-video-chat-backend.md`
   — 12 TDD tasks. The **frontend plan has not been written yet.**

## Review & hardening pass (2026-06-28)

Reviewed spec + plan + rules + tooling and applied fixes (no implementation started). Decisions:

- **Security/cleanup:** removed the API key from `claude.bat` (auth via `claude login`); deleted the
  junk `stuffNotNesert=y/` folder and the stray `message.txt` (an unrelated `aura-web` config).
- **Presence:** LiveKit webhooks are authoritative — a guest leaving frees the slot; the host slot
  is reserved during the 60s grace (spec §3.3).
- **Names:** display name doubles as identity and must be **unique per room** (case-insensitive,
  `NAME_TAKEN`); host exempt on reconnect (spec §2.1).
- **Screen share:** backend arbitrates "one share at a time" over Socket.IO
  (`claim_share`/`release_share`/`share_state`); freed on sharer leave / host grace (new spec §3.6).
- **Chat events:** simplified §3.4 to what the server actually sends; unread badge,
  `Sending…`/delivered, and roster are client-derived.
- **Attachments:** upload/download gated by a per-participant `memberToken` issued at `/join`.
- **Hardening:** idle-room reaper (bounds memory), separate `PUBLIC_BASE_URL`, documented
  in-memory/restart and client-supplied-MIME limitations (spec §8).
- **Rules compliance:** added a `logger` module (no `console.log`), ESLint + `lint`/`typecheck`
  scripts, Node 22; updated `.claude/rules/50-backend.md` to the flat `src/*.ts` module layout.

## Spec review & decisions (2026-06-29)

Reviewed spec + wireframes against the PRD-first constraint (PRD/wireframes are binding — not
changed). User chose these additions, all of which are *outside* the PRD (it doesn't dictate them).
Folded into the technical-design spec; no implementation started:

- **Host token out of the URL** → returned by `POST /rooms`, stored client-side in `sessionStorage`;
  host navigates the clean `/r/:room`. Reason: the wireframe's `?host=` would leak the token during
  screen share and into history; no FR mandates URL placement (spec §2.1, §4.2, §5.1).
- **Three transient states added** (not new PRD screens): `Connecting…`, awaiting device permission,
  and self-reconnect overlay (distinct from G6 host-grace). Minimal spinner + line; strings added to
  §6 (spec new §4.6).
- **Backend hardening — all four:** verify LiveKit webhook signatures (`WebhookReceiver`);
  intentional-end flag (`status='ending'` before `deleteRoom`, so a normal End call can't trip the
  60s grace); orphaned-attachment sweep on startup; per-IP rate-limit on `POST /rooms`
  (spec §3.1, §3.2, §3.3, §3.5, §8).
- **Completed** the truncated `Microphone access was denied…` string in §6.

Not changed (already decided / PRD-bound): chat over Socket.IO (server-owned, confirmed earlier);
`That name is already taken` wording still flagged "confirm with design".

## PRD found & reconciliation (2026-06-29)

The PRD (`prd-kmb-video-chat.md` v2.0) was located and added to the repo. Cross-checked it against
the wireframes and our specs; applied fixes (no implementation started):

- **PRD ↔ wireframes:** consistent except **camera-off** — the PRD changelog supersedes the
  wireframe's "avatar" with a **mic-state icon + name centered (no avatar)** (US-5, FR-13/14).
- **Reconciled our specs to the PRD** (PRD wins where the technical design had diverged):
  - **Names are NOT unique** — duplicates allowed (PRD Assumption 10); identity is a separate
    server-generated id, `(You)` distinguishes the local user. Removed `NAME_TAKEN` / "That name is
    already taken". (master §2.1/§3.2/§6/§7, subtasks 1–2)
  - **Host token lives in the host URL** (PRD FR-1, US-1, Assumption 8), not `sessionStorage`; the
    leak concern is kept as a documented trade-off. (master §2.1/§3.2/§4.2/§5.1)
  - **Camera-off** → mic-state icon + name, no avatar. (master §4.3, subtask 3)
  - String fixes: illegal-name-chars wording, combined camera+mic-denied message; Unicode name
    regex `^[\p{L}\p{N} '\-]{2,30}$`.
- **Confirmed already-PRD-specified** (our brainstorm choices matched the PRD): pre-join with
  preview/toggles, capacity check on open + at entry, "This call is full." string, adaptive
  1/2/3/4 grid, chat behavior. **Subtask 4 (CI/deploy)** is explicitly out of PRD scope — no conflict.
- Updated `CLAUDE.md` source-of-truth list and removed the "PRD not in repo" note.

## Frontend architecture decision (2026-06-29)

Considered **Feature-Sliced Design (FSD)** + its `steiger` linter for the frontend; **rejected** as
overkill for this app size (conflicts with the `00-project-base.md` "straightforward over clever"
principle, and `steiger` would add friction during incremental implementation). **Chosen
(option A):** keep the lightweight **feature-based** layout (`features/*` + `shared/*` + `stores/`)
and enforce layer boundaries with **`eslint-plugin-boundaries`** as part of `npm run lint` — no
separate architecture linter. Documented in `.claude/rules/20-frontend-structure.md`; subtask specs
1–3 already use this layout, so no spec changes were needed.

## Current state of the repo

- Git initialized; on branch `feat/kmb-backend` (initial commit `056a7ea`).
- A backend scaffold exists at `backend/` (`package.json`, `src/`) from a prematurely
  started implementation — **untracked, not committed.** Kept per user request.
- `.superpowers/sdd/` holds a progress ledger and task briefs from the (stopped)
  execution attempt.

## What happened / lesson

Implementation was started too early (git repo, branch, dispatched an implementer to
scaffold the backend). The user only wanted the **architecture** at this stage.
Implementation is paused.

## Known UI issues (backlog)

- **In-call controls can fall below the fold (2026-07-01).** On the in-call screen the
  ControlsBar (mic / camera / chat / leave) can require scrolling to reach — the `CallShell`
  content appears to overgrow the viewport. App is desktop-only (≥1024px), so the call view
  should fit the viewport height and keep the controls docked/visible without scrolling.
  Low priority; not a functional bug (buttons work once scrolled into view).

## Possible next steps (await user direction)

- Refine the architecture spec, or present it in another form (diagram / visual artifact / summary).
- Write the frontend implementation plan.
- Resume backend implementation (only when the user asks).
