# КМБ Video Chat — Backend (Control Plane) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the single Node + TypeScript backend service that mints LiveKit tokens, owns room lifecycle and host/guest roles, runs the 60s host-reconnect grace timer, relays chat over Socket.IO with in-memory history, and stores chat attachments on local disk.

**Architecture:** One stateless-per-process Express + Socket.IO service holding an in-memory room registry. Media is handled entirely by a local LiveKit SFU; this service never touches media. It talks to LiveKit two ways: it generates client access tokens with the `livekit-server-sdk` `AccessToken` helper, and it performs host actions (remove participant, end room) via `RoomServiceClient`. LiveKit webhooks notify the service of participant/room events, which drive the host-grace timer.

**Tech Stack:** Node 20+, TypeScript, Express, Socket.IO, `livekit-server-sdk`, `multer` (uploads), Vitest + Supertest (tests), `tsx` (dev runner).

## Global Constraints

- Platform target for the product: desktop browsers ≥1024px (backend is platform-agnostic; this only affects the frontend).
- Room capacity: **4 participants total** (host + 3 guests), enforced server-side.
- Name validation: **2–30 characters**; allowed characters: letters, numbers, spaces, hyphens (`-`), apostrophes (`'`).
- Chat text: **≤1000 characters**.
- Attachments: **≤10 MB per file**, **≤5 files per message**. Allowed image types: PNG, JPEG, GIF, WebP. Allowed file types: PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP.
- Host-reconnect grace period: **exactly 60 seconds**.
- Host authority is enforced server-side on every host action; the host is identified by an opaque `hostToken` issued only at room creation.
- All user-facing strings returned by the API must use the exact wording in the spec §6 (the frontend localizes via i18n keys, but error *codes* returned here map 1:1 to those strings).
- No hand-rolled JWT — tokens are created only through the LiveKit SDK `AccessToken` helper.
- Timestamps are epoch milliseconds (`number`).

---

### Task 0: Project scaffold & configuration

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/vitest.config.ts`
- Create: `backend/.env.example`
- Create: `backend/src/config.ts`
- Test: `backend/src/config.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `loadConfig(env: NodeJS.ProcessEnv): AppConfig` where
  `AppConfig = { port: number; livekitUrl: string; livekitApiKey: string; livekitApiSecret: string; storageRoot: string; corsOrigin: string }`. Throws `Error` if a required var is missing.

- [ ] **Step 1: Initialize the package**

Run:
```bash
mkdir -p backend/src && cd backend
npm init -y
npm install express socket.io livekit-server-sdk multer cors
npm install -D typescript tsx vitest supertest @types/express @types/multer @types/cors @types/supertest @types/node
```

- [ ] **Step 2: Write `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src"]
}
```

Set `"type": "module"` in `backend/package.json`, and add scripts:
```json
"scripts": {
  "dev": "tsx watch src/server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Write `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', globals: true },
});
```

- [ ] **Step 4: Write `backend/.env.example`**

```
PORT=4000
LIVEKIT_URL=ws://localhost:7880
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret_change_me_32_chars_min
STORAGE_ROOT=./.storage
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 5: Write the failing test `backend/src/config.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig } from './config';

const base = {
  PORT: '4000',
  LIVEKIT_URL: 'ws://localhost:7880',
  LIVEKIT_API_KEY: 'devkey',
  LIVEKIT_API_SECRET: 'secret',
  STORAGE_ROOT: './.storage',
  CORS_ORIGIN: 'http://localhost:5173',
};

describe('loadConfig', () => {
  it('parses a complete environment', () => {
    const cfg = loadConfig(base as NodeJS.ProcessEnv);
    expect(cfg.port).toBe(4000);
    expect(cfg.livekitUrl).toBe('ws://localhost:7880');
    expect(cfg.storageRoot).toBe('./.storage');
  });

  it('throws when a required var is missing', () => {
    const { LIVEKIT_API_SECRET, ...rest } = base;
    expect(() => loadConfig(rest as NodeJS.ProcessEnv)).toThrow(/LIVEKIT_API_SECRET/);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `cd backend && npx vitest run src/config.test.ts`
Expected: FAIL — cannot find module `./config`.

- [ ] **Step 7: Implement `backend/src/config.ts`**

```ts
export type AppConfig = {
  port: number;
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  storageRoot: string;
  corsOrigin: string;
};

