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
- `KMB_VideoChat_Wireframes_with_Overview (1) (1).html` — wireframe inventory, 16 screens
  (Host H1–H6, Guest G1–G6, System S1–S4).
- The wireframes reference a PRD (`prd-kmb-video-chat.md v2.0`) and a
  `prd-videochat-starter-kit.md` that are **not present** in this folder.

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

## Possible next steps (await user direction)

- Refine the architecture spec, or present it in another form (diagram / visual artifact / summary).
- Write the frontend implementation plan.
- Resume backend implementation (only when the user asks).
