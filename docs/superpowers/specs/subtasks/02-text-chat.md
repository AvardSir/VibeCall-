# Subtask 2 — User Can Use Text Chat

- **Version:** 1.0
- **Date:** 2026-06-29
- **Status:** Approved for planning
- **Parent:** `docs/superpowers/specs/2026-06-26-kmb-video-chat-technical-design.md` (master spec)
- **Decomposition:** `docs/superpowers/specs/subtasks/00-overview.md`
- **Depends on:** Subtask 1 (`01-join-room.md`) — a joined participant with a server-generated
  `identity` (unique) and a `displayName` (may duplicate).
- **Product source (binding):** `prd-kmb-video-chat.md` (v2.0) + wireframes. "PRD §X"/"FR-N"/"US-N"
  point at the PRD; "master §X" at the technical design.
- **Nature:** A **forward-compatible strict subset** of the master spec (chat lives in master §3.4 /
  wireframe `H4`, PRD US-9 / FR-22–25). It defers — never contradicts — the rest.

---

## 1. Goal

Reach this product state:

- A participant **sees messages sent before they joined** (history on join).
- A participant **sees an input field and a Send button**.
- After pressing Send, **every participant in the room sees the new message**.

## 2. Scope boundary

### In scope (full `H4` panel, text-only)

- **Backend-owned chat over Socket.IO** (master §3.4): per-room channel, server relays and owns
  history.
- **History on join** (`chat_history`), live broadcast of new messages (`chat_message`).
- **`H4` chat panel:** toggled by a chat button in the in-call controls bar; slides in on the
  right; message list shows **sender name + HH:MM**; input row = **text field + Send** (no
  paperclip — attachments deferred).
- **Text limits:** ≤1000 characters; a counter appears at 900.
- **Empty state:** "No messages yet."
- **Client-derived UI state** (no server events): unread badge on the chat button (new message
  while panel closed; cleared on open), and per-message `Sending…` → `Not delivered` status.

### Deferred (out — lands later / other subtasks)

| Deferred | Where it lands |
| --- | --- |
| Attachments (paperclip, image thumbnails/lightbox, file chips, upload/download) | master §3.5 (separate concern) |
| `grace_tick` / `grace_cancelled` / `room_ended` socket events | master §3.3 (host/grace) |
| `claim_share` / `release_share` / `share_state` (screen-share arbitration over the same socket) | master §3.6 / Subtask 3-adjacent |
| Host/guest role differences in the panel (the panel itself is identical for both roles) | master §4.5 |

## 3. Backend

Introduces Socket.IO to the service for the first time (Subtask 1 had none). Modules added on top
of Subtask 1, per `.claude/rules/50-backend.md`:

| Module | Responsibility in this subtask |
| --- | --- |
| `socket.ts` | Socket.IO wiring: per-room channel keyed by `roomName`, `join_chat`/`send_message` handlers, broadcast helpers. (Screen-share arbitration on the same socket is deferred.) |
| `chat.ts` | Build + validate a `ChatMessage`; per-room **in-memory** history (append on relay, cleared when the room ends). |
| `server.ts` | Now starts Socket.IO alongside the HTTP server (composition root). |

### 3.1 Event contract (typed on both ends)

**Client → server**

| Event | Payload | Server action |
| --- | --- | --- |
| `join_chat` | `{ identity, role }` | Verify `identity` is a current participant of the room (reuse Subtask-1 `listParticipants`); resolve the participant's **`displayName`** from the LiveKit participant record (its `name`); **bind** this socket → `{ identity, displayName }`; join the room channel; emit `chat_history` to this socket. Reject (and do not bind) if not a member. |
| `send_message` | `{ text }` | Validate (see §3.2). On success: build a `ChatMessage` stamping **`senderIdentity` (the unique id) and `senderName` (the bound `displayName`) from the socket binding** — never from the payload — append to history, broadcast `chat_message` to the room. On failure: emit `message_failed { code }` to the sender only. |

**Server → client**

| Event | Payload | When |
| --- | --- | --- |
| `chat_history` | `ChatMessage[]` | On `join_chat`. |
| `chat_message` | `ChatMessage` | Broadcast to the room on a relayed message. |
| `message_failed` | `{ code }` | To the sender only, on a rejected `send_message`. |

> **Authority (master §2.1).** The client sends *intents*; the server decides. The sender's name is
> stamped from the socket binding established at `join_chat`, so a client cannot spoof another
> participant. **Display names may duplicate** (PRD Assumption 10), so messages are keyed by the
> unique `senderIdentity`, not by name; the UI flags the local user's own messages via that identity.
> Clients never push history, unread counts, or delivery status — those are client-derived (master §3.4).

### 3.2 Message validation

- Reject empty (`text` blank/whitespace-only and no attachments — attachments deferred) → `code: 'EMPTY_MESSAGE'`.
- Reject `text.length > 1000` → `code: 'TEXT_TOO_LONG'`.
- Reject if the socket is unbound / sender is not a current member → `code: 'NOT_A_MEMBER'`.

### 3.3 `ChatMessage` (subset of master §3.4)

```ts
type ChatMessage = {
  id: string;
  roomName: string;
  senderIdentity: string;    // unique per participant (server-generated id)
  senderName: string;        // display name; may be duplicated across participants
  sentAt: number;            // epoch ms; rendered as HH:MM
  text: string;              // max 1000 chars
  // attachments: Attachment[]  // deferred (master §3.5) — added later, no shape change to the above
};
```

