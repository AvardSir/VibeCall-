# КМБ Video Chat — Subtask Decomposition

- **Date:** 2026-06-29
- **Status:** Boundaries approved; specs written per-subtask
- **Relation:** This is a *delivery breakdown* of the master technical design
  (`docs/superpowers/specs/2026-06-26-kmb-video-chat-technical-design.md`). Every subtask spec is a
  **forward-compatible strict subset** of the master spec — it never contradicts it, only defers
  parts of it. The master spec and the wireframes
  (`KMB_VideoChat_Wireframes_with_Overview.html`) remain the binding source of truth, including the
  verbatim UI strings (master §6).

## Purpose

The product is built in four independently-shippable subtasks with **clear, non-overlapping
boundaries**. This file records the split and the boundaries so each subtask spec can stay focused;
each subtask gets its own spec file in this folder and, later, its own implementation plan.

## The four subtasks

| # | Title | One-line scope | File |
| --- | --- | --- | --- |
| 1 | User can join room | One fixed room, server-side cap of 4, "This call is full" screen, otherwise admission into the call with the participant's **own** media | `01-join-room.md` |
| 2 | User can use text chat | Socket.IO chat: history on join, input + Send, every participant sees a new message | `02-text-chat.md` |
| 3 | User can use videochat | See **and hear other** participants (remote track render + audio), laid out in a **2×2 grid** | `03-videochat.md` |
| 4 | Configure CI and deploy | `docker-compose.yml`, CI pipeline, deploy to the demo server | `04-ci-deploy.md` |

## Boundaries (where one subtask ends and the next begins)

- **#1 owns: the turnstile + local media.** Single-room provisioning, the 4-person capacity gate,
  the `S1` "call full" screen, name entry/validation, and connecting to LiveKit showing the
  participant's **own** tile (mirrored preview on pre-join, own in-call tile, mic/cam toggles).
- **#3 owns: everyone else's media + layout.** Subscribing to and rendering **remote**
  participants' video and audio, and the **2×2 grid** layout. #3 builds inside the in-call shell
  that #1 establishes.
  - **Media boundary (decided):** #1 = *self* media; #3 = *others'* media + the grid.
- **#2 owns: chat only.** The Socket.IO relay, in-memory history, the chat panel/input. No
  attachments in this subtask (attachments are a later, separate concern in the master spec §3.5).
- **#4 owns: packaging + delivery.** Containerization and CI/CD for whatever #1–#3 produce. No
  product behavior.

## Dependency order

```
#1 (join)  →  #2 (chat)   ┐
           →  #3 (video)  ┘  →  #4 (CI + deploy)
```

#2 and #3 both depend on #1 (you must be in a room) and are independent of each other. #4 depends on
having something to ship (#1–#3).

## Cross-cutting (applies to every subtask)

- Engineering conventions in `.claude/rules/` apply throughout (TypeScript strictness, feature-based
  frontend, one Zustand store per domain, Tailwind `dark:` theming, react-i18next — **no hardcoded
  user-facing strings**, co-located tests).
- All user-facing text is taken **verbatim** from master §6 / the wireframes and stored as i18n
  resources (EN default / RU).
- Each subtask spec ends with a **forward-compatibility note** mapping its deferrals onto the master
  spec, so later subtasks slot in without rework.