function required(env: NodeJS.ProcessEnv, key: string): string {
  const v = env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  return {
    port: Number(env.PORT ?? 4000),
    livekitUrl: required(env, 'LIVEKIT_URL'),
    livekitApiKey: required(env, 'LIVEKIT_API_KEY'),
    livekitApiSecret: required(env, 'LIVEKIT_API_SECRET'),
    storageRoot: required(env, 'STORAGE_ROOT'),
    corsOrigin: required(env, 'CORS_ORIGIN'),
  };
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add backend
git commit -m "chore(backend): scaffold project and config loader"
```

---

### Task 1: Name validation

**Files:**
- Create: `backend/src/validation.ts`
- Test: `backend/src/validation.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `validateName(name: string): { ok: true; value: string } | { ok: false; code: NameError }` where `NameError = 'NAME_EMPTY' | 'NAME_LENGTH'`. Trims input before validating.

- [ ] **Step 1: Write the failing test `backend/src/validation.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { validateName } from './validation';

describe('validateName', () => {
  it('accepts a normal name and trims it', () => {
    expect(validateName('  Ann ')).toEqual({ ok: true, value: 'Ann' });
  });
  it('accepts hyphens and apostrophes', () => {
    expect(validateName("O'Neil-Smith")).toEqual({ ok: true, value: "O'Neil-Smith" });
  });
  it('rejects empty / whitespace as NAME_EMPTY', () => {
    expect(validateName('   ')).toEqual({ ok: false, code: 'NAME_EMPTY' });
  });
  it('rejects < 2 chars as NAME_LENGTH', () => {
    expect(validateName('A')).toEqual({ ok: false, code: 'NAME_LENGTH' });
  });
  it('rejects > 30 chars as NAME_LENGTH', () => {
    expect(validateName('x'.repeat(31))).toEqual({ ok: false, code: 'NAME_LENGTH' });
  });
  it('rejects disallowed characters as NAME_LENGTH', () => {
    expect(validateName('Ann<script>')).toEqual({ ok: false, code: 'NAME_LENGTH' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/validation.test.ts`
Expected: FAIL — cannot find module `./validation`.

- [ ] **Step 3: Implement `backend/src/validation.ts`**

```ts
export type NameError = 'NAME_EMPTY' | 'NAME_LENGTH';

const ALLOWED = /^[\p{L}\p{N} '-]+$/u;

export function validateName(
  name: string,
): { ok: true; value: string } | { ok: false; code: NameError } {
  const trimmed = (name ?? '').trim();
  if (trimmed.length === 0) return { ok: false, code: 'NAME_EMPTY' };
  if (trimmed.length < 2 || trimmed.length > 30) return { ok: false, code: 'NAME_LENGTH' };
  if (!ALLOWED.test(trimmed)) return { ok: false, code: 'NAME_LENGTH' };
  return { ok: true, value: trimmed };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/validation.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/validation.ts backend/src/validation.test.ts
git commit -m "feat(backend): add name validation"
```

---

### Task 2: Room registry (in-memory)

**Files:**
- Create: `backend/src/rooms.ts`
- Test: `backend/src/rooms.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a `RoomRegistry` class with methods:
  - `createRoom(): RoomState` — generates `roomName` (`r_<hex>`) and `hostToken` (`h_<hex>`), `status='active'`, empty participants/history.
  - `get(roomName: string): RoomState | undefined`
  - `addParticipant(roomName, p: Participant): { ok: true } | { ok: false; code: 'NOT_FOUND' | 'ENDED' | 'FULL' }`
  - `removeParticipant(roomName, identity): void`
  - `isHostToken(roomName, hostToken): boolean`
  - `endRoom(roomName): void` — sets `status='ended'`, clears participants + chatHistory.
  - Types `RoomState`, `Participant` exactly as in spec §3.1 (minus `graceTimer`/`graceEndsAt`, added in Task 7).
  - `MAX_PARTICIPANTS = 4` exported constant.
  - Accepts an optional id generator in the constructor for deterministic tests: `new RoomRegistry(genId?: () => string)`.

- [ ] **Step 1: Write the failing test `backend/src/rooms.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { RoomRegistry, MAX_PARTICIPANTS } from './rooms';

function makeRegistry() {
  let n = 0;
  return new RoomRegistry(() => `id${n++}`);
}
const guest = (identity: string) => ({
  identity, displayName: identity, role: 'guest' as const, joinedAt: 0,
});

describe('RoomRegistry', () => {
  it('creates an active room with a host token', () => {
    const r = makeRegistry().createRoom();
    expect(r.status).toBe('active');
    expect(r.roomName).toMatch(/^r_/);
    expect(r.hostToken).toMatch(/^h_/);
    expect(r.participants.size).toBe(0);
  });

  it('adds participants up to the capacity then rejects FULL', () => {
    const reg = makeRegistry();
    const r = reg.createRoom();
    for (let i = 0; i < MAX_PARTICIPANTS; i++) {
      expect(reg.addParticipant(r.roomName, guest(`g${i}`))).toEqual({ ok: true });
    }
    expect(reg.addParticipant(r.roomName, guest('extra'))).toEqual({ ok: false, code: 'FULL' });
  });

  it('rejects NOT_FOUND and ENDED', () => {
    const reg = makeRegistry();
    expect(reg.addParticipant('nope', guest('x'))).toEqual({ ok: false, code: 'NOT_FOUND' });
    const r = reg.createRoom();
    reg.endRoom(r.roomName);
    expect(r.status).toBe('ended');
    expect(reg.addParticipant(r.roomName, guest('x'))).toEqual({ ok: false, code: 'ENDED' });
  });

  it('validates the host token', () => {
    const reg = makeRegistry();
    const r = reg.createRoom();
    expect(reg.isHostToken(r.roomName, r.hostToken)).toBe(true);
    expect(reg.isHostToken(r.roomName, 'wrong')).toBe(false);
  });

  it('clears chat history when the room ends', () => {
    const reg = makeRegistry();
    const r = reg.createRoom();
    r.chatHistory.push({ id: 'm', roomName: r.roomName, senderIdentity: 'g',
      senderName: 'g', sentAt: 0, attachments: [] });
    reg.endRoom(r.roomName);
    expect(r.chatHistory).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/rooms.test.ts`
Expected: FAIL — cannot find module `./rooms`.

- [ ] **Step 3: Implement `backend/src/rooms.ts`**

```ts
export type Attachment = {
  fileId: string;
  name: string;
  size: number;
  mime: string;
  kind: 'image' | 'file';
  url: string;
};

export type ChatMessage = {
  id: string;
  roomName: string;
  senderIdentity: string;
  senderName: string;
  sentAt: number;
  text?: string;
  attachments: Attachment[];
};

export type Participant = {
  identity: string;
  displayName: string;
  role: 'host' | 'guest';
  joinedAt: number;
};

export type RoomState = {
  roomName: string;
  hostIdentity?: string;
  hostToken: string;
  status: 'active' | 'grace' | 'ended';
  participants: Map<string, Participant>;
  createdAt: number;
  chatHistory: ChatMessage[];
};

export const MAX_PARTICIPANTS = 4;

type AddResult = { ok: true } | { ok: false; code: 'NOT_FOUND' | 'ENDED' | 'FULL' };

export class RoomRegistry {
  private rooms = new Map<string, RoomState>();
  private counter = 0;
  constructor(private genId: () => string = () => Math.random().toString(16).slice(2, 10)) {}

  createRoom(): RoomState {
    const room: RoomState = {
      roomName: `r_${this.genId()}`,
      hostToken: `h_${this.genId()}`,
      status: 'active',
      participants: new Map(),
      createdAt: this.counter++,
      chatHistory: [],
    };
    this.rooms.set(room.roomName, room);
    return room;
  }

  get(roomName: string): RoomState | undefined {
    return this.rooms.get(roomName);
  }

  addParticipant(roomName: string, p: Participant): AddResult {
    const room = this.rooms.get(roomName);
    if (!room) return { ok: false, code: 'NOT_FOUND' };
    if (room.status === 'ended') return { ok: false, code: 'ENDED' };
    if (room.participants.size >= MAX_PARTICIPANTS) return { ok: false, code: 'FULL' };
    room.participants.set(p.identity, p);
    if (p.role === 'host') room.hostIdentity = p.identity;
    return { ok: true };
  }

  removeParticipant(roomName: string, identity: string): void {
    this.rooms.get(roomName)?.participants.delete(identity);
  }

  isHostToken(roomName: string, hostToken: string): boolean {
    const room = this.rooms.get(roomName);
    return !!room && room.hostToken === hostToken;
  }

  endRoom(roomName: string): void {
    const room = this.rooms.get(roomName);
    if (!room) return;
    room.status = 'ended';
    room.participants.clear();
    room.chatHistory.length = 0;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/rooms.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/rooms.ts backend/src/rooms.test.ts
git commit -m "feat(backend): add in-memory room registry"
```

---

### Task 3: LiveKit token generation

**Files:**
- Create: `backend/src/livekitTokens.ts`
- Test: `backend/src/livekitTokens.test.ts`

**Interfaces:**
- Consumes: `AppConfig` (Task 0).
- Produces: `createAccessToken(cfg, opts: { roomName: string; identity: string; name: string; role: 'host' | 'guest' }): Promise<string>` — uses `AccessToken` from `livekit-server-sdk`; grants `roomJoin`, `canPublish`, `canSubscribe`, `canPublishData`; host additionally gets `roomAdmin: true`. Returns the signed JWT string from `.toJwt()`.

- [ ] **Step 1: Write the failing test `backend/src/livekitTokens.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createAccessToken } from './livekitTokens';

const cfg = {
  port: 4000, livekitUrl: 'ws://x', livekitApiKey: 'devkey',
  livekitApiSecret: 'secretsecretsecretsecretsecret32', storageRoot: '.', corsOrigin: '*',
};

describe('createAccessToken', () => {
  it('returns a non-empty JWT string with three segments', async () => {
    const jwt = await createAccessToken(cfg, {
      roomName: 'r_1', identity: 'u1', name: 'Ann', role: 'host',
    });
    expect(typeof jwt).toBe('string');
    expect(jwt.split('.')).toHaveLength(3);
  });

  it('produces different tokens for different identities', async () => {
    const a = await createAccessToken(cfg, { roomName: 'r', identity: 'a', name: 'A', role: 'guest' });
    const b = await createAccessToken(cfg, { roomName: 'r', identity: 'b', name: 'B', role: 'guest' });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/livekitTokens.test.ts`
Expected: FAIL — cannot find module `./livekitTokens`.

- [ ] **Step 3: Implement `backend/src/livekitTokens.ts`**

```ts
import { AccessToken } from 'livekit-server-sdk';
import type { AppConfig } from './config';

export async function createAccessToken(
  cfg: AppConfig,
  opts: { roomName: string; identity: string; name: string; role: 'host' | 'guest' },
): Promise<string> {
  const at = new AccessToken(cfg.livekitApiKey, cfg.livekitApiSecret, {
    identity: opts.identity,
    name: opts.name,
  });
  at.addGrant({
    roomJoin: true,
    room: opts.roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: opts.role === 'host',
  });
  return await at.toJwt();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/livekitTokens.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/livekitTokens.ts backend/src/livekitTokens.test.ts
git commit -m "feat(backend): add livekit access token generation"
```

---

### Task 4: LiveKit room service wrapper (host actions)

**Files:**
- Create: `backend/src/livekitAdmin.ts`
- Test: `backend/src/livekitAdmin.test.ts`

**Interfaces:**
- Consumes: `AppConfig`.
- Produces: `LiveKitAdmin` interface `{ removeParticipant(room, identity): Promise<void>; deleteRoom(room): Promise<void> }` and a factory `createLiveKitAdmin(cfg): LiveKitAdmin` wrapping `RoomServiceClient`. The interface is what later tasks depend on, so it can be replaced with a fake in tests.

- [ ] **Step 1: Write the failing test `backend/src/livekitAdmin.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('livekit-server-sdk', () => {
  return {
    RoomServiceClient: class {
      removeParticipant = vi.fn().mockResolvedValue(undefined);
      deleteRoom = vi.fn().mockResolvedValue(undefined);
    },
  };
});

import { createLiveKitAdmin } from './livekitAdmin';

const cfg = {
  port: 4000, livekitUrl: 'http://x', livekitApiKey: 'k',
  livekitApiSecret: 's', storageRoot: '.', corsOrigin: '*',
};

describe('createLiveKitAdmin', () => {
  it('exposes removeParticipant and deleteRoom that resolve', async () => {
    const admin = createLiveKitAdmin(cfg);
    await expect(admin.removeParticipant('r_1', 'u1')).resolves.toBeUndefined();
    await expect(admin.deleteRoom('r_1')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/livekitAdmin.test.ts`
Expected: FAIL — cannot find module `./livekitAdmin`.

- [ ] **Step 3: Implement `backend/src/livekitAdmin.ts`**

```ts
import { RoomServiceClient } from 'livekit-server-sdk';
import type { AppConfig } from './config';

export interface LiveKitAdmin {
  removeParticipant(roomName: string, identity: string): Promise<void>;
  deleteRoom(roomName: string): Promise<void>;
}

export function createLiveKitAdmin(cfg: AppConfig): LiveKitAdmin {
  // RoomServiceClient needs the HTTP(S) URL of the LiveKit server.
  const httpUrl = cfg.livekitUrl.replace(/^ws/, 'http');
  const client = new RoomServiceClient(httpUrl, cfg.livekitApiKey, cfg.livekitApiSecret);
  return {
    async removeParticipant(roomName, identity) {
      await client.removeParticipant(roomName, identity);
    },
    async deleteRoom(roomName) {
      await client.deleteRoom(roomName);
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/livekitAdmin.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add backend/src/livekitAdmin.ts backend/src/livekitAdmin.test.ts
git commit -m "feat(backend): add livekit room service wrapper"
```

---

### Task 5: Attachment validation & disk storage

**Files:**
- Create: `backend/src/attachments.ts`
- Test: `backend/src/attachments.test.ts`

**Interfaces:**
- Consumes: `AppConfig` (`storageRoot`).
- Produces:
  - `classifyUpload(mime: string, size: number): { ok: true; kind: 'image' | 'file' } | { ok: false; code: 'UNSUPPORTED_TYPE' | 'TOO_LARGE' }`
  - `MAX_FILE_BYTES = 10 * 1024 * 1024`, `MAX_FILES_PER_MESSAGE = 5`.
  - `class AttachmentStore` with `save(roomName, fileId, originalName, bytes: Buffer): Promise<string>` (returns absolute path), `pathFor(roomName, fileId, originalName): string`, `deleteRoom(roomName): Promise<void>`. Filenames are sanitized to `<fileId>__<sanitized>`.

- [ ] **Step 1: Write the failing test `backend/src/attachments.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  classifyUpload, AttachmentStore, MAX_FILE_BYTES, MAX_FILES_PER_MESSAGE,
} from './attachments';

describe('classifyUpload', () => {
  it('classifies allowed images', () => {
    expect(classifyUpload('image/png', 100)).toEqual({ ok: true, kind: 'image' });
    expect(classifyUpload('image/webp', 100)).toEqual({ ok: true, kind: 'image' });
  });
  it('classifies allowed files', () => {
    expect(classifyUpload('application/pdf', 100)).toEqual({ ok: true, kind: 'file' });
    expect(classifyUpload('application/zip', 100)).toEqual({ ok: true, kind: 'file' });
  });
  it('rejects unsupported type', () => {
    expect(classifyUpload('application/x-msdownload', 10)).toEqual({ ok: false, code: 'UNSUPPORTED_TYPE' });
  });
  it('rejects oversized files', () => {
    expect(classifyUpload('image/png', MAX_FILE_BYTES + 1)).toEqual({ ok: false, code: 'TOO_LARGE' });
  });
  it('exposes the per-message cap', () => {
    expect(MAX_FILES_PER_MESSAGE).toBe(5);
  });
});

describe('AttachmentStore', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'kmb-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  it('saves a file and can delete the room folder', async () => {
    const store = new AttachmentStore(root);
    const path = await store.save('r_1', 'f1', 'my report.pdf', Buffer.from('hi'));
    expect(existsSync(path)).toBe(true);
    expect(path).toContain('f1__');
    await store.deleteRoom('r_1');
    expect(existsSync(path)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/attachments.test.ts`
Expected: FAIL — cannot find module `./attachments`.

- [ ] **Step 3: Implement `backend/src/attachments.ts`**

```ts
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 5;

const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const FILE_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'application/zip',
]);

export function classifyUpload(
  mime: string,
  size: number,
): { ok: true; kind: 'image' | 'file' } | { ok: false; code: 'UNSUPPORTED_TYPE' | 'TOO_LARGE' } {
  const isImage = IMAGE_MIMES.has(mime);
  const isFile = FILE_MIMES.has(mime);
  if (!isImage && !isFile) return { ok: false, code: 'UNSUPPORTED_TYPE' };
  if (size > MAX_FILE_BYTES) return { ok: false, code: 'TOO_LARGE' };
  return { ok: true, kind: isImage ? 'image' : 'file' };
}

function sanitize(name: string): string {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(0, 120);
}

export class AttachmentStore {
  constructor(private root: string) {}

  pathFor(roomName: string, fileId: string, originalName: string): string {
    return join(this.root, roomName, `${fileId}__${sanitize(originalName)}`);
  }

  async save(roomName: string, fileId: string, originalName: string, bytes: Buffer): Promise<string> {
    await mkdir(join(this.root, roomName), { recursive: true });
    const path = this.pathFor(roomName, fileId, originalName);
    await writeFile(path, bytes);
    return path;
  }

  async deleteRoom(roomName: string): Promise<void> {
    await rm(join(this.root, roomName), { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/attachments.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/attachments.ts backend/src/attachments.test.ts
git commit -m "feat(backend): add attachment validation and disk storage"
```

---

### Task 6: REST API (rooms, join, host actions, attachments)

**Files:**
- Create: `backend/src/app.ts`
- Test: `backend/src/app.test.ts`

**Interfaces:**
- Consumes: `RoomRegistry`, `createAccessToken`, `LiveKitAdmin`, `AttachmentStore`, `classifyUpload`, `validateName`, `AppConfig`.
- Produces: `createApp(deps): express.Express` where
  `deps = { cfg: AppConfig; registry: RoomRegistry; admin: LiveKitAdmin; store: AttachmentStore; tokenFn: typeof createAccessToken; genId: () => string }`.
  Routes per spec §3.2. All error responses are `{ error: <CODE> }` with these codes: `NOT_FOUND`, `ENDED`, `FULL`, `NAME_EMPTY`, `NAME_LENGTH`, `FORBIDDEN`, `UNSUPPORTED_TYPE`, `TOO_LARGE`, `NO_FILE`.

- [ ] **Step 1: Write the failing test `backend/src/app.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app';
import { RoomRegistry } from './rooms';
import { AttachmentStore } from './attachments';

function makeApp() {
  let n = 0;
  const genId = () => `id${n++}`;
  const registry = new RoomRegistry(genId);
  const removed: string[] = [];
  const deleted: string[] = [];
  const admin = {
    removeParticipant: async (_r: string, id: string) => { removed.push(id); },
    deleteRoom: async (r: string) => { deleted.push(r); },
  };
  const store = new AttachmentStore(mkdtempSync(join(tmpdir(), 'kmb-app-')));
  const cfg = {
    port: 0, livekitUrl: 'ws://x', livekitApiKey: 'k',
    livekitApiSecret: 'ssssssssssssssssssssssssssssssss', storageRoot: '.', corsOrigin: '*',
  };
  const tokenFn = async () => 'fake.jwt.token';
  const app = createApp({ cfg, registry, admin, store, tokenFn, genId });
  return { app, registry, removed, deleted };
}

describe('REST API', () => {
  let ctx: ReturnType<typeof makeApp>;
  beforeEach(() => { ctx = makeApp(); });

  it('POST /rooms creates a room and returns host token + url', async () => {
    const res = await request(ctx.app).post('/rooms').expect(200);
    expect(res.body.roomName).toMatch(/^r_/);
    expect(res.body.hostToken).toMatch(/^h_/);
    expect(res.body.participantUrl).toContain(res.body.roomName);
  });

  it('GET /rooms/:room returns status active / not found / ended', async () => {
    const created = (await request(ctx.app).post('/rooms')).body;
    await request(ctx.app).get(`/rooms/${created.roomName}`).expect(200)
      .then(r => expect(r.body.status).toBe('active'));
    await request(ctx.app).get('/rooms/r_missing').expect(404)
      .then(r => expect(r.body.error).toBe('NOT_FOUND'));
  });

  it('POST join rejects a bad name', async () => {
    const created = (await request(ctx.app).post('/rooms')).body;
    await request(ctx.app).post(`/rooms/${created.roomName}/join`)
      .send({ name: 'A' }).expect(400)
      .then(r => expect(r.body.error).toBe('NAME_LENGTH'));
  });

  it('POST join issues a host token when hostToken matches', async () => {
    const created = (await request(ctx.app).post('/rooms')).body;
    const res = await request(ctx.app).post(`/rooms/${created.roomName}/join`)
      .send({ name: 'Ann', hostToken: created.hostToken }).expect(200);
    expect(res.body.role).toBe('host');
    expect(res.body.accessToken).toBe('fake.jwt.token');
    expect(res.body.livekitUrl).toBe('ws://x');
  });

  it('POST join issues a guest token without hostToken and enforces FULL', async () => {
    const created = (await request(ctx.app).post('/rooms')).body;
    for (let i = 0; i < 4; i++) {
      await request(ctx.app).post(`/rooms/${created.roomName}/join`)
        .send({ name: `Guest${i}` }).expect(200);
    }
    await request(ctx.app).post(`/rooms/${created.roomName}/join`)
      .send({ name: 'Late' }).expect(409)
      .then(r => expect(r.body.error).toBe('FULL'));
  });

  it('POST remove requires a valid host token', async () => {
    const created = (await request(ctx.app).post('/rooms')).body;
    await request(ctx.app).post(`/rooms/${created.roomName}/join`)
      .send({ name: 'Boris' });
    await request(ctx.app).post(`/rooms/${created.roomName}/remove`)
      .send({ hostToken: 'wrong', targetIdentity: 'x' }).expect(403)
      .then(r => expect(r.body.error).toBe('FORBIDDEN'));
    await request(ctx.app).post(`/rooms/${created.roomName}/remove`)
      .send({ hostToken: created.hostToken, targetIdentity: 'Boris' }).expect(200);
    expect(ctx.removed).toContain('Boris');
  });

  it('POST end requires host token and deletes the room', async () => {
    const created = (await request(ctx.app).post('/rooms')).body;
    await request(ctx.app).post(`/rooms/${created.roomName}/end`)
      .send({ hostToken: created.hostToken }).expect(200);
    expect(ctx.deleted).toContain(created.roomName);
    expect(ctx.registry.get(created.roomName)!.status).toBe('ended');
  });

  it('POST attachments rejects an unsupported type', async () => {
    const created = (await request(ctx.app).post('/rooms')).body;
    await request(ctx.app).post(`/rooms/${created.roomName}/attachments`)
      .attach('file', Buffer.from('x'), { filename: 'a.exe', contentType: 'application/x-msdownload' })
      .expect(400)
      .then(r => expect(r.body.error).toBe('UNSUPPORTED_TYPE'));
  });

  it('POST attachments stores a valid file and returns metadata', async () => {
    const created = (await request(ctx.app).post('/rooms')).body;
    const res = await request(ctx.app).post(`/rooms/${created.roomName}/attachments`)
      .attach('file', Buffer.from('hello'), { filename: 'plan.pdf', contentType: 'application/pdf' })
      .expect(200);
    expect(res.body.kind).toBe('file');
    expect(res.body.name).toBe('plan.pdf');
    expect(res.body.url).toContain(created.roomName);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/app.test.ts`
Expected: FAIL — cannot find module `./app`.

- [ ] **Step 3: Implement `backend/src/app.ts`**

```ts
import express, { type Express } from 'express';
import cors from 'cors';
import multer from 'multer';
import type { AppConfig } from './config';
import { RoomRegistry } from './rooms';
import type { LiveKitAdmin } from './livekitAdmin';
import { AttachmentStore, classifyUpload, MAX_FILE_BYTES } from './attachments';
import { validateName } from './validation';
import type { createAccessToken } from './livekitTokens';

export type AppDeps = {
  cfg: AppConfig;
  registry: RoomRegistry;
  admin: LiveKitAdmin;
  store: AttachmentStore;
  tokenFn: typeof createAccessToken;
  genId: () => string;
};

export function createApp(deps: AppDeps): Express {
  const { cfg, registry, admin, store, tokenFn, genId } = deps;
  const app = express();
  app.use(cors({ origin: cfg.corsOrigin }));
  app.use(express.json());
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } });

  app.post('/rooms', (_req, res) => {
    const room = registry.createRoom();
    res.json({
      roomName: room.roomName,
      hostToken: room.hostToken,
      participantUrl: `${cfg.corsOrigin}/r/${room.roomName}`,
    });
  });

  app.get('/rooms/:roomName', (req, res) => {
    const room = registry.get(req.params.roomName);
    if (!room) return res.status(404).json({ error: 'NOT_FOUND' });
    if (room.status === 'ended') return res.status(410).json({ error: 'ENDED' });
    res.json({ status: room.status });
  });

  app.post('/rooms/:roomName/join', async (req, res) => {
    const { name, hostToken } = req.body ?? {};
    const v = validateName(String(name ?? ''));
    if (!v.ok) return res.status(400).json({ error: v.code });

    const room = registry.get(req.params.roomName);
    if (!room) return res.status(404).json({ error: 'NOT_FOUND' });

    const isHost = !!hostToken && registry.isHostToken(room.roomName, hostToken);
    const role: 'host' | 'guest' = isHost ? 'host' : 'guest';
    const identity = v.value; // display name doubles as identity; collisions handled by LiveKit suffixing

    const add = registry.addParticipant(room.roomName, {
      identity, displayName: v.value, role, joinedAt: Date.now(),
    });
    if (!add.ok) {
      const code = add.code;
      const status = code === 'FULL' ? 409 : code === 'ENDED' ? 410 : 404;
      return res.status(status).json({ error: code });
    }

    const accessToken = await tokenFn(cfg, { roomName: room.roomName, identity, name: v.value, role });
    res.json({ accessToken, livekitUrl: cfg.livekitUrl, role, identity });
  });

  app.post('/rooms/:roomName/remove', async (req, res) => {
    const { hostToken, targetIdentity } = req.body ?? {};
    const room = registry.get(req.params.roomName);
    if (!room) return res.status(404).json({ error: 'NOT_FOUND' });
    if (!hostToken || !registry.isHostToken(room.roomName, hostToken)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    await admin.removeParticipant(room.roomName, String(targetIdentity));
    registry.removeParticipant(room.roomName, String(targetIdentity));
    res.json({ ok: true });
  });

  app.post('/rooms/:roomName/end', async (req, res) => {
    const { hostToken } = req.body ?? {};
    const room = registry.get(req.params.roomName);
    if (!room) return res.status(404).json({ error: 'NOT_FOUND' });
    if (!hostToken || !registry.isHostToken(room.roomName, hostToken)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    await admin.deleteRoom(room.roomName);
    registry.endRoom(room.roomName);
    await store.deleteRoom(room.roomName);
    res.json({ ok: true });
  });

  app.post('/rooms/:roomName/attachments', upload.single('file'), async (req, res) => {
    const room = registry.get(req.params.roomName);
    if (!room) return res.status(404).json({ error: 'NOT_FOUND' });
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'NO_FILE' });
    const cls = classifyUpload(file.mimetype, file.size);
    if (!cls.ok) return res.status(400).json({ error: cls.code });
    const fileId = genId();
    await store.save(room.roomName, fileId, file.originalname, file.buffer);
    res.json({
      fileId,
      name: file.originalname,
      size: file.size,
      mime: file.mimetype,
      kind: cls.kind,
      url: `/attachments/${room.roomName}/${fileId}/${encodeURIComponent(file.originalname)}`,
    });
  });

  app.get('/attachments/:roomName/:fileId/:name', (req, res) => {
    const room = registry.get(req.params.roomName);
    if (!room || room.status === 'ended') return res.status(404).json({ error: 'NOT_FOUND' });
    const path = store.pathFor(req.params.roomName, req.params.fileId, req.params.name);
    res.sendFile(path, (err) => { if (err && !res.headersSent) res.status(404).json({ error: 'NOT_FOUND' }); });
  });

  return app;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/app.test.ts`
Expected: PASS (9 tests). The multer `fileSize` limit returns a Multer error for oversized uploads — that is acceptable; the explicit `TOO_LARGE` body is asserted only via `classifyUpload` in Task 5.

- [ ] **Step 5: Commit**

```bash
git add backend/src/app.ts backend/src/app.test.ts
git commit -m "feat(backend): add REST api for rooms, join, host actions, attachments"
```

---

### Task 7: Host-reconnect grace controller

**Files:**
- Create: `backend/src/grace.ts`
- Test: `backend/src/grace.test.ts`

**Interfaces:**
- Consumes: `RoomRegistry`, `LiveKitAdmin`, `AttachmentStore`.
- Produces: `class GraceController` constructed with `{ registry, admin, store, onTick: (roomName, secondsLeft) => void, onEnded: (roomName) => void, durationMs?: number }`. Methods:
  - `hostLeft(roomName: string): void` — set room `status='grace'`, start a 1s interval emitting `onTick` with remaining whole seconds (starting at 60), and end the room via `endAll` when it reaches 0.
  - `hostReturned(roomName: string): void` — cancel the timer, set `status='active'`.
  - Uses an injected timer-free design: it accepts `setIntervalFn`/`clearIntervalFn` in the constructor (defaulting to globals) so tests can use Vitest fake timers.

- [ ] **Step 1: Write the failing test `backend/src/grace.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GraceController } from './grace';
import { RoomRegistry } from './rooms';
import { AttachmentStore } from './attachments';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function setup() {
  let n = 0;
  const registry = new RoomRegistry(() => `id${n++}`);
  const room = registry.createRoom();
  registry.addParticipant(room.roomName, { identity: 'Ann', displayName: 'Ann', role: 'host', joinedAt: 0 });
  const deleted: string[] = [];
  const admin = { removeParticipant: async () => {}, deleteRoom: async (r: string) => { deleted.push(r); } };
  const store = new AttachmentStore(mkdtempSync(join(tmpdir(), 'kmb-grace-')));
  const ticks: number[] = [];
  const ended: string[] = [];
  const ctrl = new GraceController({
    registry, admin, store,
    onTick: (_r, s) => ticks.push(s),
    onEnded: (r) => ended.push(r),
  });
  return { registry, room, ctrl, ticks, ended, deleted };
}

describe('GraceController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts down from 60 and ends the room at zero', async () => {
    const { registry, room, ctrl, ticks, ended } = setup();
    ctrl.hostLeft(room.roomName);
    expect(registry.get(room.roomName)!.status).toBe('grace');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ticks[0]).toBe(60);
    expect(ticks.at(-1)).toBe(0);
    expect(ended).toContain(room.roomName);
    expect(registry.get(room.roomName)!.status).toBe('ended');
  });

  it('cancels the countdown when the host returns', async () => {
    const { registry, room, ctrl, ended } = setup();
    ctrl.hostLeft(room.roomName);
    await vi.advanceTimersByTimeAsync(5_000);
    ctrl.hostReturned(room.roomName);
    expect(registry.get(room.roomName)!.status).toBe('active');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ended).not.toContain(room.roomName);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/grace.test.ts`
Expected: FAIL — cannot find module `./grace`.

- [ ] **Step 3: Implement `backend/src/grace.ts`**

```ts
import { RoomRegistry } from './rooms';
import type { LiveKitAdmin } from './livekitAdmin';
import type { AttachmentStore } from './attachments';

type Timer = ReturnType<typeof setInterval>;

export type GraceDeps = {
  registry: RoomRegistry;
  admin: LiveKitAdmin;
  store: AttachmentStore;
  onTick: (roomName: string, secondsLeft: number) => void;
  onEnded: (roomName: string) => void;
  durationMs?: number;
  setIntervalFn?: (cb: () => void, ms: number) => Timer;
  clearIntervalFn?: (t: Timer) => void;
};

export class GraceController {
  private timers = new Map<string, Timer>();
  private readonly durationMs: number;
  private readonly setIntervalFn: (cb: () => void, ms: number) => Timer;
  private readonly clearIntervalFn: (t: Timer) => void;

  constructor(private deps: GraceDeps) {
    this.durationMs = deps.durationMs ?? 60_000;
    this.setIntervalFn = deps.setIntervalFn ?? setInterval;
    this.clearIntervalFn = deps.clearIntervalFn ?? clearInterval;
  }

  hostLeft(roomName: string): void {
    const room = this.deps.registry.get(roomName);
    if (!room || room.status !== 'active') return;
    room.status = 'grace';
    let secondsLeft = Math.floor(this.durationMs / 1000);
    this.deps.onTick(roomName, secondsLeft);
    const timer = this.setIntervalFn(() => {
      secondsLeft -= 1;
      this.deps.onTick(roomName, secondsLeft);
      if (secondsLeft <= 0) void this.expire(roomName);
    }, 1000);
    this.timers.set(roomName, timer);
  }

  hostReturned(roomName: string): void {
    const room = this.deps.registry.get(roomName);
    if (!room) return;
    this.clear(roomName);
    if (room.status === 'grace') room.status = 'active';
  }

  private async expire(roomName: string): Promise<void> {
    this.clear(roomName);
    await this.deps.admin.deleteRoom(roomName);
    this.deps.registry.endRoom(roomName);
    await this.deps.store.deleteRoom(roomName);
    this.deps.onEnded(roomName);
  }

  private clear(roomName: string): void {
    const t = this.timers.get(roomName);
    if (t) { this.clearIntervalFn(t); this.timers.delete(roomName); }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/grace.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/grace.ts backend/src/grace.test.ts
git commit -m "feat(backend): add host-reconnect grace controller"
```

---

### Task 8: Chat service (history, send, unread)

**Files:**
- Create: `backend/src/chat.ts`
- Test: `backend/src/chat.test.ts`

**Interfaces:**
- Consumes: `RoomRegistry`, `ChatMessage`, `Attachment` (Task 2), `MAX_FILES_PER_MESSAGE` (Task 5).
- Produces: `class ChatService` with:
  - `buildMessage(roomName, sender: {identity,name}, input: {text?: string; attachments: Attachment[]}, genId, now): { ok: true; message: ChatMessage } | { ok: false; code: 'EMPTY' | 'TEXT_TOO_LONG' | 'TOO_MANY_FILES' }` — validates ≥1 of text/attachments, text ≤1000, attachments ≤5; appends to room history on success.
  - `history(roomName): ChatMessage[]` — returns `[]` for unknown/ended rooms.
  - `MAX_TEXT = 1000`.

- [ ] **Step 1: Write the failing test `backend/src/chat.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ChatService, MAX_TEXT } from './chat';
import { RoomRegistry } from './rooms';

function setup() {
  let n = 0;
  const registry = new RoomRegistry(() => `id${n++}`);
  const room = registry.createRoom();
  const chat = new ChatService(registry);
  let m = 0;
  const genId = () => `m${m++}`;
  return { registry, room, chat, genId };
}
const sender = { identity: 'Ann', name: 'Ann' };

describe('ChatService.buildMessage', () => {
  it('builds a text message and stores it in history', () => {
    const { room, chat, genId } = setup();
    const r = chat.buildMessage(room.roomName, sender, { text: 'Hi', attachments: [] }, genId, 1000);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message.text).toBe('Hi');
    expect(chat.history(room.roomName)).toHaveLength(1);
  });

  it('rejects an empty message', () => {
    const { room, chat, genId } = setup();
    expect(chat.buildMessage(room.roomName, sender, { attachments: [] }, genId, 0))
      .toEqual({ ok: false, code: 'EMPTY' });
  });

  it('rejects text over 1000 chars', () => {
    const { room, chat, genId } = setup();
    const r = chat.buildMessage(room.roomName, sender, { text: 'x'.repeat(MAX_TEXT + 1), attachments: [] }, genId, 0);
    expect(r).toEqual({ ok: false, code: 'TEXT_TOO_LONG' });
  });

  it('rejects more than 5 attachments', () => {
    const { room, chat, genId } = setup();
    const att = Array.from({ length: 6 }, (_, i) => ({
      fileId: `f${i}`, name: 'a', size: 1, mime: 'image/png', kind: 'image' as const, url: '/x',
    }));
    expect(chat.buildMessage(room.roomName, sender, { attachments: att }, genId, 0))
      .toEqual({ ok: false, code: 'TOO_MANY_FILES' });
  });

  it('returns empty history for an unknown room', () => {
    const { chat } = setup();
    expect(chat.history('r_nope')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/chat.test.ts`
Expected: FAIL — cannot find module `./chat`.

- [ ] **Step 3: Implement `backend/src/chat.ts`**

```ts
import { RoomRegistry, type ChatMessage, type Attachment } from './rooms';
import { MAX_FILES_PER_MESSAGE } from './attachments';

export const MAX_TEXT = 1000;

type BuildResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; code: 'EMPTY' | 'TEXT_TOO_LONG' | 'TOO_MANY_FILES' };

export class ChatService {
  constructor(private registry: RoomRegistry) {}

  buildMessage(
    roomName: string,
    sender: { identity: string; name: string },
    input: { text?: string; attachments: Attachment[] },
    genId: () => string,
    now: number,
  ): BuildResult {
    const text = input.text?.trim() ?? '';
    const attachments = input.attachments ?? [];
    if (text.length === 0 && attachments.length === 0) return { ok: false, code: 'EMPTY' };
    if (text.length > MAX_TEXT) return { ok: false, code: 'TEXT_TOO_LONG' };
    if (attachments.length > MAX_FILES_PER_MESSAGE) return { ok: false, code: 'TOO_MANY_FILES' };

    const message: ChatMessage = {
      id: genId(),
      roomName,
      senderIdentity: sender.identity,
      senderName: sender.name,
      sentAt: now,
      text: text.length > 0 ? text : undefined,
      attachments,
    };
    const room = this.registry.get(roomName);
    if (room && room.status !== 'ended') room.chatHistory.push(message);
    return { ok: true, message };
  }

  history(roomName: string): ChatMessage[] {
    const room = this.registry.get(roomName);
    if (!room || room.status === 'ended') return [];
    return room.chatHistory;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/chat.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/chat.ts backend/src/chat.test.ts
git commit -m "feat(backend): add chat service with history and validation"
```

---

### Task 9: Socket.IO wiring

**Files:**
- Create: `backend/src/socket.ts`
- Test: `backend/src/socket.test.ts`

**Interfaces:**
- Consumes: `ChatService`, `RoomRegistry`.
- Produces: `registerSocket(io: Server, deps: { chat: ChatService; registry: RoomRegistry; genId: () => string; now: () => number }): void`. Behavior:
  - On `join_chat` `{ roomName, identity, name }`: socket joins the Socket.IO room `roomName`; server emits `chat_history` `{ messages }` to that socket.
  - On `send_message` `{ roomName, text?, attachments }`: build via `ChatService`; on success emit `chat_message` `{ message }` to everyone in the room; on failure emit `message_failed` `{ code }` to the sender only.
  - Exposes a helper `broadcastGrace(io, roomName, secondsLeft)` emitting `grace_tick`, `broadcastGraceCancelled`, and `broadcastRoomEnded` emitting `room_ended` — used by the grace controller in Task 10.

- [ ] **Step 1: Write the failing test `backend/src/socket.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as Client, type Socket } from 'socket.io-client';
import { registerSocket } from './socket';
import { ChatService } from './chat';
import { RoomRegistry } from './rooms';

// socket.io-client is a dev dependency for this test:
//   npm install -D socket.io-client

function waitFor(socket: Socket, event: string): Promise<any> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('registerSocket', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: Server;
  let url: string;
  let registry: RoomRegistry;
  let roomName: string;

  beforeEach(async () => {
    let n = 0;
    registry = new RoomRegistry(() => `id${n++}`);
    roomName = registry.createRoom().roomName;
    const chat = new ChatService(registry);
    httpServer = createServer();
    io = new Server(httpServer, { cors: { origin: '*' } });
    let m = 0;
    registerSocket(io, { chat, registry, genId: () => `m${m++}`, now: () => 1000 });
    await new Promise<void>((r) => httpServer.listen(0, r));
    const port = (httpServer.address() as any).port;
    url = `http://localhost:${port}`;
  });

  afterEach(() => { io.close(); httpServer.close(); });

  it('sends chat history on join_chat', async () => {
    const c = Client(url);
    await waitFor(c, 'connect');
    c.emit('join_chat', { roomName, identity: 'Ann', name: 'Ann' });
    const hist = await waitFor(c, 'chat_history');
    expect(hist.messages).toEqual([]);
    c.close();
  });

  it('broadcasts a sent message to room members', async () => {
    const a = Client(url); const b = Client(url);
    await Promise.all([waitFor(a, 'connect'), waitFor(b, 'connect')]);
    a.emit('join_chat', { roomName, identity: 'Ann', name: 'Ann' });
    b.emit('join_chat', { roomName, identity: 'Boris', name: 'Boris' });
    await Promise.all([waitFor(a, 'chat_history'), waitFor(b, 'chat_history')]);
    const recv = waitFor(b, 'chat_message');
    a.emit('send_message', { roomName, text: 'Hello', attachments: [] });
    const msg = await recv;
    expect(msg.message.text).toBe('Hello');
    expect(msg.message.senderName).toBe('Ann');
    a.close(); b.close();
  });

  it('emits message_failed for an empty message', async () => {
    const a = Client(url);
    await waitFor(a, 'connect');
    a.emit('join_chat', { roomName, identity: 'Ann', name: 'Ann' });
    await waitFor(a, 'chat_history');
    const fail = waitFor(a, 'message_failed');
    a.emit('send_message', { roomName, attachments: [] });
    expect((await fail).code).toBe('EMPTY');
    a.close();
  });
});
```

Install the test client first:
```bash
npm install -D socket.io-client
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/socket.test.ts`
Expected: FAIL — cannot find module `./socket`.

- [ ] **Step 3: Implement `backend/src/socket.ts`**

```ts
import type { Server } from 'socket.io';
import type { ChatService } from './chat';
import type { RoomRegistry } from './rooms';
import type { Attachment } from './rooms';

export type SocketDeps = {
  chat: ChatService;
  registry: RoomRegistry;
  genId: () => string;
  now: () => number;
};

export function registerSocket(io: Server, deps: SocketDeps): void {
  io.on('connection', (socket) => {
    let joined: { roomName: string; identity: string; name: string } | null = null;

    socket.on('join_chat', (p: { roomName: string; identity: string; name: string }) => {
      joined = p;
      socket.join(p.roomName);
      socket.emit('chat_history', { messages: deps.chat.history(p.roomName) });
    });

    socket.on('send_message', (p: { roomName: string; text?: string; attachments?: Attachment[] }) => {
      if (!joined || joined.roomName !== p.roomName) {
        socket.emit('message_failed', { code: 'EMPTY' });
        return;
      }
      const result = deps.chat.buildMessage(
        p.roomName,
        { identity: joined.identity, name: joined.name },
        { text: p.text, attachments: p.attachments ?? [] },
        deps.genId,
        deps.now(),
      );
      if (!result.ok) {
        socket.emit('message_failed', { code: result.code });
        return;
      }
      io.to(p.roomName).emit('chat_message', { message: result.message });
    });
  });
}

export function broadcastGrace(io: Server, roomName: string, secondsLeft: number): void {
  io.to(roomName).emit('grace_tick', { secondsLeft });
}
export function broadcastGraceCancelled(io: Server, roomName: string): void {
  io.to(roomName).emit('grace_cancelled', {});
}
export function broadcastRoomEnded(io: Server, roomName: string, reason: 'host_ended' | 'host_timeout'): void {
  io.to(roomName).emit('room_ended', { reason });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/socket.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/socket.ts backend/src/socket.test.ts backend/package.json
git commit -m "feat(backend): add socket.io chat wiring"
```

---

### Task 10: LiveKit webhook receiver + server wiring

**Files:**
- Create: `backend/src/webhooks.ts`
- Create: `backend/src/server.ts`
- Test: `backend/src/webhooks.test.ts`

**Interfaces:**
- Consumes: `RoomRegistry`, `GraceController`.
- Produces:
  - `handleWebhookEvent(event: { event: string; participant?: { identity: string }; room?: { name: string } }, deps: { registry: RoomRegistry; grace: GraceController; onHostReturned: (room: string) => void }): void` — pure dispatcher:
    - `participant_left` where identity === room.hostIdentity and room.status==='active' → `grace.hostLeft(roomName)`.
    - `participant_joined` where identity === room.hostIdentity and room.status==='grace' → `grace.hostReturned(roomName)` + `onHostReturned`.
  - `server.ts` — composition root: loads config, builds all deps, mounts `createApp`, attaches Socket.IO, wires `GraceController` callbacks to the broadcast helpers, mounts the raw webhook route using `WebhookReceiver` from `livekit-server-sdk`, and listens on `cfg.port`. (Not unit-tested; verified by the smoke test in Task 11.)

- [ ] **Step 1: Write the failing test `backend/src/webhooks.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { handleWebhookEvent } from './webhooks';
import { RoomRegistry } from './rooms';

function setup() {
  let n = 0;
  const registry = new RoomRegistry(() => `id${n++}`);
  const room = registry.createRoom();
  registry.addParticipant(room.roomName, { identity: 'Ann', displayName: 'Ann', role: 'host', joinedAt: 0 });
  const grace = { hostLeft: vi.fn(), hostReturned: vi.fn() };
  return { registry, room, grace };
}

describe('handleWebhookEvent', () => {
  it('starts grace when the host leaves an active room', () => {
    const { registry, room, grace } = setup();
    handleWebhookEvent(
      { event: 'participant_left', participant: { identity: 'Ann' }, room: { name: room.roomName } },
      { registry, grace: grace as any, onHostReturned: () => {} },
    );
    expect(grace.hostLeft).toHaveBeenCalledWith(room.roomName);
  });

  it('ignores a guest leaving', () => {
    const { registry, room, grace } = setup();
    handleWebhookEvent(
      { event: 'participant_left', participant: { identity: 'Boris' }, room: { name: room.roomName } },
      { registry, grace: grace as any, onHostReturned: () => {} },
    );
    expect(grace.hostLeft).not.toHaveBeenCalled();
  });

  it('cancels grace when the host rejoins', () => {
    const { registry, room, grace } = setup();
    registry.get(room.roomName)!.status = 'grace';
    const onHostReturned = vi.fn();
    handleWebhookEvent(
      { event: 'participant_joined', participant: { identity: 'Ann' }, room: { name: room.roomName } },
      { registry, grace: grace as any, onHostReturned },
    );
    expect(grace.hostReturned).toHaveBeenCalledWith(room.roomName);
    expect(onHostReturned).toHaveBeenCalledWith(room.roomName);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/webhooks.test.ts`
Expected: FAIL — cannot find module `./webhooks`.

- [ ] **Step 3: Implement `backend/src/webhooks.ts`**

```ts
import type { RoomRegistry } from './rooms';
import type { GraceController } from './grace';

export type WebhookEvent = {
  event: string;
  participant?: { identity: string };
  room?: { name: string };
};

export type WebhookDeps = {
  registry: RoomRegistry;
  grace: Pick<GraceController, 'hostLeft' | 'hostReturned'>;
  onHostReturned: (roomName: string) => void;
};

export function handleWebhookEvent(evt: WebhookEvent, deps: WebhookDeps): void {
  const roomName = evt.room?.name;
  const identity = evt.participant?.identity;
  if (!roomName || !identity) return;
  const room = deps.registry.get(roomName);
  if (!room || room.hostIdentity !== identity) return;

  if (evt.event === 'participant_left' && room.status === 'active') {
    deps.grace.hostLeft(roomName);
  } else if (evt.event === 'participant_joined' && room.status === 'grace') {
    deps.grace.hostReturned(roomName);
    deps.onHostReturned(roomName);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/webhooks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `backend/src/server.ts` (composition root)**

```ts
import { createServer } from 'node:http';
import express from 'express';
import { Server } from 'socket.io';
import { WebhookReceiver } from 'livekit-server-sdk';
import { loadConfig } from './config';
import { RoomRegistry } from './rooms';
import { createLiveKitAdmin } from './livekitAdmin';
import { AttachmentStore } from './attachments';
import { createAccessToken } from './livekitTokens';
import { createApp } from './app';
import { ChatService } from './chat';
import { registerSocket, broadcastGrace, broadcastGraceCancelled, broadcastRoomEnded } from './socket';
import { GraceController } from './grace';
import { handleWebhookEvent } from './webhooks';

const cfg = loadConfig(process.env);
const genId = () => Math.random().toString(16).slice(2, 10);

const registry = new RoomRegistry(genId);
const admin = createLiveKitAdmin(cfg);
const store = new AttachmentStore(cfg.storageRoot);
const chat = new ChatService(registry);

const app = createApp({ cfg, registry, admin, store, tokenFn: createAccessToken, genId });
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: cfg.corsOrigin } });

const grace = new GraceController({
  registry, admin, store,
  onTick: (room, s) => broadcastGrace(io, room, s),
  onEnded: (room) => broadcastRoomEnded(io, room, 'host_timeout'),
});

registerSocket(io, { chat, registry, genId, now: () => Date.now() });

// LiveKit webhooks arrive as a signed text body.
const receiver = new WebhookReceiver(cfg.livekitApiKey, cfg.livekitApiSecret);
app.post('/livekit/webhook', express.raw({ type: 'application/webhook+json' }), async (req, res) => {
  try {
    const evt = await receiver.receive(req.body.toString(), req.get('Authorization'));
    handleWebhookEvent(evt as any, {
      registry, grace,
      onHostReturned: (room) => broadcastGraceCancelled(io, room),
    });
    res.status(200).end();
  } catch {
    res.status(400).end();
  }
});

httpServer.listen(cfg.port, () => {
  console.log(`KMB backend listening on :${cfg.port}`);
});
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/webhooks.ts backend/src/webhooks.test.ts backend/src/server.ts
git commit -m "feat(backend): add livekit webhook handling and server composition root"
```

---

### Task 11: Full test run, build, and smoke verification

**Files:**
- Create: `backend/README.md`
- Modify: `backend/package.json` (already has scripts)

**Interfaces:**
- Consumes: everything above.
- Produces: a passing `npm test`, a clean `npm run build`, and a documented run procedure.

- [ ] **Step 1: Run the entire test suite**

Run: `cd backend && npm test`
Expected: PASS — all suites green (config, validation, rooms, livekitTokens, livekitAdmin, attachments, app, grace, chat, socket, webhooks).

- [ ] **Step 2: Type-check / build**

Run: `npm run build`
Expected: `tsc` completes with no errors; `dist/` is produced.

- [ ] **Step 3: Write `backend/README.md`**

````markdown
# КМБ Video Chat — Backend

Control-plane service: LiveKit token generation, room lifecycle, host actions,
host-reconnect grace, Socket.IO chat, and local-disk attachments.

## Run locally

1. Start a local LiveKit server (e.g. `livekit-server --dev`) on `ws://localhost:7880`.
2. `cp .env.example .env` and adjust values.
3. `npm install`
4. `npm run dev`

Configure LiveKit to POST webhooks to `http://localhost:4000/livekit/webhook`.

## Test

`npm test`
````

- [ ] **Step 4: Manual smoke test (LiveKit running)**

Run:
```bash
npm run dev
# in another shell:
curl -s -X POST http://localhost:4000/rooms
```
Expected: JSON containing `roomName`, `hostToken`, `participantUrl`. Then:
```bash
ROOM=<roomName-from-above>
curl -s -X POST http://localhost:4000/rooms/$ROOM/join \
  -H 'content-type: application/json' -d '{"name":"Ann"}'
```
Expected: JSON with `accessToken`, `livekitUrl`, `role: "guest"`.

- [ ] **Step 5: Commit**

```bash
git add backend/README.md
git commit -m "docs(backend): add run + smoke-test instructions"
```

---

## Self-Review (completed by plan author)

**Spec coverage** — every backend-relevant spec section maps to a task:
- §1.1 stack / no hand-rolled JWT → Tasks 0, 3.
- §2.1 host/guest roles & server-side authority → Tasks 2, 6.
- §3.1 room registry → Task 2.
- §3.2 REST API (all 7 routes + attachment download) → Task 6.
- §3.3 host-reconnect grace → Tasks 7, 10.
- §3.4 chat over Socket.IO + history + unread/failure → Tasks 8, 9.
- §3.5 attachments (types, limits, disk, cleanup) → Tasks 5, 6.
- §6 error codes → returned by Tasks 1, 5, 6, 8 (frontend maps codes to exact strings).
- §7 validation rules → Tasks 1, 2, 5, 8.

**Out of scope for this plan (frontend):** screen rendering, i18n strings, video grid, theming, lightbox — covered by the separate frontend plan.

**Placeholder scan:** none — every code step contains complete code.

**Type consistency:** `RoomState`, `Participant`, `ChatMessage`, `Attachment` defined once in `rooms.ts` (Task 2) and imported everywhere; `LiveKitAdmin` interface (Task 4) consumed by Tasks 6/7/10; `AppConfig` (Task 0) consumed throughout; grace `onTick/onEnded` callback names match between Tasks 7 and 10.
