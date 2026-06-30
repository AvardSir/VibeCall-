# Subtask 2 — User Can Use Text Chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend-owned text chat over Socket.IO to the existing call: a participant who has joined the room (Subtask 1) opens a chat panel, sees the history of messages sent before they joined, types a message and presses Send, and every participant in the room sees that message appear.

**Architecture:** A new Socket.IO server is attached to the existing Express HTTP server (same port). On `join_chat` the server verifies the socket's `identity` against the live LiveKit participant list, binds `{ identity, displayName }` to the socket, and replays in-memory history. On `send_message` the server stamps the sender from the **binding** (never the payload), appends to history, and broadcasts `chat_message` to the room. The frontend gains a `features/chat` feature (panel + input + message list), a `useChatStore` (Zustand), and a `useChat` hook that owns the socket lifecycle. Unread badge and `Sending…`/`Not delivered` status are client-derived. Attachments, host/guest panel differences, screen-share, and grace events are **deferred** (master spec §3.3/§3.5/§3.6).

**Tech Stack:** Backend — Node.js 22, TypeScript (ESM, strict), Express 5, `socket.io` 4, `livekit-server-sdk`, `pino`, `zod`, Vitest + Supertest. Frontend — React 19, TypeScript, Vite, Tailwind, Zustand 5, react-i18next, `socket.io-client`, Vitest + Testing Library.

## Global Constraints

- **Spec is binding:** `docs/superpowers/specs/subtasks/02-text-chat.md`. The PRD (`prd-kmb-video-chat.md` v2.0, US-9 / FR-22–25) + wireframe `H4` are the source of truth for product behavior and **verbatim** UI strings.
- **Stack reality (already installed, see [[stack-react19-deviation]]):** the repo runs **React 19 + TypeScript 6 + Express 5** despite CLAUDE.md saying React 18 / Express 4. This plan targets the **installed** versions. Consequences to mirror from Subtask 1: every `.tsx` uses `import type { JSX } from 'react'` (React 19 dropped the global `JSX` namespace); the frontend `typecheck` script is `tsc -b` (not `tsc --noEmit`); backend ESM imports use **explicit `.js` extensions** (`./chat.js`). Do not "fix" these to match the docs as part of this subtask.
- **English only** in code/comments/docs. User-facing strings localized EN (default) / RU via react-i18next — **no hardcoded user-facing strings in components**; every string goes through `t()`.
- **TypeScript strict.** No `any`; `unknown` + guards instead. No inline `// eslint-disable`, no `// @ts-ignore`/`@ts-expect-error` without a one-line justification. Backend `tsc --noEmit` and frontend `tsc -b` plus ESLint must be clean (zero warnings) for a task to be "done".
- **Naming:** types/interfaces/components `PascalCase`, **no `I`-prefix**; variables/functions `camelCase`; constants `UPPER_SNAKE_CASE`. String-literal unions over `enum`. Named exports only (except where a tool requires default). `import type` for type-only imports. Explicit return types on module/API-boundary functions.
- **No `console.*`** anywhere except `backend/src/logger.ts`.
- **Authority is server-side (master §2.1).** The sender's `senderIdentity`/`senderName` are stamped from the socket binding established at `join_chat` — **never** from the `send_message` payload. Message validation (empty, >1000 chars, membership) is enforced server-side; the client mirrors it (disabled Send, counter) for UX only.
- **Display names may duplicate** (PRD Assumption 10). Messages are keyed by the unique `senderIdentity`, not by name; the UI distinguishes the local user's own messages via `senderIdentity`.
- **Text limit:** ≤1000 characters; a character counter appears from 900. **Send enabled** when trimmed `text` is non-empty (attachments deferred).
- **Frontend layout is feature-based.** A feature imports from `shared/`/`stores/` only — **never** another feature's internals. The chat button lives in the **call** feature's `ControlsBar` and the chat panel lives in the **chat** feature; they communicate only through `useChatStore` (a store, importable by any feature). `App.tsx` (the `app` layer) is the only place allowed to render a feature alongside another feature.
- **One Zustand store per concern.** `useChatStore` owns chat UI state only (messages mirror, panel open, unread, optimistic status). No business rules in the store.
- **Tests co-located** (`*.test.ts(x)` next to source), behavior-first, deterministic (mock Socket.IO / `socket.io-client` and `listParticipants`; no real services).
- **Commit frequently** — one commit per task at minimum, Conventional Commits (`feat:`, `test:`, `chore:`).

---

## File Structure

### Backend (`backend/`) — added on top of Subtask 1

| File | Responsibility |
| --- | --- |
| `package.json` | Add `socket.io` dependency |
| `src/chat.ts` | `ChatMessage` type; `validateMessageText`; `createChatService` (build message + in-memory per-room history) |
| `src/chat.test.ts` | Validation + history behavior |
| `src/livekitAdmin.ts` *(modify)* | Add `listParticipants(): Promise<ParticipantSummary[]>` (identity + name) |
| `src/socket.ts` | Socket.IO wiring + `handleJoinChat` / `handleSendMessage` (DI, structurally typed for tests) |
| `src/socket.test.ts` | Handler behavior (membership, stamping, spoof, dup-name, validation, history replay) |
| `src/server.ts` *(modify)* | Create `http.Server` from the Express app, attach the Socket.IO server, listen on it |

### Frontend (`frontend/`) — added on top of Subtask 1

| File | Responsibility |
| --- | --- |
| `package.json` | Add `socket.io-client` dependency |
| `src/shared/types/index.ts` *(modify)* | Add `ChatMessage`, `ChatErrorCode`, `ParticipantRole` |
| `src/shared/lib/socketClient.ts` | `createSocket()` → connected `socket.io-client` instance |
| `src/shared/i18n/en.ts`, `ru.ts`, `index.ts` *(modify)* | Add `chat` namespace (verbatim strings); register it |
| `src/stores/useChatStore.ts` + `.test.ts` | Messages mirror, panel open, unread, optimistic status |
| `src/features/chat/hooks/useChat.ts` + `.test.ts` | Socket lifecycle: `join_chat`, listen to events, `sendMessage` |
| `src/features/chat/components/MessageList.tsx` + `.test.tsx` | Render messages / empty state |
| `src/features/chat/components/ChatInput.tsx` + `.test.tsx` | Text field + Send + counter |
| `src/features/chat/ChatPanel.tsx` | Slide-in panel composing the hook + components |
| `src/features/chat/index.ts` | Public entry (`ChatPanel`) |
| `src/features/call/components/ControlsBar.tsx` *(modify)* + `.test.tsx` | Add chat button with unread badge |
| `src/App.tsx` *(modify)* | Render `<ChatPanel/>` alongside `<CallShell/>` in-call; reset chat store on leave |

---

# Phase A — Backend

## Task 1: Add Socket.IO dependency

**Files:**
- Modify: `backend/package.json`

**Interfaces:**
- Produces: `socket.io` available to import in `socket.ts` and `server.ts`.

- [ ] **Step 1: Install socket.io**

Run (in `backend/`):
```bash
npm install socket.io
```
Expected: `socket.io` added to `dependencies` in `backend/package.json`, `node_modules/` updated, no peer-dep errors.

- [ ] **Step 2: Verify typecheck still passes & commit**

Run: `cd backend && npm run typecheck`
Expected: PASS (no source change yet).
```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add socket.io dependency"
```

---

## Task 2: `chat.ts` — message validation, build, and in-memory history

**Files:**
- Create: `backend/src/chat.ts`, `backend/src/chat.test.ts`

**Interfaces:**
- Produces:
  - `type ChatMessage = { id: string; roomName: string; senderIdentity: string; senderName: string; sentAt: number; text: string }`
  - `type ChatErrorCode = 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' | 'NOT_A_MEMBER'`
  - `const MAX_TEXT_LENGTH = 1000`
  - `type MessageValidation = { ok: true; value: string } | { ok: false; code: 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' }`
  - `validateMessageText(raw: unknown): MessageValidation`
  - `type ChatService = { validateText(raw: unknown): MessageValidation; build(input: { roomName: string; senderIdentity: string; senderName: string; text: string }): ChatMessage; append(message: ChatMessage): void; history(roomName: string): ChatMessage[]; clear(roomName: string): void }`
  - `createChatService(options?: { now?: () => number; newId?: () => string }): ChatService`