History accrues while the room is alive and is **cleared when the room ends**. (Room-end teardown
itself is owned by the master spec's grace/host lifecycle, deferred; in this subtask history is
cleared when LiveKit reports the room empty / removed.)

## 4. Frontend

New feature folder `features/chat`, per `.claude/rules/20-frontend-structure.md`. The in-call
controls bar from Subtask 1 gains a **chat button** that toggles the panel.

### 4.1 Components & hooks

- **Chat panel** (`features/chat`): slides in on the right; message list (sender name + HH:MM; own
  vs others distinguished by `senderIdentity`, not by name); input row (text field + Send); empty
  state "No messages yet.";
  character counter shown from 900.
- **`useChat` hook:** owns the Socket.IO connection lifecycle — emits `join_chat` on entering the
  room, listens for `chat_history`/`chat_message`/`message_failed`, exposes `sendMessage(text)`. No
  socket calls inside JSX.
- Components stay presentational; socket side effects live in the hook.

### 4.2 State (Zustand — `.claude/rules/30-state-store.md`)

`useChatStore`:

- `messages: ChatMessage[]` — history + live, reconciled from server events.
- `isPanelOpen: boolean`, `unreadCount: number` — unread increments on `chat_message` while closed;
  reset to 0 on open.
- Optimistic outgoing: a message shows `Sending…` until the server echoes it via `chat_message`;
  `message_failed` flips it to `Not delivered` with text retained for resend.
- Actions live in the store (`addMessage`, `openPanel`, `markSending`, `markFailed`, `reset`).
- Reset on leaving the room.

### 4.3 Flow

1. On entering the call (Subtask 1), the client opens the Socket.IO connection and emits
   `join_chat { identity, role }`; renders the returned `chat_history`.
2. Chat button toggles the panel; opening it clears the unread badge.
3. Typing enables Send when `text` is non-empty (≤1000; counter from 900). Pressing Send →
   optimistic `Sending…` + `send_message { text }`.
4. Server echoes `chat_message` to everyone (including sender → flips `Sending…` to delivered);
   `message_failed` → `Not delivered`, text retained.

## 5. Strings (verbatim — master §6 / wireframe `H4`)

- Input placeholder: **"Type a message…"**
- Send button: **"Send"**
- Empty chat: **"No messages yet."**
- In-flight / failed status: **"Sending…"** / **"Not delivered"** (master §3.4)

(All via `t()` in EN/RU resources, namespace `chat`. No hardcoded strings.)

## 6. Validation rules

- **Chat text:** ≤1000 characters; counter appears at 900.
- **Send enabled** when `text` is non-empty (attachments deferred).
- Validation is enforced **server-side** in `chat.ts`; the client mirrors it for UX (disabled Send,
  counter) only.

## 7. Testing (co-located, behavior-first — `.claude/rules/60-testing.md`)

**Backend** (mock Socket.IO + `listParticipants`):
- `join_chat`: member ⇒ socket bound + `chat_history` emitted; non-member ⇒ rejected, no bind.
- `send_message`: valid text ⇒ appended to history + broadcast; `senderIdentity`/`senderName`
  stamped from the binding, **not** the payload (spoof attempt ignored); two participants sharing a
  display name keep distinct `senderIdentity`.
- Validation: empty ⇒ `EMPTY_MESSAGE`; >1000 chars ⇒ `TEXT_TOO_LONG`; unbound ⇒ `NOT_A_MEMBER`.
- History: new joiner receives prior messages via `chat_history`.

**Frontend** (test hook/store directly; panel via visible behavior):
- `useChatStore`: add message, unread increments while closed and resets on open, optimistic
  `Sending…` → delivered / `Not delivered`.
- Send disabled on empty text; counter appears at 900.
- Empty state renders "No messages yet."; new `chat_message` appends in order.

## 8. Open notes & known limitations

- **In-memory history.** Lives in the backend process; a restart clears it (acceptable for the
  ephemeral, no-sign-up scope — master §8).
- **Membership check granularity.** Identity is verified at `join_chat` and bound to the socket;
  subsequent messages trust that binding. A participant who is removed mid-session is cut off when
  their LiveKit connection (and socket) drop. Tightening (re-verify per message, or tie the socket
  to a `memberToken`) is a later hardening step.
- **Room-end clearing.** Full room-lifecycle teardown (host end / grace) is deferred; here history
  is cleared on the LiveKit room becoming empty / removed.

## 9. Forward-compatibility mapping

| This subtask | Becomes (master spec) |
| --- | --- |
| `send_message { text }`, `ChatMessage` without `attachments` | `send_message` with attachment metadata; `ChatMessage.attachments: Attachment[]` (§3.4, §3.5) |
| Socket handles only `join_chat`/`send_message` | same socket also carries `claim_share`/`release_share`/`share_state` and `grace_tick`/`grace_cancelled`/`room_ended` (§3.3, §3.6) |
| Membership verified via `listParticipants` at `join_chat` | membership backed by the in-memory registry + `memberToken` (§3.1, §3.5) |
| Panel identical for both roles | role still does not change the panel; only the in-call controls bar differs by role (§4.5) |
