# Subtask 3 — User Can Use Videochat

- **Version:** 1.0
- **Date:** 2026-06-29
- **Status:** Approved for planning
- **Parent:** `docs/superpowers/specs/2026-06-26-kmb-video-chat-technical-design.md` (master spec)
- **Decomposition:** `docs/superpowers/specs/subtasks/00-overview.md`
- **Depends on:** Subtask 1 (`01-join-room.md`) — a joined participant connected to LiveKit with
  their **own** media published.
- **Product source (binding):** `prd-kmb-video-chat.md` (v2.0, US-5 / FR-13–15) + wireframes.
  "PRD §X"/"FR-N"/"US-N" point at the PRD; "master §X" at the technical design.
- **Nature:** A **forward-compatible strict subset** of the master spec (video grid lives in master
  §4.3 / wireframes `H3`/`G2`). It defers — never contradicts — the rest. On the **camera-off tile**
  it follows the **PRD** (mic-state icon + name, no avatar), which supersedes the wireframe's older
  "avatar" depiction.

---

## 1. Goal

Reach this product state:

- A participant can **see and hear the other** participants in the call (their video + audio).
- Participant videos are arranged in a **grid** — the **2×2** layout is the four-participant case.

## 2. Scope boundary

### In scope (others' media + the layout)