- [ ] **Step 1: Write the failing test (`backend/src/chat.test.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { validateMessageText, createChatService, MAX_TEXT_LENGTH } from './chat.js';

describe('validateMessageText', () => {
  it('accepts normal text and returns it verbatim', () => {
    expect(validateMessageText('hello')).toEqual({ ok: true, value: 'hello' });
  });

  it('rejects blank / whitespace-only as EMPTY_MESSAGE', () => {
    expect(validateMessageText('   ')).toEqual({ ok: false, code: 'EMPTY_MESSAGE' });
    expect(validateMessageText('')).toEqual({ ok: false, code: 'EMPTY_MESSAGE' });
  });

  it('rejects non-string as EMPTY_MESSAGE', () => {
    expect(validateMessageText(undefined)).toEqual({ ok: false, code: 'EMPTY_MESSAGE' });
    expect(validateMessageText(42)).toEqual({ ok: false, code: 'EMPTY_MESSAGE' });
  });

  it('rejects > 1000 chars as TEXT_TOO_LONG', () => {
    expect(validateMessageText('a'.repeat(MAX_TEXT_LENGTH + 1))).toEqual({
      ok: false,
      code: 'TEXT_TOO_LONG',
    });
  });

  it('accepts exactly 1000 chars', () => {
    const text = 'a'.repeat(MAX_TEXT_LENGTH);
    expect(validateMessageText(text)).toEqual({ ok: true, value: text });
  });
});

describe('createChatService', () => {
  function make() {
    let seq = 0;
    return createChatService({ now: () => 1000, newId: () => `m${++seq}` });
  }

  it('builds a message stamping id and sentAt', () => {
    const chat = make();
    const msg = chat.build({
      roomName: 'main',
      senderIdentity: 'p_1',
      senderName: 'Ann',
      text: 'hi',
    });
    expect(msg).toEqual({
      id: 'm1',
      roomName: 'main',
      senderIdentity: 'p_1',
      senderName: 'Ann',
      sentAt: 1000,
      text: 'hi',
    });
  });

  it('appends messages to per-room history in order', () => {
    const chat = make();
    chat.append(chat.build({ roomName: 'main', senderIdentity: 'p_1', senderName: 'Ann', text: 'a' }));
    chat.append(chat.build({ roomName: 'main', senderIdentity: 'p_2', senderName: 'Bo', text: 'b' }));
    expect(chat.history('main').map((m) => m.text)).toEqual(['a', 'b']);
  });

  it('isolates history by room and returns a copy', () => {
    const chat = make();
    chat.append(chat.build({ roomName: 'main', senderIdentity: 'p_1', senderName: 'Ann', text: 'a' }));
    expect(chat.history('other')).toEqual([]);
    chat.history('main').push({} as never); // mutating the returned array must not affect internal state
    expect(chat.history('main')).toHaveLength(1);
  });

  it('clears history for a room', () => {
    const chat = make();
    chat.append(chat.build({ roomName: 'main', senderIdentity: 'p_1', senderName: 'Ann', text: 'a' }));
    chat.clear('main');
    expect(chat.history('main')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/chat.test.ts`
Expected: FAIL — cannot resolve `./chat.js`.

- [ ] **Step 3: Implement `backend/src/chat.ts`**

```ts
import { randomUUID } from 'node:crypto';

export type ChatMessage = {
  id: string;
  roomName: string;
  senderIdentity: string; // unique per participant (server-generated id)
  senderName: string; // display name; may be duplicated across participants
  sentAt: number; // epoch ms; rendered as HH:MM on the client
  text: string; // max 1000 chars
  // attachments deferred (master §3.5) — added later, no shape change to the above
};

export type ChatErrorCode = 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' | 'NOT_A_MEMBER';

export const MAX_TEXT_LENGTH = 1000;

export type MessageValidation =
  | { ok: true; value: string }
  | { ok: false; code: 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' };

export function validateMessageText(raw: unknown): MessageValidation {
  if (typeof raw !== 'string') return { ok: false, code: 'EMPTY_MESSAGE' };
  if (raw.trim().length === 0) return { ok: false, code: 'EMPTY_MESSAGE' };
  if (raw.length > MAX_TEXT_LENGTH) return { ok: false, code: 'TEXT_TOO_LONG' };
  return { ok: true, value: raw };
}

export type ChatService = {
  validateText(raw: unknown): MessageValidation;
  build(input: {
    roomName: string;
    senderIdentity: string;
    senderName: string;
    text: string;
  }): ChatMessage;
  append(message: ChatMessage): void;
  history(roomName: string): ChatMessage[];
  clear(roomName: string): void;
};

export type ChatServiceOptions = {
  now?: () => number;
  newId?: () => string;
};

export function createChatService(options: ChatServiceOptions = {}): ChatService {
  const now = options.now ?? ((): number => Date.now());
  const newId = options.newId ?? ((): string => randomUUID());
  const histories = new Map<string, ChatMessage[]>();

  return {
    validateText: validateMessageText,
    build({ roomName, senderIdentity, senderName, text }) {
      return { id: newId(), roomName, senderIdentity, senderName, sentAt: now(), text };
    },
    append(message) {
      const list = histories.get(message.roomName) ?? [];
      list.push(message);
      histories.set(message.roomName, list);
    },
    history(roomName) {
      // Return a copy so callers cannot mutate internal state.
      return [...(histories.get(roomName) ?? [])];
    },
    clear(roomName) {
      histories.delete(roomName);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/chat.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/chat.ts backend/src/chat.test.ts
git commit -m "feat(backend): add chat message validation, build and in-memory history"
```

---

## Task 3: `livekitAdmin.ts` — expose participant summaries

**Files:**
- Modify: `backend/src/livekitAdmin.ts`

**Interfaces:**
- Produces (additions):
  - `type ParticipantSummary = { identity: string; name: string }`
  - `LivekitAdmin.listParticipants(): Promise<ParticipantSummary[]>`
- Consumed by: `socket.ts` (membership check + display-name resolution).

> No co-located unit test: this is a thin wrapper over `RoomServiceClient` (network I/O), consistent with Subtask 1. Its behavior is exercised through `socket.ts` (Task 4) with a mocked admin.

- [ ] **Step 1: Replace `backend/src/livekitAdmin.ts`**

```ts
import { RoomServiceClient } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';
import { logger } from './logger.js';

export type ParticipantSummary = { identity: string; name: string };

export type LivekitAdmin = {
  ensureRoom(): Promise<void>;
  listParticipantCount(): Promise<number>;
  listParticipants(): Promise<ParticipantSummary[]>;
};

export function createLivekitAdmin(config: AppConfig): LivekitAdmin {
  const client = new RoomServiceClient(
    config.livekitHost,
    config.livekitApiKey,
    config.livekitApiSecret,
  );

  async function fetchParticipants(): Promise<ParticipantSummary[]> {
    const participants = await client.listParticipants(config.fixedRoomName);
    return participants.map((p) => ({ identity: p.identity, name: p.name }));
  }

  return {
    async ensureRoom() {
      // Idempotent: createRoom on an existing room is a no-op upsert.
      await client.createRoom({
        name: config.fixedRoomName,
        maxParticipants: config.maxParticipants,
        emptyTimeout: config.emptyTimeoutSeconds,
      });
      logger.info({ room: config.fixedRoomName }, 'ensured fixed room exists');
    },

    async listParticipantCount() {
      const participants = await fetchParticipants();
      return participants.length;
    },

    async listParticipants() {
      return fetchParticipants();
    },
  };
}
```

- [ ] **Step 2: Verify typecheck + existing tests & commit**

Run: `cd backend && npm run typecheck && npx vitest run src/app.test.ts`
Expected: PASS (the `app.test.ts` mock for `admin` only uses `listParticipantCount`; the additional method does not break it).
```bash
git add backend/src/livekitAdmin.ts
git commit -m "feat(backend): expose participant summaries from LiveKit admin"
```

---

## Task 4: `socket.ts` — Socket.IO chat gateway

**Files:**
- Create: `backend/src/socket.ts`, `backend/src/socket.test.ts`

**Interfaces:**
- Consumes: `AppConfig`, `LivekitAdmin` (`listParticipants`), `ChatService`, `ChatMessage`, `ChatErrorCode`, `logger`.
- Produces:
  - `type JoinChatPayload = { identity: string; role: 'host' | 'guest' }`
  - `type SendMessagePayload = { text: string }`
  - `type ChatSocketBinding = { identity: string; displayName: string; roomName: string }`
  - `type EmittingSocket = { data: { binding?: ChatSocketBinding }; join(room: string): void; emit(event: string, payload: unknown): void }`
  - `type Broadcaster = { to(room: string): { emit(event: string, payload: unknown): void } }`
  - `type ChatGatewayDeps = { config: Pick<AppConfig, 'fixedRoomName' | 'corsOrigin'>; admin: Pick<LivekitAdmin, 'listParticipants'>; chat: ChatService }`
  - `handleJoinChat(socket: EmittingSocket, deps: ChatGatewayDeps, payload: JoinChatPayload): Promise<void>`
  - `handleSendMessage(socket: EmittingSocket, io: Broadcaster, deps: ChatGatewayDeps, payload: SendMessagePayload): void`
  - `createSocketServer(httpServer: HttpServer, deps: ChatGatewayDeps): Server`

> The handler params use the **structural** `EmittingSocket`/`Broadcaster` interfaces so tests pass plain fakes (no Socket.IO instance, no casts). A default-typed Socket.IO `Socket`/`Server` is structurally assignable to them, so `createSocketServer` forwards the real objects without assertions.

- [ ] **Step 1: Write the failing test (`backend/src/socket.test.ts`)**

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleJoinChat, handleSendMessage } from './socket.js';
import type { ChatGatewayDeps, ChatSocketBinding } from './socket.js';
import { createChatService } from './chat.js';

