# КМБ Video Chat — Project Context

> Working context for the КМБ Video Chat project. Captures decisions, deliverables,
> and current state so work can resume in a fresh session.

_Last updated: 2026-07-01_ (see the "Session 2026-07-01" section at the bottom for the current state — it supersedes the older "Current goal" / "Current state of the repo" notes below.)

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

- ~~**In-call controls can fall below the fold (2026-07-01).**~~ **FIXED** 2026-07-01 (commit
  `b2006bf`): the call root is now viewport-bounded (`h-full` + `overflow-hidden` + `min-h-0`) and
  each tile derives its width from the bounded height, so nothing overflows and the controls stay
  docked. See the Session 2026-07-01 section.

---

## Session 2026-07-01 — M6 + M7a + M7b implemented, plus a UX/theming pass

> This is the authoritative current state. Implementation is **well underway** (not paused at the
> architecture stage). Frontend + backend are built through M7b; M1–M5 landed in earlier sessions.

### Branch / repo state
- Active branch: **`feat/m6-screen-share`** (built on M4 + M5, which were already merged on the base).
- **24 commits this session, NOT pushed, no PR opened yet** (`d2e729a` … `ec97032`). Next obvious step:
  push the branch and open a PR into `main`.
- All gates green throughout: backend `typecheck + lint + test` (127 tests), frontend
  `typecheck (tsc -b) + lint + vitest` (~259 tests).
- **Not committed on purpose (scratch, ignore):** `.claude/worktrees/` (a leftover agent git-worktree)
  and a stray `внутрянка текст.txt` at the repo root. Recommend gitignoring `.claude/worktrees/`.
- **Deferred by the max-fast working mode:** the full manual browser/`docker compose up --build` smoke
  of M6/M7 (two-participant call, screen share, chat, attachments, both themes) has **not** been run
  end-to-end. Unit gates are green and a minimal composition smoke (POST /rooms + socket handshake) passed.

### Milestones completed this session
- **M6 — Screen share** (`docs/superpowers/plans/2026-07-01-m6-screen-share.md`). Server-authoritative
  one-sharer arbitration over Socket.IO (`claim_share`/`release_share` → `share_granted`/`denied`/`state`),
  registry `activeSharerId` + `claimShare`/`releaseShare`/`clearShare`, force-clear on sharer-left and
  host-grace (webhooks). Frontend: `useShareState` (single subscription), `useScreenShare` (picker/publish/
  release, 4s error auto-dismiss), `ScreenShareView`, `ThumbnailStrip`, `ParticipantTile` (extracted from
  `VideoGrid`, carries host-remove), `CallStage` layout switch.
- **M7a — Figma foundation** (`…/2026-07-01-m7a-figma-foundation.md`). Roboto Flex Variable font (`wdth 130`),
  `<Text>` scale/weights, `<Button>`/`<Tooltip>` geometry, tokens (`accent-active`/`danger-strong`/`text-muted`),
  `NameInput`, pre-join card, and the `ICONS` SVG barrel (`shared/assets/icons`).
- **M7b — Figma in-call rebuilds** (`…/2026-07-01-m7b-figma-incall.md`). `Icon` + `ControlButton` primitives;
  V2 controls bar (round mic/cam/share/end-leave + bottom-right Copy link/Chat); grid geometry + `VideoTile`
  glyphs; chat panel/messages/input restyle. M4/M5/M6 behavior preserved.

### Post-M7 UX changes + decisions (NOT in any plan — recorded here so they aren't lost)
These were direct user requests after M7b; each is a committed change on the branch:
- **Light-theme parity (`cc1b815`)** — M7 shipped the Figma dark palette as **base** classes; light theme
  was broken. Rule (re-affirmed): **base classes are light (white/slate), `dark:` carries the dark value**
  (like `body`). Canonical mapping: card/panel `bg-slate-100 dark:bg-surface-elevated`; bubble/field
  `bg-white dark:bg-surface`; pills/inputs `bg-slate-200 dark:bg-surface-muted`; text `text-slate-900
  dark:text-white`; placeholder `text-slate-400 dark:text-white/25`; borders `border-slate-200/300
  dark:border-white/10|25`. Round white controls & tooltips **flip** (dark control on light bg / white on
  dark). **Decisions:** video/media surfaces (live `VideoTile`, `ScreenShareView`, `ThumbnailStrip`,
  translucent pills) **stay dark in BOTH themes** (like Zoom/Meet); the **camera-off tile fill is grey in
  light theme** (`2890c93`, and matched in pre-join `9eea218`); **dark tooltips in the light theme are
  intentional** (Material-style high-contrast transient overlay — do not "fix").
- **Active-speaker highlight (`45d8721`, thickened `66b9a7e`)** — `ring-4 ring-accent` around the speaking
  tile (from LiveKit `participant.isSpeaking`, re-synced on `RoomEvent.ActiveSpeakersChanged`, threaded via
  `CallParticipant.isSpeaking`). **Accent blue, not green** — the palette has no green.
- **Tooltip behavior (`79771c9`)** — JS-controlled: **400ms hover delay**, **only one open at a time**
  (broadcast on a `document` `kmb:tooltip-open` event; opening one closes others — no module-level mutable
  state, to satisfy the React-Compiler `react-hooks/immutability` lint), dismiss on click/blur (the old
  `group-focus-within` kept a bubble open after a click).