- **Subscribe to and render remote** participants' **video** tracks as tiles.
- **Play remote audio** (the local participant's own audio is not played back — no echo).
- **Adaptive grid (master §4.3)** — decided over the task's literal "2×2":
  - **1:** one tile fills the area + **"Waiting for someone to join…"** notice.
  - **2:** left / right.
  - **3:** two top + one centered bottom.
  - **4:** **2×2**.
- **Tile states (PRD US-5, FR-13/FR-14):** own tile mirrored, labelled `<name> (You)` (established
  in Subtask 1, now placed by the grid); remote tiles labelled `<name>`. **Camera off** → dark
  background with the participant's **mic-state icon (muted/unmuted) centered above their name** — no
  generic avatar; the tile keeps its position/size. **Camera on + mic off** → a muted-mic icon in
  the tile **corner**. Video fills the tile with a **"cover"** fit (no black bars, no distortion).
  The grid re-arranges live as participants join/leave and as tracks mute/unmute.

### Deferred (out — lands later)

| Deferred | Where it lands |
| --- | --- |
| Screen share + the share layout (shared content fills main area, tiles move to a strip) | master §3.6, §4.4 |
| Active-speaker highlighting | not in scope for this product |
| Host actions on tiles (remove guest hover/`H6`) | master §2.1, §4.5 |
| Self-reconnect / host-grace overlays (`G6`) | master §3.3, §4.6 |

## 3. Backend

**No new backend work.** Subtask 1 already mints guest tokens with `canPublish` **and
`canSubscribe`** grants (`01-join-room.md` §4), which is all videochat needs — media flows
participant ↔ LiveKit SFU, never through the backend. This subtask is frontend-only.

## 4. Frontend

Builds the real video grid inside the in-call shell from Subtask 1, using the LiveKit Components
React SDK for track subscriptions and a **custom layout** component for the bespoke grid (master
§4.3). Feature: `features/call`.

### 4.1 Components & hooks

- **`VideoGrid`** — chooses the layout from the live participant count (1/2/3/4) and arranges tiles;
  CSS mirrors the wireframe layouts. Renders the count-1 "Waiting for someone to join…" notice.
- **`VideoTile`** — renders one participant: video element (own tile mirrored, "cover" fit), name
  label (`<name> (You)` for self); **camera off** → mic-state icon centered above the name on a dark
  background (no avatar); **camera on + mic off** → corner mute icon. Presentational.
- **`useParticipants` hook** — wraps LiveKit room/track subscriptions: exposes the ordered
  participant list (self + remotes) and per-participant camera/mic publication state; updates on
  `participantConnected`/`Disconnected` and track `muted`/`unmuted`/`subscribed`. All LiveKit side
  effects live here, not in JSX.
- **Remote audio** — rendered via the SDK's `RoomAudioRenderer` (or equivalent) so remote audio
  tracks play; the local participant is excluded to avoid echo.

### 4.2 State (Zustand — `.claude/rules/30-state-store.md`)

`useParticipantsStore` (new in this subtask; Subtask 1's `useMediaStore` / `useConnectionStore` are
unchanged):

- `participants: Participant[]` — **mirrored** from LiveKit events (server/LiveKit is authoritative;
  the store holds it for rendering, reconciled on events — master rule `30-state-store.md`).
- `activeSharerId` exists in the store shape for forward-compatibility but is always `null` here
  (screen share deferred).
- Components subscribe to the narrowest slice (e.g. just the participant list, or one tile's mute
  state).

### 4.3 Flow

1. On connect (Subtask 1), `useParticipants` seeds the list with self + any already-present remotes
   and subscribes to their tracks.
2. Remote joins → tile added, grid re-lays out (e.g. 2 → 3 → 4). Remote leaves → tile removed,
   re-layout (down to count-1 "Waiting…").
3. A participant toggles camera/mic → their tile flips to the centered mic-state icon (camera off) /
   shows or clears the corner mute icon (camera on), live for everyone.
4. Capacity is already bounded at 4 by Subtask 1, so the grid never exceeds 2×2.

## 5. Strings (verbatim — master §6 / wireframe `H3`)

- Solo state: **"Waiting for someone to join…"**
- Own-tile label: **`<name> (You)`** (the "(You)" suffix is localized; the name is dynamic)

(Via `t()` in EN/RU resources, namespace `call`. No hardcoded strings.)

## 6. Layout rules (master §4.3, verbatim intent)

| Count | Layout |
| --- | --- |
| 1 | One tile fills the area + "Waiting for someone to join…" notice |
| 2 | Left / right |
| 3 | Two top + one centered bottom |
| 4 | 2×2 |

Own tile is **mirrored**; remote tiles are not. Camera off ⇒ mic-state icon centered above the name
(no avatar); camera on + mic off ⇒ corner mute icon (PRD FR-14).

## 7. Testing (co-located, behavior-first — `.claude/rules/60-testing.md`)

Test hooks/stores directly; test the grid via visible output (mock LiveKit participant/track
objects — no real SFU):

- `VideoGrid` layout selection: 1 ⇒ solo + "Waiting…" notice; 2/3/4 ⇒ the corresponding layout and
  tile count.
- `VideoTile`: own tile mirrored + `(You)` label; camera off ⇒ centered mic-state icon + name (no
  avatar); camera on + mic off ⇒ corner mute icon.
- `useParticipants`: remote connect adds a participant, disconnect removes it; track mute/unmute
  flips the per-tile state.
- Remote audio is rendered for remotes and **not** for self.

## 8. Open notes & known limitations

- **Screen share deferred.** When it lands (master §4.4) the layout switches to "shared content +
  thumbnail strip"; the grid here is the no-share case. `activeSharerId` is already in the store
  shape for that.
- **No active-speaker UI** for this product scope.
  - **DEVIATION (2026-07-02, intentional):** active-speaker highlighting **was** implemented in the
    frontend (`VideoTile` accent ring driven by LiveKit `ActiveSpeakersChanged`). This deviates from
    **PRD non-goal #8** and this subtask's out-of-scope table (§2, "Active-speaker highlighting").
    It was built deliberately for **Figma visual fidelity** and is kept on purpose — code and spec
    are reconciled here to record the decision.
- **4-cap** comes from Subtask 1; this subtask assumes it and never renders a 5th tile.

## 9. Forward-compatibility mapping

| This subtask | Becomes (master spec) |
| --- | --- |
| Adaptive grid (no-share) | grid **or** screen-share strip layout, chosen from `activeSharerId` (§3.6, §4.4) |
| `useParticipants` from LiveKit events | same source; plus host-only "Remove" affordance on guest tiles (`H6`, §4.5) |
| `activeSharerId` always `null` | driven by the backend `share_state` broadcast over Socket.IO (§3.6) |
| Plain in-call grid | grid coexists with `G6` host-grace overlay / self-reconnect overlay (§3.3, §4.6) |