function makeSocket() {
  const emitted: { event: string; payload: unknown }[] = [];
  const joined: string[] = [];
  const socket = {
    data: {} as { binding?: ChatSocketBinding },
    join: (room: string): void => {
      joined.push(room);
    },
    emit: (event: string, payload: unknown): void => {
      emitted.push({ event, payload });
    },
  };
  return { socket, emitted, joined };
}

function makeIo() {
  const broadcasts: { room: string; event: string; payload: unknown }[] = [];
  const io = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown): void => {
        broadcasts.push({ room, event, payload });
      },
    }),
  };
  return { io, broadcasts };
}

function makeDeps(participants: { identity: string; name: string }[]): ChatGatewayDeps {
  let seq = 0;
  return {
    config: { fixedRoomName: 'main', corsOrigin: '*' },
    admin: { listParticipants: vi.fn().mockResolvedValue(participants) },
    chat: createChatService({ now: () => 1000, newId: () => `m${++seq}` }),
  };
}

describe('handleJoinChat', () => {
  it('binds the socket and emits chat_history for a current member', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted, joined } = makeSocket();

    await handleJoinChat(socket, deps, { identity: 'p_1', role: 'guest' });

    expect(socket.data.binding).toEqual({ identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    expect(joined).toEqual(['main']);
    expect(emitted).toEqual([{ event: 'chat_history', payload: [] }]);
  });

  it('rejects a non-member: no bind, no join, message_failed NOT_A_MEMBER', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted, joined } = makeSocket();

    await handleJoinChat(socket, deps, { identity: 'ghost', role: 'guest' });

    expect(socket.data.binding).toBeUndefined();
    expect(joined).toEqual([]);
    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'NOT_A_MEMBER' } }]);
  });

  it('replays prior history to a new joiner', async () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    deps.chat.append(
      deps.chat.build({ roomName: 'main', senderIdentity: 'p_0', senderName: 'Bo', text: 'earlier' }),
    );
    const { socket, emitted } = makeSocket();

    await handleJoinChat(socket, deps, { identity: 'p_1', role: 'guest' });

    const history = emitted.find((e) => e.event === 'chat_history')?.payload as { text: string }[];
    expect(history.map((m) => m.text)).toEqual(['earlier']);
  });
});