- **Chat UX:** Enter sends / Shift+Enter newline (`8da1a48`, ignores IME composition); **Ctrl+V pastes a
  clipboard image** into the attachment pipeline (`80679e9`, blob renamed `pasted-image-N.png` from MIME);
  **outside-click closes the panel** (`5b1753e`, toggle button marked `data-chat-toggle` and excluded;
  added `useChatStore.closePanel`); **chat-open shrinks the call area** `pr-[340px]` so the fixed 340px panel
  doesn't cover the controls (`0bc7457`); **file download opens in a new tab** (`41ae2ba`) — the backend
  serves attachments cross-origin (`:3000`) where `<a download>` is ignored, so a same-tab click navigated
  away and dropped the call; **round paperclip attach button** with an `attach` SVG glyph (`ec97032`).
- **Image lightbox:** **opaque black backdrop** (`339a392`) — a translucent overlay over hardware
  `<video>` flickered during Ctrl +/- zoom; opaque = no video shows through = no flicker (accepted tradeoff:
  the dimmed call isn't visible behind the photo). Raised to **`z-[60]` above the TopBar** (`07ba575`) so its
  close × doesn't collide with the theme toggle.
- **Pre-join:** device toggles are now the in-call round `ControlButton` icons (`cbc05e2`); camera preview
  **re-attaches its stream on camera off→on** (`2d405d9` — the `srcObject` effect must depend on the
  video's remount, not only on `stream`); layout switched to the **PRD/wireframe (H2) variant** — a wider
  560px card with a large full-width 16:9 preview (`1917f43`), chosen over the compact Figma card because
  the user wanted more room for the self-view.

### Working mode + environment notes
- **Max-fast milestone mode** (user decision 2026-07-01): milestones run via parallel subagents on
  disjoint files, skip brainstorming when a plan exists, TDD focused on server-authoritative logic, gates
  once at the end, full Docker smoke on request. Reversible.
- **Docker:** pure code changes are picked up by hot-reload (no rebuild). **M7a added a dependency**
  (`@fontsource-variable/roboto-flex`), so after pulling this branch the frontend container needs the dep —
  `docker compose up --build`, or `docker compose exec frontend npm install` on a running stack (the
  anonymous `node_modules` volume shadows the host install). `down -v` only for base-image/musl changes.

## 2026-07-02 session — screen-share polish + GitLab CI/CD

### Screen-share / grid fixes (committed on `feat/m6-screen-share`)
- **Strip hidden during share (`e1cb2b0`):** the share-layout column lacked `min-h-0`, so the
  async-sized shared `<video>` ballooned and pushed the thumbnail strip below the `overflow-hidden`
  fold on wide viewports (the grid branch already had this fix from `b2006bf`; share was missed).
- **Late joiner didn't see the share + roster froze (`e1cb2b0`):** backend now emits the current
  `share_state` on `join_chat` (new `RoomRegistry.getActiveSharer`); roster sync (`useParticipants`)
  moved from `VideoGrid` (unmounted during a share) to `CallStage` — the always-mounted, in-room
  parent of both grid and strip. It must NOT live in `CallShell` (outside the LiveKitRoom provider →
  `useRoomContext` throws → crashed the in-call view, a green-gates-passing regression I hit and fixed).
- **Unequal grid gaps (`9ea45a7`):** 1fr cells letterboxed each 16:9 tile, inflating the vertical gap.
  Fix: per-count aspect on the grid box (16:9 for 1/3/4-up, 32:9 for 2-up), sized from a definite
  width, tiles fill their cells → the only gap is the uniform `gap-4`. (First attempt with %-widths in
  `auto` tracks collapsed the tiles — a circular dependency; reverted.)
- **Tooltip tail (`e0fa5a4`):** added the Figma `56:3010` speech-bubble triangle (CSS border, colour
  mirrors the bubble, direction by placement).
- **Strip centered under the shared screen (`justify-center`, in `e1cb2b0`).**

### GitLab CI/CD + demo2 deploy (committed on `feat/m6-screen-share`; also on new branch `develop`)
- **Validation pipeline** (`.gitlab-ci.yml`): lint + typecheck + test + build for FE & BE in parallel.
- **Prod Dockerfiles** (`backend/Dockerfile`, `frontend/Dockerfile` + `nginx.conf`): multi-stage,
  built + smoke-tested locally.
- **Deploy** to fora-soft demo2 via `docker-compose.develop.yml` (standalone; livekit + backend +
  frontend), routed by **Traefik labels**, gated `when: manual`. `deploy/README.md` has the checklist.
- **DevOps-confirmed params:** runner tag **`kmb-deploy`** (docker executor, deploys onto the host
  docker so containers are Traefik-visible) · Traefik network **`traefik`**, entrypoint **`http`**, **no
  certresolver** (TLS terminated upstream → **public scheme HTTPS**) · domains **`*-kmb.stg.forasoft.com`**
  (`dev-kmb` / `dev-api-kmb` / `dev-livekit-kmb`, DNS resolves) · server IP **167.233.84.103** · **LiveKit
  media = UDP** (publish 50000–50100/udp + 7881/tcp, `rtc.use_external_ip`; firewall must open the UDP
  range; no TURN).
- `FIXED_ROOM_NAME` in the dev compose is a **dead var** (not referenced in code).

## Possible next steps (await user direction)
- **Deploy to demo2:** set the 5 GitLab CI/CD Variables (scope `develop`; see `deploy/README.md`) →
  `git push -u origin develop` (runs validation) → run the manual `deploy_develop` job → verify →
  flip `when: manual` → `on_success`. Pin the LiveKit image version.
- **Push + PR into `main`** (M6 + M7a + M7b + UX pass + CI/CD). NB: `feat/m6-screen-share`/`develop`
  have **diverged from `origin/main`** (origin/main +12, branch +111) — reconcile before the MR.
- Run the deferred full manual `docker compose up --build` smoke of M6/M7 in both themes before merge.
- Gitignore `.claude/worktrees/`; remove the stray root `.txt`.