describe('handleSendMessage', () => {
  function bound(deps: ChatGatewayDeps, binding: ChatSocketBinding) {
    const s = makeSocket();
    s.socket.data.binding = binding;
    return s;
  }

  it('stamps sender from the binding (not the payload) and broadcasts', () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket } = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    const { io, broadcasts } = makeIo();

    // Even if a client sneaks extra fields, only `text` is read; sender comes from the binding.
    handleSendMessage(socket, io, deps, { text: 'hi' } as { text: string });

    expect(broadcasts).toHaveLength(1);
    const msg = broadcasts[0]!.payload as {
      senderIdentity: string;
      senderName: string;
      text: string;
    };
    expect(broadcasts[0]!.room).toBe('main');
    expect(broadcasts[0]!.event).toBe('chat_message');
    expect(msg).toMatchObject({ senderIdentity: 'p_1', senderName: 'Ann', text: 'hi' });
    expect(deps.chat.history('main')).toHaveLength(1);
  });

  it('keeps distinct senderIdentity for two participants sharing a display name', () => {
    const deps = makeDeps([
      { identity: 'p_1', name: 'Ann' },
      { identity: 'p_2', name: 'Ann' },
    ]);
    const { io, broadcasts } = makeIo();

    const a = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    handleSendMessage(a.socket, io, deps, { text: 'from one' });
    const b = bound(deps, { identity: 'p_2', displayName: 'Ann', roomName: 'main' });
    handleSendMessage(b.socket, io, deps, { text: 'from two' });

    const ids = broadcasts.map((x) => (x.payload as { senderIdentity: string }).senderIdentity);
    expect(ids).toEqual(['p_1', 'p_2']);
  });

  it('rejects an unbound socket with NOT_A_MEMBER and does not broadcast', () => {
    const deps = makeDeps([]);
    const { socket, emitted } = makeSocket();
    const { io, broadcasts } = makeIo();

    handleSendMessage(socket, io, deps, { text: 'hi' });

    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'NOT_A_MEMBER' } }]);
    expect(broadcasts).toEqual([]);
  });

  it('rejects empty text with EMPTY_MESSAGE (sender only)', () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted } = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    const { io, broadcasts } = makeIo();

    handleSendMessage(socket, io, deps, { text: '   ' });

    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'EMPTY_MESSAGE' } }]);
    expect(broadcasts).toEqual([]);
  });

  it('rejects > 1000 chars with TEXT_TOO_LONG', () => {
    const deps = makeDeps([{ identity: 'p_1', name: 'Ann' }]);
    const { socket, emitted } = bound(deps, { identity: 'p_1', displayName: 'Ann', roomName: 'main' });
    const { io } = makeIo();

    handleSendMessage(socket, io, deps, { text: 'a'.repeat(1001) });

    expect(emitted).toEqual([{ event: 'message_failed', payload: { code: 'TEXT_TOO_LONG' } }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/socket.test.ts`
Expected: FAIL — cannot resolve `./socket.js`.

- [ ] **Step 3: Implement `backend/src/socket.ts`**

```ts
import { Server } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import type { AppConfig } from './config.js';
import type { LivekitAdmin } from './livekitAdmin.js';
import type { ChatService } from './chat.js';
import { logger } from './logger.js';

export type JoinChatPayload = { identity: string; role: 'host' | 'guest' };
export type SendMessagePayload = { text: string };

export type ChatSocketBinding = { identity: string; displayName: string; roomName: string };

// Structural subsets of the Socket.IO `Socket`/`Server` so handlers are unit-testable
// with plain fakes. A default-typed Socket.IO socket/server satisfies these.
export type EmittingSocket = {
  data: { binding?: ChatSocketBinding };
  join(room: string): void;
  emit(event: string, payload: unknown): void;
};
export type Broadcaster = {
  to(room: string): { emit(event: string, payload: unknown): void };
};

export type ChatGatewayDeps = {
  config: Pick<AppConfig, 'fixedRoomName' | 'corsOrigin'>;
  admin: Pick<LivekitAdmin, 'listParticipants'>;
  chat: ChatService;
};

export async function handleJoinChat(
  socket: EmittingSocket,
  deps: ChatGatewayDeps,
  payload: JoinChatPayload,
): Promise<void> {
  const roomName = deps.config.fixedRoomName;
  const participants = await deps.admin.listParticipants();
  const match = participants.find((p) => p.identity === payload?.identity);
  if (!match) {
    // Not a current member → do not bind, do not join the channel.
    socket.emit('message_failed', { code: 'NOT_A_MEMBER' });
    return;
  }
  // Bind identity + the LiveKit-recorded display name to this socket; never trust the payload name.
  socket.data.binding = { identity: match.identity, displayName: match.name, roomName };
  socket.join(roomName);
  socket.emit('chat_history', deps.chat.history(roomName));
}

export function handleSendMessage(
  socket: EmittingSocket,
  io: Broadcaster,
  deps: ChatGatewayDeps,
  payload: SendMessagePayload,
): void {
  const binding = socket.data.binding;
  if (!binding) {
    socket.emit('message_failed', { code: 'NOT_A_MEMBER' });
    return;
  }
  const validation = deps.chat.validateText(payload?.text);
  if (!validation.ok) {
    socket.emit('message_failed', { code: validation.code });
    return;
  }
  const message = deps.chat.build({
    roomName: binding.roomName,
    senderIdentity: binding.identity, // from the binding, never the payload
    senderName: binding.displayName,
    text: validation.value,
  });
  deps.chat.append(message);
  io.to(binding.roomName).emit('chat_message', message);
}

export function createSocketServer(httpServer: HttpServer, deps: ChatGatewayDeps): Server {
  const io = new Server(httpServer, {
    cors: { origin: deps.config.corsOrigin },
  });

  io.on('connection', (socket) => {
    socket.on('join_chat', (payload: JoinChatPayload) => {
      void handleJoinChat(socket, deps, payload).catch((err: unknown) => {
        logger.error({ err }, 'join_chat handler failed');
      });
    });
    socket.on('send_message', (payload: SendMessagePayload) => {
      handleSendMessage(socket, io, deps, payload);
    });
  });

  return io;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/socket.test.ts`
Expected: PASS (9 tests).

> If `tsc` rejects passing the real `socket`/`io` into the structural handler params inside `createSocketServer`, add a single documented assertion (e.g. `handleSendMessage(socket as EmittingSocket, io as Broadcaster, …)`) with a one-line comment — the runtime shapes match. Do not introduce `any`.

- [ ] **Step 5: Full backend lint + typecheck & commit**

Run: `cd backend && npm run typecheck && npm run lint`
Expected: PASS, zero warnings.
```bash
git add backend/src/socket.ts backend/src/socket.test.ts
git commit -m "feat(backend): add Socket.IO chat gateway (join_chat, send_message)"
```

---

## Task 5: `server.ts` — attach Socket.IO to the HTTP server

**Files:**
- Modify: `backend/src/server.ts`

**Interfaces:**
- Consumes: `createServer` (node:http), `createChatService`, `createSocketServer`, existing composition.
- Produces: a single process serving REST + Socket.IO on the same port.

- [ ] **Step 1: Replace `backend/src/server.ts`**

```ts
// Load backend/.env into process.env before any config is read (no-op if absent, e.g. in prod).
import 'dotenv/config';
import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { createLivekitAdmin } from './livekitAdmin.js';
import { createTokenMinter } from './livekitTokens.js';
import { createApp } from './app.js';
import { createChatService } from './chat.js';
import { createSocketServer } from './socket.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const admin = createLivekitAdmin(config);
  const minter = createTokenMinter(config);
  const chat = createChatService();

  await admin.ensureRoom();

  const app = createApp({ config, admin, minter });
  const httpServer = createServer(app);
  createSocketServer(httpServer, { config, admin, chat });

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port, room: config.fixedRoomName }, 'control plane listening');
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, 'fatal startup error');
  process.exitCode = 1;
});
```

- [ ] **Step 2: Smoke-test against a local LiveKit (manual)**

Run (terminal 1): `livekit-server --dev`
Run (terminal 2): `cd backend && npm run dev`
Then join once to create a participant:
```bash
curl -X POST http://localhost:3000/rooms/main/join -H "Content-Type: application/json" -d '{"name":"Ann"}'
```
Expected: JSON with `identity` starting `p_`. The Socket.IO endpoint is now live on the same port (`http://localhost:3000/socket.io/`). Stop the dev server.

- [ ] **Step 3: Full backend suite + commit**

Run: `cd backend && npm test && npm run typecheck && npm run lint`
Expected: all PASS.
```bash
git add backend/src/server.ts
git commit -m "feat(backend): serve Socket.IO chat alongside the HTTP control plane"
```

---

# Phase B — Frontend

## Task 6: socket.io-client dependency, shared types, socket client

**Files:**
- Modify: `frontend/package.json`, `frontend/src/shared/types/index.ts`
- Create: `frontend/src/shared/lib/socketClient.ts`

**Interfaces:**
- Produces:
  - `type ChatMessage` (mirrors the backend shape)
  - `type ChatErrorCode = 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' | 'NOT_A_MEMBER'`
  - `type ParticipantRole = 'host' | 'guest'`
  - `createSocket(): Socket` (connected `socket.io-client` instance)

- [ ] **Step 1: Install socket.io-client**

Run (in `frontend/`):
```bash
npm install socket.io-client
```
Expected: `socket.io-client` added to `dependencies`.

- [ ] **Step 2: Append types to `frontend/src/shared/types/index.ts`**

Add to the end of the file:
```ts
export type ParticipantRole = 'host' | 'guest';

export type ChatErrorCode = 'EMPTY_MESSAGE' | 'TEXT_TOO_LONG' | 'NOT_A_MEMBER';

export type ChatMessage = {
  id: string;
  roomName: string;
  senderIdentity: string;
  senderName: string;
  sentAt: number;
  text: string;
};
```

- [ ] **Step 3: Create `frontend/src/shared/lib/socketClient.ts`**

```ts
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// The Socket.IO server is attached to the same origin as the REST control plane.
export function createSocket(): Socket {
  return io(BASE_URL, { autoConnect: true });
}
```

- [ ] **Step 4: Verify typecheck & commit**

Run: `cd frontend && npm run typecheck`
Expected: PASS.
```bash
git add frontend/package.json frontend/package-lock.json frontend/src/shared/types/index.ts frontend/src/shared/lib/socketClient.ts
git commit -m "feat(frontend): add socket client and chat shared types"
```

---

## Task 7: i18n — `chat` namespace (verbatim EN/RU)

**Files:**
- Modify: `frontend/src/shared/i18n/en.ts`, `frontend/src/shared/i18n/ru.ts`, `frontend/src/shared/i18n/index.ts`

**Interfaces:**
- Produces: `chat` namespace with keys `title`, `placeholder`, `send`, `empty`, `sending`, `notDelivered`, `charCount`, `openChat`.

- [ ] **Step 1: Add the `chat` block to `frontend/src/shared/i18n/en.ts`**

Insert after the `call` block (before the closing `} as const;`):
```ts
  chat: {
    title: 'Chat',
    placeholder: 'Type a message…',
    send: 'Send',
    empty: 'No messages yet.',
    sending: 'Sending…',
    notDelivered: 'Not delivered',
    charCount: '{{length}}/1000',
    openChat: 'Chat',
  },
```

- [ ] **Step 2: Add the matching `chat` block to `frontend/src/shared/i18n/ru.ts`**

Insert at the same position (RU is typed `typeof en`, so every key must exist):
```ts
  chat: {
    title: 'Чат',
    placeholder: 'Введите сообщение…',
    send: 'Отправить',
    empty: 'Сообщений пока нет.',
    sending: 'Отправка…',
    notDelivered: 'Не доставлено',
    charCount: '{{length}}/1000',
    openChat: 'Чат',
  },
```

- [ ] **Step 3: Register the namespace in `frontend/src/shared/i18n/index.ts`**

Change the `ns` array to include `chat`:
```ts
  ns: ['common', 'prejoin', 'call', 'roomStates', 'chat'],
```

- [ ] **Step 4: Verify typecheck & commit**

Run: `cd frontend && npm run typecheck`
Expected: PASS (RU typed as `typeof en` guarantees key parity).
```bash
git add frontend/src/shared/i18n
git commit -m "feat(frontend): add chat i18n namespace (EN/RU)"
```

---

## Task 8: `useChatStore` — chat UI state

**Files:**
- Create: `frontend/src/stores/useChatStore.ts`, `frontend/src/stores/useChatStore.test.ts`

**Interfaces:**
- Produces:
  - `type ChatItemStatus = 'sending' | 'delivered' | 'failed'`
  - `type ChatItem = { key: string; senderIdentity: string; senderName: string; sentAt: number; text: string; status: ChatItemStatus }`
  - `useChatStore` → `{ messages: ChatItem[]; isPanelOpen: boolean; unreadCount: number; setHistory(messages: ChatMessage[]): void; receiveMessage(message: ChatMessage, selfIdentity: string): void; addOptimistic(clientId: string, text: string, self: { identity: string; displayName: string }): void; markFailed(): void; openPanel(): void; closePanel(): void; reset(): void }`

> **Reconciliation rule (FIFO):** the sender's own optimistic `sending` items are reconciled with server echoes in send order — `receiveMessage` for an own-identity message replaces the **first** `sending` item; `markFailed` flips the **first** `sending` item to `failed`. This is robust even when two messages share the same text.

- [ ] **Step 1: Write the failing test (`frontend/src/stores/useChatStore.test.ts`)**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './useChatStore';
import type { ChatMessage } from '../shared/types';

const SELF = { identity: 'p_self', displayName: 'Me' };

function serverMsg(over: Partial<ChatMessage>): ChatMessage {
  return {
    id: 'srv1',
    roomName: 'main',
    senderIdentity: 'p_other',
    senderName: 'Other',
    sentAt: 1000,
    text: 'hello',
    ...over,
  };
}

describe('useChatStore', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('defaults to empty, closed, no unread', () => {
    const s = useChatStore.getState();
    expect(s.messages).toEqual([]);
    expect(s.isPanelOpen).toBe(false);
    expect(s.unreadCount).toBe(0);
  });

  it('setHistory loads delivered items keyed by server id', () => {
    useChatStore.getState().setHistory([serverMsg({ id: 'a' }), serverMsg({ id: 'b', text: 'hi' })]);
    const msgs = useChatStore.getState().messages;
    expect(msgs.map((m) => m.key)).toEqual(['a', 'b']);
    expect(msgs.every((m) => m.status === 'delivered')).toBe(true);
  });

  it('increments unread on others’ message while panel closed; not for own', () => {
    useChatStore.getState().receiveMessage(serverMsg({ senderIdentity: 'p_other' }), SELF.identity);
    expect(useChatStore.getState().unreadCount).toBe(1);
    useChatStore.getState().receiveMessage(serverMsg({ id: 'own', senderIdentity: SELF.identity }), SELF.identity);
    expect(useChatStore.getState().unreadCount).toBe(1); // own message does not bump unread
  });

  it('openPanel resets unread; messages received while open do not bump', () => {
    useChatStore.getState().receiveMessage(serverMsg({}), SELF.identity);
    useChatStore.getState().openPanel();
    expect(useChatStore.getState().unreadCount).toBe(0);
    useChatStore.getState().receiveMessage(serverMsg({ id: 'srv2' }), SELF.identity);
    expect(useChatStore.getState().unreadCount).toBe(0);
  });

  it('optimistic message shows sending, then is reconciled to delivered on echo', () => {
    useChatStore.getState().addOptimistic('c1', 'hi there', SELF);
    let msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatchObject({ key: 'c1', status: 'sending', text: 'hi there', senderIdentity: 'p_self' });

    useChatStore
      .getState()
      .receiveMessage(serverMsg({ id: 'srv-echo', senderIdentity: SELF.identity, text: 'hi there' }), SELF.identity);
    msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(1); // reconciled, not duplicated
    expect(msgs[0]).toMatchObject({ key: 'srv-echo', status: 'delivered' });
  });

  it('markFailed flips the first sending item to failed', () => {
    useChatStore.getState().addOptimistic('c1', 'a', SELF);
    useChatStore.getState().addOptimistic('c2', 'b', SELF);
    useChatStore.getState().markFailed();
    const msgs = useChatStore.getState().messages;
    expect(msgs[0]!.status).toBe('failed');
    expect(msgs[1]!.status).toBe('sending');
  });

  it('reset clears everything', () => {
    useChatStore.getState().addOptimistic('c1', 'a', SELF);
    useChatStore.getState().receiveMessage(serverMsg({}), SELF.identity);
    useChatStore.getState().openPanel();
    useChatStore.getState().reset();
    const s = useChatStore.getState();
    expect(s.messages).toEqual([]);
    expect(s.isPanelOpen).toBe(false);
    expect(s.unreadCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/stores/useChatStore.test.ts`
Expected: FAIL — cannot resolve `./useChatStore`.

- [ ] **Step 3: Implement `frontend/src/stores/useChatStore.ts`**

```ts
import { create } from 'zustand';
import type { ChatMessage } from '../shared/types';

export type ChatItemStatus = 'sending' | 'delivered' | 'failed';

export type ChatItem = {
  key: string; // server id once delivered; client id while sending/failed
  senderIdentity: string;
  senderName: string;
  sentAt: number;
  text: string;
  status: ChatItemStatus;
};

type ChatState = {
  messages: ChatItem[];
  isPanelOpen: boolean;
  unreadCount: number;
  setHistory: (messages: ChatMessage[]) => void;
  receiveMessage: (message: ChatMessage, selfIdentity: string) => void;
  addOptimistic: (clientId: string, text: string, self: { identity: string; displayName: string }) => void;
  markFailed: () => void;
  openPanel: () => void;
  closePanel: () => void;
  reset: () => void;
};

function toDelivered(message: ChatMessage): ChatItem {
  return {
    key: message.id,
    senderIdentity: message.senderIdentity,
    senderName: message.senderName,
    sentAt: message.sentAt,
    text: message.text,
    status: 'delivered',
  };
}

export const useChatStore = create<ChatState>()((set) => ({
  messages: [],
  isPanelOpen: false,
  unreadCount: 0,

  setHistory: (messages) => set({ messages: messages.map(toDelivered) }),

  receiveMessage: (message, selfIdentity) =>
    set((state) => {
      const delivered = toDelivered(message);
      if (message.senderIdentity === selfIdentity) {
        // Reconcile with the first still-sending own message (FIFO send order).
        const idx = state.messages.findIndex((m) => m.status === 'sending');
        if (idx !== -1) {
          const messages = state.messages.slice();
          messages[idx] = delivered;
          return { messages };
        }
        return { messages: [...state.messages, delivered] };
      }
      return {
        messages: [...state.messages, delivered],
        unreadCount: state.isPanelOpen ? state.unreadCount : state.unreadCount + 1,
      };
    }),

  addOptimistic: (clientId, text, self) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          key: clientId,
          senderIdentity: self.identity,
          senderName: self.displayName,
          sentAt: Date.now(),
          text,
          status: 'sending',
        },
      ],
    })),

  markFailed: () =>
    set((state) => {
      const idx = state.messages.findIndex((m) => m.status === 'sending');
      if (idx === -1) return state;
      const messages = state.messages.slice();
      messages[idx] = { ...messages[idx]!, status: 'failed' };
      return { messages };
    }),

  openPanel: () => set({ isPanelOpen: true, unreadCount: 0 }),
  closePanel: () => set({ isPanelOpen: false }),
  reset: () => set({ messages: [], isPanelOpen: false, unreadCount: 0 }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/stores/useChatStore.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/useChatStore.ts frontend/src/stores/useChatStore.test.ts
git commit -m "feat(frontend): add useChatStore for chat UI state"
```

---

## Task 9: `useChat` hook — socket lifecycle

**Files:**
- Create: `frontend/src/features/chat/hooks/useChat.ts`, `frontend/src/features/chat/hooks/useChat.test.ts`

**Interfaces:**
- Consumes: `createSocket` (`shared/lib/socketClient`), `useChatStore`, `useConnectionStore`, `ChatMessage`, `ChatErrorCode`, `ParticipantRole`.
- Produces: `useChat(role: ParticipantRole): { sendMessage: (text: string) => void }`

- [ ] **Step 1: Write the failing test (`frontend/src/features/chat/hooks/useChat.test.ts`)**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChat } from './useChat';
import { useChatStore } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';

// A minimal fake socket whose events we can drive from the test.
type Handler = (payload: unknown) => void;
const fake = {
  handlers: new Map<string, Handler>(),
  emitted: [] as { event: string; payload: unknown }[],
  on(event: string, handler: Handler) {
    this.handlers.set(event, handler);
  },
  emit(event: string, payload: unknown) {
    this.emitted.push({ event, payload });
  },
  removeAllListeners() {
    this.handlers.clear();
  },
  disconnect: vi.fn(),
  trigger(event: string, payload: unknown) {
    this.handlers.get(event)?.(payload);
  },
};

vi.mock('../../../shared/lib/socketClient', () => ({
  createSocket: () => fake,
}));

describe('useChat', () => {
  beforeEach(() => {
    fake.handlers.clear();
    fake.emitted = [];
    useChatStore.getState().reset();
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_self', displayName: 'Me' });
  });

  it('emits join_chat on connect and loads history', () => {
    renderHook(() => useChat('guest'));
    act(() => fake.trigger('connect', undefined));
    expect(fake.emitted).toContainEqual({ event: 'join_chat', payload: { identity: 'p_self', role: 'guest' } });

    act(() =>
      fake.trigger('chat_history', [
        { id: 'a', roomName: 'main', senderIdentity: 'p_x', senderName: 'X', sentAt: 1, text: 'hi' },
      ]),
    );
    expect(useChatStore.getState().messages.map((m) => m.text)).toEqual(['hi']);
  });

  it('appends incoming chat_message to the store', () => {
    renderHook(() => useChat('guest'));
    act(() =>
      fake.trigger('chat_message', {
        id: 'b',
        roomName: 'main',
        senderIdentity: 'p_x',
        senderName: 'X',
        sentAt: 2,
        text: 'yo',
      }),
    );
    expect(useChatStore.getState().messages.map((m) => m.text)).toEqual(['yo']);
  });

  it('sendMessage adds an optimistic item and emits send_message', () => {
    const { result } = renderHook(() => useChat('guest'));
    act(() => result.current.sendMessage('hello'));
    expect(useChatStore.getState().messages[0]).toMatchObject({ text: 'hello', status: 'sending' });
    expect(fake.emitted).toContainEqual({ event: 'send_message', payload: { text: 'hello' } });
  });

  it('message_failed flips the pending item to failed', () => {
    const { result } = renderHook(() => useChat('guest'));
    act(() => result.current.sendMessage('oops'));
    act(() => fake.trigger('message_failed', { code: 'TEXT_TOO_LONG' }));
    expect(useChatStore.getState().messages[0]!.status).toBe('failed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/chat/hooks/useChat.test.ts`
Expected: FAIL — cannot resolve `./useChat`.

- [ ] **Step 3: Implement `frontend/src/features/chat/hooks/useChat.ts`**

```ts
import { useCallback, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { createSocket } from '../../../shared/lib/socketClient';
import { useChatStore } from '../../../stores/useChatStore';
import { useConnectionStore } from '../../../stores/useConnectionStore';
import type { ChatMessage, ChatErrorCode, ParticipantRole } from '../../../shared/types';

export type UseChatResult = { sendMessage: (text: string) => void };

export function useChat(role: ParticipantRole): UseChatResult {
  const localParticipant = useConnectionStore((s) => s.localParticipant);
  const setHistory = useChatStore((s) => s.setHistory);
  const receiveMessage = useChatStore((s) => s.receiveMessage);
  const addOptimistic = useChatStore((s) => s.addOptimistic);
  const markFailed = useChatStore((s) => s.markFailed);

  const socketRef = useRef<Socket | null>(null);
  const clientSeq = useRef(0);

  useEffect(() => {
    if (!localParticipant) return;
    const identity = localParticipant.identity;
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_chat', { identity, role });
    });
    socket.on('chat_history', (messages: ChatMessage[]) => setHistory(messages));
    socket.on('chat_message', (message: ChatMessage) => receiveMessage(message, identity));
    socket.on('message_failed', (_payload: { code: ChatErrorCode }) => markFailed());

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [localParticipant, role, setHistory, receiveMessage, markFailed]);

  const sendMessage = useCallback(
    (text: string) => {
      const socket = socketRef.current;
      if (!socket || !localParticipant) return;
      const clientId = `c_${clientSeq.current++}`;
      addOptimistic(clientId, text, localParticipant);
      socket.emit('send_message', { text });
    },
    [addOptimistic, localParticipant],
  );

  return { sendMessage };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/chat/hooks/useChat.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/chat/hooks/useChat.ts frontend/src/features/chat/hooks/useChat.test.ts
git commit -m "feat(frontend): add useChat hook for socket lifecycle"
```

---

## Task 10: `MessageList` + `ChatInput` components

**Files:**
- Create: `frontend/src/features/chat/components/MessageList.tsx`, `frontend/src/features/chat/components/MessageList.test.tsx`, `frontend/src/features/chat/components/ChatInput.tsx`, `frontend/src/features/chat/components/ChatInput.test.tsx`

**Interfaces:**
- Produces:
  - `MessageList({ items, selfIdentity }: { items: ChatItem[]; selfIdentity: string }): JSX.Element`
  - `ChatInput({ onSend }: { onSend: (text: string) => void }): JSX.Element`

- [ ] **Step 1: Write the failing test (`frontend/src/features/chat/components/MessageList.test.tsx`)**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../../shared/i18n';
import { MessageList } from './MessageList';
import type { ChatItem } from '../../../stores/useChatStore';

function item(over: Partial<ChatItem>): ChatItem {
  return {
    key: 'k',
    senderIdentity: 'p_other',
    senderName: 'Other',
    sentAt: 0,
    text: 'hello',
    status: 'delivered',
    ...over,
  };
}

describe('MessageList', () => {
  it('renders the empty state when there are no messages', () => {
    render(<MessageList items={[]} selfIdentity="p_self" />);
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
  });

  it('renders messages in order with sender names', () => {
    render(
      <MessageList
        items={[item({ key: '1', text: 'first' }), item({ key: '2', text: 'second', senderName: 'Bo' })]}
        selfIdentity="p_self"
      />,
    );
    const texts = screen.getAllByTestId('chat-text').map((el) => el.textContent);
    expect(texts).toEqual(['first', 'second']);
  });

  it('shows the Sending… / Not delivered status on own messages', () => {
    render(
      <MessageList
        items={[
          item({ key: 's', senderIdentity: 'p_self', status: 'sending' }),
          item({ key: 'f', senderIdentity: 'p_self', status: 'failed' }),
        ]}
        selfIdentity="p_self"
      />,
    );
    expect(screen.getByText('Sending…')).toBeInTheDocument();
    expect(screen.getByText('Not delivered')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/chat/components/MessageList.test.tsx`
Expected: FAIL — cannot resolve `./MessageList`.

- [ ] **Step 3: Implement `frontend/src/features/chat/components/MessageList.tsx`**

```tsx
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatItem } from '../../../stores/useChatStore';

export type MessageListProps = { items: ChatItem[]; selfIdentity: string };

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageList({ items, selfIdentity }: MessageListProps): JSX.Element {
  const { t } = useTranslation('chat');

  if (items.length === 0) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-slate-500">{t('empty')}</div>
    );
  }

  return (
    <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
      {items.map((m) => {
        const isOwn = m.senderIdentity === selfIdentity;
        return (
          <li key={m.key} className={isOwn ? 'self-end text-right' : 'self-start text-left'}>
            <div className="text-xs text-slate-400">
              <span className="font-medium">{m.senderName}</span> · {formatTime(m.sentAt)}
            </div>
            <div
              data-testid="chat-text"
              className="inline-block max-w-xs whitespace-pre-wrap break-words rounded-lg bg-surface-muted px-3 py-2 text-sm text-slate-100"
            >
              {m.text}
            </div>
            {isOwn && m.status === 'sending' && (
              <div className="text-xs text-slate-500">{t('sending')}</div>
            )}
            {isOwn && m.status === 'failed' && (
              <div className="text-xs text-red-400">{t('notDelivered')}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/chat/components/MessageList.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test (`frontend/src/features/chat/components/ChatInput.test.tsx`)**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../shared/i18n';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('disables Send when the field is empty or whitespace', async () => {
    render(<ChatInput onSend={vi.fn()} />);
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText('Type a message…'), '   ');
    expect(send).toBeDisabled();
  });

  it('sends the trimmed-non-empty text and clears the field', async () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} />);
    const field = screen.getByPlaceholderText('Type a message…');
    await userEvent.type(field, 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('hello');
    expect(field).toHaveValue('');
  });

  it('shows the character counter only from 900 characters', async () => {
    render(<ChatInput onSend={vi.fn()} />);
    const field = screen.getByPlaceholderText('Type a message…');
    await userEvent.click(field);
    await userEvent.paste('a'.repeat(899));
    expect(screen.queryByText(/\/1000$/)).not.toBeInTheDocument();
    await userEvent.paste('a'); // now 900
    expect(screen.getByText('900/1000')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/chat/components/ChatInput.test.tsx`
Expected: FAIL — cannot resolve `./ChatInput`.

- [ ] **Step 7: Implement `frontend/src/features/chat/components/ChatInput.tsx`**

```tsx
import { useState } from 'react';
import type { FormEvent, JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../shared/ui/Button';

const MAX_TEXT_LENGTH = 1000;
const COUNTER_THRESHOLD = 900;

export type ChatInputProps = { onSend: (text: string) => void };

export function ChatInput({ onSend }: ChatInputProps): JSX.Element {
  const { t } = useTranslation('chat');
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;

  const submit = (e: FormEvent): void => {
    e.preventDefault();
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 border-t border-surface-muted p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT_LENGTH))}
          placeholder={t('placeholder')}
          rows={2}
          className="flex-1 resize-none rounded-lg bg-surface-muted px-3 py-2 text-sm text-slate-100 outline-none"
        />
        <Button type="submit" disabled={!canSend}>
          {t('send')}
        </Button>
      </div>
      {text.length >= COUNTER_THRESHOLD && (
        <span className="self-end text-xs text-slate-500">{t('charCount', { length: text.length })}</span>
      )}
    </form>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/chat/components/ChatInput.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/chat/components
git commit -m "feat(frontend): add chat MessageList and ChatInput components"
```

---

## Task 11: `ChatPanel` + feature entry

**Files:**
- Create: `frontend/src/features/chat/ChatPanel.tsx`, `frontend/src/features/chat/ChatPanel.test.tsx`, `frontend/src/features/chat/index.ts`

**Interfaces:**
- Consumes: `useChat`, `useChatStore`, `useConnectionStore`, `MessageList`, `ChatInput`, `ParticipantRole`.
- Produces: `ChatPanel({ role }: { role: ParticipantRole }): JSX.Element` and the feature public entry `export { ChatPanel }`.

- [ ] **Step 1: Write the failing test (`frontend/src/features/chat/ChatPanel.test.tsx`)**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '../../shared/i18n';
import { ChatPanel } from './ChatPanel';
import { useChatStore } from '../../stores/useChatStore';
import { useConnectionStore } from '../../stores/useConnectionStore';

// The panel manages a socket via useChat; stub it so the test needs no server.
vi.mock('./hooks/useChat', () => ({ useChat: () => ({ sendMessage: vi.fn() }) }));

describe('ChatPanel', () => {
  beforeEach(() => {
    useChatStore.getState().reset();
    useConnectionStore.getState().setLocalParticipant({ identity: 'p_self', displayName: 'Me' });
  });

  it('renders the empty state when open with no messages', () => {
    useChatStore.getState().openPanel();
    render(<ChatPanel role="guest" />);
    expect(screen.getByText('No messages yet.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type a message…')).toBeInTheDocument();
  });

  it('renders messages from the store', () => {
    useChatStore.getState().openPanel();
    useChatStore.getState().setHistory([
      { id: 'a', roomName: 'main', senderIdentity: 'p_x', senderName: 'X', sentAt: 1, text: 'history msg' },
    ]);
    render(<ChatPanel role="guest" />);
    expect(screen.getByText('history msg')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/features/chat/ChatPanel.test.tsx`
Expected: FAIL — cannot resolve `./ChatPanel`.

- [ ] **Step 3: Implement `frontend/src/features/chat/ChatPanel.tsx`**

```tsx
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../stores/useChatStore';
import { useConnectionStore } from '../../stores/useConnectionStore';
import type { ParticipantRole } from '../../shared/types';
import { useChat } from './hooks/useChat';
import { MessageList } from './components/MessageList';
import { ChatInput } from './components/ChatInput';

export type ChatPanelProps = { role: ParticipantRole };

export function ChatPanel({ role }: ChatPanelProps): JSX.Element {
  const { t } = useTranslation('chat');
  const { sendMessage } = useChat(role);
  const messages = useChatStore((s) => s.messages);
  const isPanelOpen = useChatStore((s) => s.isPanelOpen);
  const selfIdentity = useConnectionStore((s) => s.localParticipant?.identity ?? '');

  return (
    <aside
      aria-label={t('title')}
      className={`fixed right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-surface-muted bg-surface transition-transform ${
        isPanelOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <header className="border-b border-surface-muted p-3 text-sm font-medium text-slate-200">
        {t('title')}
      </header>
      <MessageList items={messages} selfIdentity={selfIdentity} />
      <ChatInput onSend={sendMessage} />
    </aside>
  );
}
```

- [ ] **Step 4: Create `frontend/src/features/chat/index.ts`**

```ts
export { ChatPanel } from './ChatPanel';
export type { ChatPanelProps } from './ChatPanel';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/chat/ChatPanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/chat/ChatPanel.tsx frontend/src/features/chat/ChatPanel.test.tsx frontend/src/features/chat/index.ts
git commit -m "feat(frontend): add ChatPanel and chat feature entry"
```

---

## Task 12: Chat button + unread badge in `ControlsBar`

**Files:**
- Modify: `frontend/src/features/call/components/ControlsBar.tsx`
- Create: `frontend/src/features/call/components/ControlsBar.chat.test.tsx`

**Interfaces:**
- The call feature reads chat panel state from `useChatStore` (a store, not the chat feature) — no cross-feature import.

- [ ] **Step 1: Replace `frontend/src/features/call/components/ControlsBar.tsx`**

```tsx
import type { JSX } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalParticipant } from '@livekit/components-react';
import { Toggle } from '../../../shared/ui/Toggle';
import { Button } from '../../../shared/ui/Button';
import { useMediaStore } from '../../../stores/useMediaStore';
import { useChatStore } from '../../../stores/useChatStore';

export type ControlsBarProps = { onLeave: () => void };

export function ControlsBar({ onLeave }: ControlsBarProps): JSX.Element {
  const { t } = useTranslation('call');
  const { t: tc } = useTranslation('chat');
  const { localParticipant } = useLocalParticipant();
  const isMicOn = useMediaStore((s) => s.isMicOn);
  const isCamOn = useMediaStore((s) => s.isCamOn);
  const setMicOn = useMediaStore((s) => s.setMicOn);
  const setCamOn = useMediaStore((s) => s.setCamOn);
  const isPanelOpen = useChatStore((s) => s.isPanelOpen);
  const unreadCount = useChatStore((s) => s.unreadCount);
  const openPanel = useChatStore((s) => s.openPanel);
  const closePanel = useChatStore((s) => s.closePanel);

  // Reconcile published tracks with the store's desired state.
  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(isMicOn);
  }, [localParticipant, isMicOn]);

  useEffect(() => {
    void localParticipant.setCameraEnabled(isCamOn);
  }, [localParticipant, isCamOn]);

  return (
    <div className="flex items-center justify-center gap-3 p-4">
      <Toggle label={t('micToggle')} pressed={isMicOn} onChange={setMicOn} />
      <Toggle label={t('cameraToggle')} pressed={isCamOn} onChange={setCamOn} />
      <button
        type="button"
        aria-label={tc('openChat')}
        onClick={() => (isPanelOpen ? closePanel() : openPanel())}
        className="relative rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-muted"
      >
        {tc('openChat')}
        {unreadCount > 0 && (
          <span
            data-testid="chat-unread"
            className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs text-white"
          >
            {unreadCount}
          </span>
        )}
      </button>
      <Button variant="ghost" onClick={onLeave}>
        {t('leave')}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Write the test (`frontend/src/features/call/components/ControlsBar.chat.test.tsx`)**

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '../../../shared/i18n';
import { ControlsBar } from './ControlsBar';
import { useChatStore } from '../../../stores/useChatStore';

// ControlsBar uses the LiveKit local-participant hook; stub it (no room context in this test).
vi.mock('@livekit/components-react', () => ({
  useLocalParticipant: () => ({
    localParticipant: { setMicrophoneEnabled: vi.fn(), setCameraEnabled: vi.fn() },
  }),
}));

describe('ControlsBar chat button', () => {
  beforeEach(() => useChatStore.getState().reset());

  it('shows the unread badge count and clears it on open', async () => {
    useChatStore.setState({ unreadCount: 2 });
    render(<ControlsBar onLeave={vi.fn()} />);
    expect(screen.getByTestId('chat-unread')).toHaveTextContent('2');

    await userEvent.click(screen.getByRole('button', { name: 'Chat' }));
    expect(useChatStore.getState().isPanelOpen).toBe(true);
    expect(useChatStore.getState().unreadCount).toBe(0);
    expect(screen.queryByTestId('chat-unread')).not.toBeInTheDocument();
  });

  it('toggles the panel closed on a second click', async () => {
    render(<ControlsBar onLeave={vi.fn()} />);
    const btn = screen.getByRole('button', { name: 'Chat' });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(useChatStore.getState().isPanelOpen).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/call/components/ControlsBar.chat.test.tsx`
Expected: PASS (2 tests). Also run the existing `ControlsBar.test.tsx` to confirm no regression:
Run: `cd frontend && npx vitest run src/features/call/components/ControlsBar.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/call/components/ControlsBar.tsx frontend/src/features/call/components/ControlsBar.chat.test.tsx
git commit -m "feat(frontend): add chat toggle button with unread badge to controls bar"
```

---

## Task 13: Wire the chat panel into the app + final verification

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `ChatPanel` (chat feature), `useChatStore`, existing `JoinResponse.role`.

- [ ] **Step 1: Update `frontend/src/App.tsx`**

Add the imports (top of the file, with the other feature imports):
```tsx
import { ChatPanel } from './features/chat';
import { useChatStore } from './stores/useChatStore';
```

Add a chat-store reset selector alongside the existing reset selectors:
```tsx
  const resetChat = useChatStore((s) => s.reset);
```

Call it inside `leave` (extend the dependency array too):
```tsx
  const leave = useCallback(() => {
    setSession(null);
    resetConnection();
    resetMedia();
    resetChat();
    recheckCapacity();
  }, [recheckCapacity, resetConnection, resetMedia, resetChat]);
```

Render `<ChatPanel/>` next to `<CallShell/>` in the in-call branch (a fragment, since `App` previously returned a single `CallShell`):
```tsx
  if (view === 'in-call' && session) {
    return (
      <>
        <CallShell
          accessToken={session.accessToken}
          serverUrl={session.livekitUrl}
          displayName={session.displayName}
          onLeave={leave}
          onConnectError={() => setView('connect-error')}
          onRoomFull={() => setView('full')}
        />
        <ChatPanel role={session.role} />
      </>
    );
  }
```

> `App.tsx` is the `app` layer, so rendering the `chat` feature beside the `call` feature here is allowed by the boundary rules. `session.role` is `'guest'` in this subtask (host role deferred — master §4.5).

- [ ] **Step 2: Full frontend suite + lint + typecheck**

Run: `cd frontend && npm run typecheck && npm run lint && npm test`
Expected: all PASS, zero ESLint warnings (including `eslint-plugin-boundaries` — confirm no cross-feature import was introduced).

- [ ] **Step 3: Manual end-to-end smoke (two browsers)**

Run (terminal 1): `livekit-server --dev`
Run (terminal 2): `cd backend && npm run dev`
Run (terminal 3): `cd frontend && npm run dev`
Then open `http://localhost:5173` in two browser windows, join with two different names, open the chat panel in both:
- A message sent in window A appears in window B (and echoes in A as delivered).
- Opening the panel clears the unread badge.
- A second participant who joins after some messages sees the prior history.
Expected: all three behaviors hold.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): mount chat panel in-call and reset chat on leave"
```

---

# Self-Review (spec coverage)

| Spec (`02-text-chat.md`) requirement | Task(s) |
| --- | --- |
| §1 see history on join | 2 (history), 4 (`chat_history`), 9 (`setHistory`), 11/13 (render) |
| §1 input + Send; everyone sees new message | 4 (broadcast), 9–13 |
| §3 `socket.ts`, `chat.ts`, `server.ts` modules | 2, 4, 5 |
| §3.1 `join_chat` binds + verifies membership + emits history | 4 (`handleJoinChat`), 3 (`listParticipants`) |
| §3.1 `send_message` stamps from binding, appends, broadcasts; `message_failed` to sender | 4 (`handleSendMessage`) |
| §3.2 validation: EMPTY_MESSAGE / TEXT_TOO_LONG / NOT_A_MEMBER | 2 (validate), 4 (membership) |
| §3.3 `ChatMessage` shape; history cleared on room end | 2 (`ChatService.clear` implemented & unit-tested but **intentionally not wired** — see "Accepted deferral" below) |
| §4.1 panel, `useChat`, presentational components | 9, 10, 11 |
| §4.2 `useChatStore`: messages, panel, unread, optimistic status | 8 |
| §4.3 flow: join → history → toggle → optimistic → echo/fail | 9, 11, 12, 13 |
| §5 verbatim strings (placeholder/Send/empty/Sending…/Not delivered) | 7, 10 |
| §6 ≤1000 chars; counter from 900; Send enabled on non-empty | 10 (client), 2 (server) |
| §7 backend + frontend tests | every implementation task is TDD |

> **Deferred (confirmed out of scope, per §2):** attachments/paperclip, `grace_tick`/`grace_cancelled`/`room_ended`, `claim_share`/`release_share`/`share_state`, host/guest panel differences. None are implemented here; forward-compat is preserved (`ChatMessage` has no `attachments` field yet; the socket handles only `join_chat`/`send_message`).

> **Accepted deferral — room-end history clearing (spec §3.3 + §8).** Spec §8 states history is
> cleared "when LiveKit reports the room empty / removed." The trigger for that — a LiveKit webhook
> (`room_finished` / room-empty) — belongs to the room-lifecycle layer (grace/host), which is **not
> built in Subtask 1** (`backend/src/` has no `webhooks.ts`) and is explicitly deferred by §2. We
> therefore **accept this deferral as a decision, not an oversight**: `ChatService.clear(roomName)`
> is implemented and unit-tested (Task 2) but left **unwired** until the lifecycle layer lands.
>
> **Known consequence (acceptable for the ephemeral, no-sign-up scope — master §8):** because the
> room is fixed (`main`) and history is in-memory keyed by `roomName`, history is **not** cleared
> when everyone leaves. A fresh set of participants joining later — before a backend restart —
> will see the prior session's chat history via `chat_history` on `join_chat`. This is tolerated
> here; it is closed when room-end teardown wires `chat.clear()` to the LiveKit room-empty/finished
> signal (master §3.3 / §8). No code in this plan depends on clearing happening.

> **Prerequisite flagged (not a task):** CLAUDE.md/specs still say React 18 / Express 4 while the code runs React 19 / Express 5 ([[stack-react19-deviation]]). This plan targets the installed stack. If the team wants the docs reconciled first, do that before executing — it does not change any step here.

---

# Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-29-subtask-2-text-chat.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
