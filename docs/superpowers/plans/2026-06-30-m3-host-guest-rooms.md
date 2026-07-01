# M3 — Host/Guest Model: Landing, Multi-Room, Roles, Copy Link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single fixed `main` room with a real host/guest model — a landing page whose "Start a call" creates an independent room with a secret host URL and a participant URL, role-aware join (host vs guest), and a host-only "Copy link" control.

**Architecture:** The backend gains an in-memory **room registry** (`rooms.ts`) that mints a cryptographically-random `roomId` (participant-facing) and `hostToken` (secret) per room; all LiveKit/admin/socket/chat state becomes keyed by `roomId` instead of a fixed name. The frontend gains client-side routing (`react-router-dom`): `/` → landing, `/r/:roomId` → room flow, `*` → invalid-link. The **host token travels in the URL hash fragment** (`/r/:roomId#h=<token>`) so it is never sent to the server in request lines or `Referer` headers; the client reads it from `location.hash` and POSTs it over HTTPS to obtain a host token.

**Tech Stack:** Backend — Node 22 + TypeScript, Express, `livekit-server-sdk`, Socket.IO 4, Zod, Vitest. Frontend — React 19 + TypeScript, Vite, `react-router-dom` v7, Zustand, react-i18next, Vitest + Testing Library.

## Global Constraints

- **PRD is binding** (`prd-kmb-video-chat.md` v2.0). On any PRD-vs-Figma conflict, PRD wins.
- **Verbatim UI strings** — copy these exactly (EN), and provide the RU parallel for every key:
  - Landing tagline: `Group video calls for up to four people. No sign-up required.`
  - Landing button: `Start a call`
  - Start-call failure (US-1): `Unable to start a call right now. Please try again.`
  - Copy-link success (US-3): `Link copied!`
  - Copy-link failure (US-3): `Unable to copy. Please copy the link from the address shown below:`
  - Invalid-link (US-4): `This call was not found. The link may be incorrect or expired.`
  - Invalid-link action: `Start a new call`
- **Security:** `roomId` and `hostToken` are each cryptographically random with **≥128 bits of entropy** (NFR-6/7) — `randomBytes(16).toString('base64url')`. The host token must not appear in the participant URL (FR-1, FR-9).
- **Scope boundary (do NOT build here):** room **destruction**, the "This call has ended." screen, the "ended marker", host grace period, remove-guest, and `Leave`/`Rejoin` belong to **M4**. M3 covers only `available` / `full` / `not-found` link states (US-4 minus the ended branch).
- **Code rules:** no `any`, no `console.log` (use `logger`), no hardcoded user-facing strings (all via i18n), `PascalCase` types with no `I`-prefix, string-literal unions over enums, server is authoritative for role, named exports, `import type` for type-only imports, `tsc --noEmit` and ESLint must stay clean, tests co-located.
- **Stack note:** repo runs React 19 / TS 6 / Express 5 (see memory `stack-react19-deviation`); ignore CLAUDE.md's "React 18".

---

## File Structure

**Backend (`backend/src/`)**
- Create: `rooms.ts` — in-memory room registry (roomId, hostToken, hostIdentity), owns `Room`/`RoomRegistry` types.
- Create: `rooms.test.ts`.
- Modify: `config.ts` — drop `FIXED_ROOM_NAME`/`fixedRoomName`.
- Modify: `config.test.ts` — drop fixed-room assertions.
- Modify: `livekitAdmin.ts` — parametrize every method by `roomId`.
- Modify: `livekitTokens.ts` — add `mintHostToken` (roomAdmin grant).
- Modify: `livekitTokens.test.ts` — cover host token grant.
- Modify: `errors.ts` — add `NOT_FOUND` (404).
- Modify: `errors.test.ts` — assert `NOT_FOUND` mapping.
- Modify: `routes/rooms/schemeValidator.ts` — accept optional `hostToken`.
- Modify: `routes/rooms/controller.ts` — `create` / role-aware `join` / registry-aware `getStatus`.
- Modify: `routes/rooms/router.ts` — add `POST /` (create).
- Modify: `app.ts` — `AppDeps` carries the registry + admin with `ensureRoom`.
- Modify: `app.test.ts` — rewrite around the registry + create/join/not-found.
- Modify: `socket.ts` — key chat by `roomId` from the join payload.
- Modify: `socket.test.ts` — pass `roomId` in payloads.
- Modify: `server.ts` — build the registry, drop the startup fixed-room creation.

**Frontend (`frontend/src/`)**
- Modify: `package.json` — add `react-router-dom`.
- Modify: `eslint.config.js` — add a `pages` boundary element.
- Modify: `main.tsx` — wrap the app in `<BrowserRouter>`.
- Modify: `App.tsx` — becomes the router shell (TopBar + `<Routes>`).
- Modify: `App.test.tsx` — thin routing test.
- Create: `pages/LandingPage.tsx` + `pages/LandingPage.test.tsx`.
- Create: `pages/RoomPage.tsx` + `pages/RoomPage.test.tsx` (absorbs the old App state machine).
- Modify: `shared/types/index.ts` — `role: 'host' | 'guest'`, `roomId`, `NOT_FOUND`, create-room types, `RoomStatus` adds `not-found`.
- Modify: `shared/lib/apiClient.ts` — `createRoom`, `joinRoom(roomId, name, hostToken?)`, `getRoomStatus` 404→`not-found`.
- Modify: `shared/lib/apiClient.test.ts` — cover the new shapes.
- Modify: `shared/i18n/en.ts`, `shared/i18n/ru.ts`, `shared/i18n/index.ts` — new strings + `landing` namespace.
- Create: `features/room-states/InvalidLinkScreen.tsx` + test; export from `features/room-states/index.ts`.
- Create: `features/call/components/CopyLinkButton.tsx` + test; export from `features/call/index.ts`.
- Modify: `features/call/CallShell.tsx` — accept + forward `role`, `participantUrl`.
- Modify: `features/call/components/ControlsBar.tsx` — host-only Copy link.
- Modify: `features/call/components/ControlsBar.test.tsx` — role-aware assertions.
- Modify: `features/prejoin/PreJoinScreen.tsx` — role-aware entry label + optional join-error message.

---

## Backend

### Task 1: Room registry (`rooms.ts`)

**Files:**
- Create: `backend/src/rooms.ts`
- Test: `backend/src/rooms.test.ts`

**Interfaces:**
- Produces: `type Room = { roomId: string; hostToken: string; hostIdentity: string | null; createdAt: number }`; `type RoomRegistry = { create(): Room; get(roomId: string): Room | undefined; verifyHostToken(roomId: string, token: string): boolean; setHostIdentity(roomId: string, identity: string): void }`; `createRoomRegistry(options?: { now?: () => number; newToken?: () => string }): RoomRegistry`.

- [ ] **Step 1: Write the failing test**

```ts
// backend/src/rooms.test.ts
import { describe, it, expect } from 'vitest';
import { createRoomRegistry } from './rooms.js';

describe('createRoomRegistry', () => {
  it('creates a room with distinct 128-bit roomId and hostToken', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    // base64url of 16 random bytes → 22 chars, no padding
    expect(room.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(room.hostToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(room.roomId).not.toBe(room.hostToken);
    expect(room.hostIdentity).toBeNull();
  });

  it('retrieves a created room by id and returns undefined for unknown ids', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    expect(registry.get(room.roomId)).toEqual(room);
    expect(registry.get('nope')).toBeUndefined();
  });

  it('verifies the host token only for the matching room', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    expect(registry.verifyHostToken(room.roomId, room.hostToken)).toBe(true);
    expect(registry.verifyHostToken(room.roomId, 'wrong')).toBe(false);
    expect(registry.verifyHostToken('unknown', room.hostToken)).toBe(false);
  });

  it('records the host identity on the room', () => {
    const registry = createRoomRegistry();
    const room = registry.create();
    registry.setHostIdentity(room.roomId, 'p_host');
    expect(registry.get(room.roomId)?.hostIdentity).toBe('p_host');
  });

  it('uses injected generators deterministically', () => {
    let n = 0;
    const registry = createRoomRegistry({ now: () => 123, newToken: () => `t${n++}` });
    const room = registry.create();
    expect(room).toEqual({ roomId: 't0', hostToken: 't1', hostIdentity: null, createdAt: 123 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/rooms.test.ts`
Expected: FAIL — `Cannot find module './rooms.js'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// backend/src/rooms.ts
import { randomBytes } from 'node:crypto';

export type Room = {
  roomId: string; // participant-facing id (no secret); ≥128-bit entropy (NFR-7)
  hostToken: string; // secret; grants the host role; ≥128-bit entropy (NFR-6)
  hostIdentity: string | null; // recorded on host join — foundation for M4 (grace, remove)
  createdAt: number;
};

export type RoomRegistry = {
  create(): Room;
  get(roomId: string): Room | undefined;
  verifyHostToken(roomId: string, token: string): boolean;
  setHostIdentity(roomId: string, identity: string): void;
};

export type RoomRegistryOptions = {
  now?: () => number;
  newToken?: () => string;
};

// 16 bytes = 128 bits; base64url yields a URL-safe 22-char string with no padding.
function defaultToken(): string {
  return randomBytes(16).toString('base64url');
}

export function createRoomRegistry(options: RoomRegistryOptions = {}): RoomRegistry {
  const now = options.now ?? ((): number => Date.now());
  const newToken = options.newToken ?? defaultToken;
  const rooms = new Map<string, Room>();

  return {
    create(): Room {
      const room: Room = {
        roomId: newToken(),
        hostToken: newToken(),
        hostIdentity: null,
        createdAt: now(),
      };
      rooms.set(room.roomId, room);
      return room;
    },
    get(roomId: string): Room | undefined {
      return rooms.get(roomId);
    },
    verifyHostToken(roomId: string, token: string): boolean {
      const room = rooms.get(roomId);
      // 128-bit entropy makes guessing/enumeration infeasible; plain compare is sufficient.
      return room !== undefined && room.hostToken === token;
    },
    setHostIdentity(roomId: string, identity: string): void {
      const room = rooms.get(roomId);
      if (room) room.hostIdentity = identity;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/rooms.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/rooms.ts backend/src/rooms.test.ts
git commit -m "feat(backend): add in-memory room registry (roomId + secret host token)"
```

---

### Task 2: Drop the fixed-room config

**Files:**
- Modify: `backend/src/config.ts`
- Test: `backend/src/config.test.ts`

**Interfaces:**
- Produces: `AppConfig` no longer has `fixedRoomName`; `FIXED_ROOM_NAME` env removed. All other fields unchanged.

- [ ] **Step 1: Update the test first (red)**

Replace the whole body of `backend/src/config.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { loadConfig, MAX_PARTICIPANTS } from './config.js';

const base = {
  LIVEKIT_API_KEY: 'k', LIVEKIT_API_SECRET: 's',
  LIVEKIT_URL: 'ws://localhost:7880', LIVEKIT_HOST: 'http://localhost:7880',
};

describe('loadConfig', () => {
  it('parses a valid env with defaults', () => {
    const cfg = loadConfig(base);
    expect(cfg.port).toBe(3000);
    expect(cfg.maxParticipants).toBe(MAX_PARTICIPANTS);
    expect(cfg.maxParticipants).toBe(4);
    expect('fixedRoomName' in cfg).toBe(false);
  });

  it('throws when a required LiveKit var is missing', () => {
    expect(() => loadConfig({ ...base, LIVEKIT_API_KEY: undefined })).toThrow();
  });

  it('throws when a LiveKit URL is not a valid URL', () => {
    expect(() => loadConfig({ ...base, LIVEKIT_URL: 'not-a-url' })).toThrow();
  });

  it('honours the PORT override', () => {
    const cfg = loadConfig({ ...base, PORT: '4000' });
    expect(cfg.port).toBe(4000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/config.test.ts`
Expected: FAIL — `cfg.fixedRoomName` still present / `'fixedRoomName' in cfg` is `true`.

- [ ] **Step 3: Edit `config.ts`**

In `backend/src/config.ts`: delete the `FIXED_ROOM_NAME` line from `envSchema`, delete `fixedRoomName` from the `AppConfig` type, and delete `fixedRoomName: e.FIXED_ROOM_NAME,` from the returned object. The file becomes:

```ts
import { z } from 'zod';

export const MAX_PARTICIPANTS = 4;

const EMPTY_TIMEOUT_SECONDS = 300;

const envSchema = z.object({
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(1),
  // LIVEKIT_URL is the client-facing signalling endpoint (ws://|wss://); LIVEKIT_HOST is the
  // server API endpoint (http://|https://). Both must be syntactically valid URLs.
  LIVEKIT_URL: z.url(),
  LIVEKIT_HOST: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type AppConfig = {
  livekitApiKey: string;
  livekitApiSecret: string;
  livekitUrl: string;
  livekitHost: string;
  port: number;
  corsOrigin: string;
  maxParticipants: number;
  emptyTimeoutSeconds: number;
};

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const e = parsed.data;
  return {
    livekitApiKey: e.LIVEKIT_API_KEY,
    livekitApiSecret: e.LIVEKIT_API_SECRET,
    livekitUrl: e.LIVEKIT_URL,
    livekitHost: e.LIVEKIT_HOST,
    port: e.PORT,
    corsOrigin: e.CORS_ORIGIN,
    maxParticipants: MAX_PARTICIPANTS,
    emptyTimeoutSeconds: EMPTY_TIMEOUT_SECONDS,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/config.test.ts`
Expected: PASS. (Other backend files still reference `fixedRoomName` and will fail to typecheck until later tasks — that is expected; do not run a full typecheck yet.)

- [ ] **Step 5: Commit**

```bash
git add backend/src/config.ts backend/src/config.test.ts
git commit -m "refactor(backend): remove fixed-room config; rooms are now per-id"
```

---

### Task 3: Per-room LiveKit admin + host token minting

**Files:**
- Modify: `backend/src/livekitAdmin.ts`
- Modify: `backend/src/livekitTokens.ts`
- Test: `backend/src/livekitTokens.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `LivekitAdmin = { ensureRoom(roomId: string): Promise<void>; listParticipantCount(roomId: string): Promise<number>; listParticipants(roomId: string): Promise<ParticipantSummary[]> }`.
  - `TokenMinter = { mintGuestToken(input: GuestTokenInput): Promise<string>; mintHostToken(input: GuestTokenInput): Promise<string> }` where `GuestTokenInput = { identity: string; displayName: string; room: string }`.

- [ ] **Step 1: Write the failing test (host token grant)**

Append to `backend/src/livekitTokens.test.ts` a test that decodes the JWT payload and asserts the host grant carries `roomAdmin: true` while the guest grant does not. Read the existing file first to match its decode helper; if it has none, add this self-contained test block:

```ts
import { describe, it, expect } from 'vitest';
import { createTokenMinter } from './livekitTokens.js';

function decodeGrant(jwt: string): Record<string, unknown> {
  const [, payload] = jwt.split('.');
  const json = Buffer.from(payload, 'base64url').toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

describe('mintHostToken', () => {
  const minter = createTokenMinter({ livekitApiKey: 'devkey', livekitApiSecret: 'a'.repeat(32) });

  it('grants roomAdmin to the host', async () => {
    const jwt = await minter.mintHostToken({ identity: 'p_h', displayName: 'Host', room: 'r1' });
    const grant = decodeGrant(jwt).video as Record<string, unknown>;
    expect(grant.roomAdmin).toBe(true);
    expect(grant.room).toBe('r1');
    expect(grant.canPublish).toBe(true);
  });

  it('does not grant roomAdmin to a guest', async () => {
    const jwt = await minter.mintGuestToken({ identity: 'p_g', displayName: 'Guest', room: 'r1' });
    const grant = decodeGrant(jwt).video as Record<string, unknown>;
    expect(grant.roomAdmin).toBeFalsy();
  });
});
```

> If `livekitTokens.test.ts` already defines `decodeGrant`/a minter, reuse them instead of redeclaring to avoid duplicate-identifier errors.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/livekitTokens.test.ts`
Expected: FAIL — `minter.mintHostToken is not a function`.

- [ ] **Step 3: Implement `mintHostToken`**

Replace `backend/src/livekitTokens.ts` with:

```ts
import { AccessToken } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';

export type GuestTokenInput = {
  identity: string;
  displayName: string;
  room: string;
};

export type TokenMinter = {
  mintGuestToken(input: GuestTokenInput): Promise<string>;
  mintHostToken(input: GuestTokenInput): Promise<string>;
};

export function createTokenMinter(
  config: Pick<AppConfig, 'livekitApiKey' | 'livekitApiSecret'>,
): TokenMinter {
  async function mint(input: GuestTokenInput, roomAdmin: boolean): Promise<string> {
    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity: input.identity,
      name: input.displayName,
    });
    at.addGrant({
      roomJoin: true,
      room: input.room,
      canPublish: true,
      canSubscribe: true,
      // roomAdmin is granted only to the host; M4 (remove guest / end call) relies on it.
      roomAdmin,
    });
    return at.toJwt();
  }

  return {
    mintGuestToken: (input) => mint(input, false),
    mintHostToken: (input) => mint(input, true),
  };
}
```

- [ ] **Step 4: Parametrize `livekitAdmin.ts` by roomId**

Replace `backend/src/livekitAdmin.ts` with:

```ts
import { RoomServiceClient } from 'livekit-server-sdk';
import type { AppConfig } from './config.js';
import { logger } from './logger.js';

export type ParticipantSummary = { identity: string; name: string };

export type LivekitAdmin = {
  ensureRoom(roomId: string): Promise<void>;
  listParticipantCount(roomId: string): Promise<number>;
  listParticipants(roomId: string): Promise<ParticipantSummary[]>;
};

export function createLivekitAdmin(config: AppConfig): LivekitAdmin {
  const client = new RoomServiceClient(
    config.livekitHost,
    config.livekitApiKey,
    config.livekitApiSecret,
  );

  async function fetchParticipants(roomId: string): Promise<ParticipantSummary[]> {
    const participants = await client.listParticipants(roomId);
    return participants.map((p) => ({ identity: p.identity, name: p.name }));
  }

  return {
    async ensureRoom(roomId) {
      // Idempotent: createRoom on an existing room is a no-op upsert.
      await client.createRoom({
        name: roomId,
        maxParticipants: config.maxParticipants,
        emptyTimeout: config.emptyTimeoutSeconds,
      });
      logger.info({ room: roomId }, 'ensured room exists');
    },

    async listParticipantCount(roomId) {
      const participants = await fetchParticipants(roomId);
      return participants.length;
    },

    async listParticipants(roomId) {
      return fetchParticipants(roomId);
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && npx vitest run src/livekitTokens.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/livekitAdmin.ts backend/src/livekitTokens.ts backend/src/livekitTokens.test.ts
git commit -m "feat(backend): per-room admin calls + host token (roomAdmin) minting"
```

---

### Task 4: Rooms endpoints — create, role-aware join, not-found

**Files:**
- Modify: `backend/src/errors.ts`
- Modify: `backend/src/errors.test.ts`
- Modify: `backend/src/routes/rooms/schemeValidator.ts`
- Modify: `backend/src/routes/rooms/controller.ts`
- Modify: `backend/src/routes/rooms/router.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/src/app.test.ts`

**Interfaces:**
- Consumes: `RoomRegistry` (Task 1), `LivekitAdmin` (Task 3), `TokenMinter` (Task 3).
- Produces:
  - `ErrorCode` adds `'NOT_FOUND'` (HTTP 404).
  - `parseJoinBody(body): { name: string; hostToken?: string }`.
  - `RoomsControllerDeps = { config: AppConfig; registry: RoomRegistry; admin: Pick<LivekitAdmin, 'ensureRoom' | 'listParticipantCount'>; minter: TokenMinter }`.
  - `RoomsController = { create; getStatus; join }`.
  - `AppDeps = { config: AppConfig; registry: RoomRegistry; admin: Pick<LivekitAdmin, 'ensureRoom' | 'listParticipantCount'>; minter: TokenMinter }`.
  - Routes: `POST /rooms` → `201 { roomId, hostToken }`; `GET /rooms/:roomId` → `{ status }` or `404 { error: 'NOT_FOUND' }`; `POST /rooms/:roomId/join` → `{ accessToken, livekitUrl, role, identity, displayName, roomId }`.

- [ ] **Step 1: Add `NOT_FOUND` to errors (red)**

Add an assertion to `backend/src/errors.test.ts`:

```ts
it('maps NOT_FOUND to 404', () => {
  const err = new AppError('NOT_FOUND');
  expect(err.status).toBe(404);
  expect(err.code).toBe('NOT_FOUND');
});
```

Run: `cd backend && npx vitest run src/errors.test.ts` → Expected: FAIL (type/`STATUS_BY_CODE` missing `NOT_FOUND`).

- [ ] **Step 2: Implement the error code**

In `backend/src/errors.ts`, extend the union and the map:

```ts
export type ErrorCode = 'FULL' | 'INVALID_NAME' | 'NOT_FOUND' | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  FULL: StatusCodes.CONFLICT,
  INVALID_NAME: StatusCodes.BAD_REQUEST,
  NOT_FOUND: StatusCodes.NOT_FOUND,
  INTERNAL: StatusCodes.INTERNAL_SERVER_ERROR,
};
```

Run: `cd backend && npx vitest run src/errors.test.ts` → Expected: PASS.

- [ ] **Step 3: Accept an optional host token in the join body**

Replace `backend/src/routes/rooms/schemeValidator.ts` with:

```ts
import { z } from 'zod';
import { nameSchema } from '../../validation.js';
import { AppError } from '../../errors.js';

// Request-payload schema for the join route. Reuses the display-name rule (validation.ts).
// hostToken is optional: its presence (and validity) is what elevates a join to the host role.
const joinBodySchema = z.object({ name: nameSchema, hostToken: z.string().optional() });

export function parseJoinBody(body: unknown): { name: string; hostToken?: string } {
  const result = joinBodySchema.safeParse(body);
  if (!result.success) throw new AppError('INVALID_NAME');
  return { name: result.data.name, hostToken: result.data.hostToken };
}
```

- [ ] **Step 4: Rewrite the controller**

Replace `backend/src/routes/rooms/controller.ts` with:

```ts
import type { Request, Response } from 'express';
import type { AppConfig } from '../../config.js';
import type { LivekitAdmin } from '../../livekitAdmin.js';
import type { TokenMinter } from '../../livekitTokens.js';
import type { RoomRegistry } from '../../rooms.js';
import { generateIdentity } from '../../identity.js';
import { AppError } from '../../errors.js';
import { parseJoinBody } from './schemeValidator.js';

export type RoomsControllerDeps = {
  config: AppConfig;
  registry: RoomRegistry;
  admin: Pick<LivekitAdmin, 'ensureRoom' | 'listParticipantCount'>;
  minter: TokenMinter;
};

export type RoomsController = {
  create: (req: Request, res: Response) => Promise<void>;
  getStatus: (req: Request, res: Response) => Promise<void>;
  join: (req: Request, res: Response) => Promise<void>;
};

export function createRoomsController(deps: RoomsControllerDeps): RoomsController {
  const { config, registry, admin, minter } = deps;

  async function create(_req: Request, res: Response): Promise<void> {
    const room = registry.create();
    // Create the LiveKit room now so the first participant can connect immediately.
    await admin.ensureRoom(room.roomId);
    res.status(201).json({ roomId: room.roomId, hostToken: room.hostToken });
  }

  async function getStatus(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (!registry.get(roomId)) throw new AppError('NOT_FOUND');
    const count = await admin.listParticipantCount(roomId);
    res.json({ status: count >= config.maxParticipants ? 'full' : 'available' });
  }

  async function join(req: Request, res: Response): Promise<void> {
    const { roomId } = req.params;
    if (!registry.get(roomId)) throw new AppError('NOT_FOUND');

    const { name, hostToken } = parseJoinBody(req.body);

    let role: 'host' | 'guest' = 'guest';
    if (hostToken !== undefined) {
      // An invalid host token is treated as a non-existent room (FR-7 error path).
      if (!registry.verifyHostToken(roomId, hostToken)) throw new AppError('NOT_FOUND');
      role = 'host';
    }

    const count = await admin.listParticipantCount(roomId);
    if (count >= config.maxParticipants) throw new AppError('FULL');

    const identity = generateIdentity();
    const accessToken =
      role === 'host'
        ? await minter.mintHostToken({ identity, displayName: name, room: roomId })
        : await minter.mintGuestToken({ identity, displayName: name, room: roomId });
    if (role === 'host') registry.setHostIdentity(roomId, identity);

    res.json({
      accessToken,
      livekitUrl: config.livekitUrl,
      role,
      identity,
      displayName: name,
      roomId,
    });
  }

  return { create, getStatus, join };
}
```

- [ ] **Step 5: Add the create route**

Replace `backend/src/routes/rooms/router.ts` with:

```ts
import { Router } from 'express';
import { asyncHandler } from '../../asyncHandler.js';
import { createRoomsController } from './controller.js';
import type { RoomsControllerDeps } from './controller.js';

// Routes under the `/rooms` mount: create a room, query status, and join (guest or host).
export function createRoomsRouter(deps: RoomsControllerDeps): Router {
  const controller = createRoomsController(deps);
  const router = Router();
  router.post('/', asyncHandler(controller.create));
  router.get('/:roomId', asyncHandler(controller.getStatus));
  router.post('/:roomId/join', asyncHandler(controller.join));
  return router;
}
```

- [ ] **Step 6: Widen `AppDeps` to carry the registry**

In `backend/src/app.ts`, update the imports and `AppDeps`:

```ts
import type { RoomRegistry } from './rooms.js';
```

```ts
export type AppDeps = {
  config: AppConfig;
  registry: RoomRegistry;
  admin: Pick<LivekitAdmin, 'ensureRoom' | 'listParticipantCount'>;
  minter: TokenMinter;
};
```

The existing `app.use(createRootRouter(deps));` line is unchanged — confirm `routes/index.ts` forwards `deps` to `createRoomsRouter` (it already passes the deps object through; the new `registry` field rides along).

- [ ] **Step 7: Rewrite `app.test.ts`**

Replace the whole body of `backend/src/app.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import type { AppConfig } from './config.js';
import { createRoomRegistry } from './rooms.js';

const config: AppConfig = {
  livekitApiKey: 'k', livekitApiSecret: 's',
  livekitUrl: 'ws://localhost:7880', livekitHost: 'http://localhost:7880',
  port: 3000, corsOrigin: '*',
  maxParticipants: 4, emptyTimeoutSeconds: 300,
};

function makeApp(count: number) {
  const registry = createRoomRegistry();
  const admin = {
    ensureRoom: vi.fn().mockResolvedValue(undefined),
    listParticipantCount: vi.fn().mockResolvedValue(count),
  };
  const minter = {
    mintGuestToken: vi.fn().mockResolvedValue('guest.jwt'),
    mintHostToken: vi.fn().mockResolvedValue('host.jwt'),
  };
  return { app: createApp({ config, registry, admin, minter }), registry, admin, minter };
}

describe('POST /rooms', () => {
  it('creates a room and returns roomId + hostToken', async () => {
    const { app, admin } = makeApp(0);
    const res = await request(app).post('/rooms');
    expect(res.status).toBe(201);
    expect(res.body.roomId).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(res.body.hostToken).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(admin.ensureRoom).toHaveBeenCalledWith(res.body.roomId);
  });
});

describe('GET /rooms/:roomId', () => {
  it('returns 404 NOT_FOUND for an unknown room', async () => {
    const { app } = makeApp(0);
    const res = await request(app).get('/rooms/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('returns available below capacity for a known room', async () => {
    const { app, registry } = makeApp(3);
    const room = registry.create();
    const res = await request(app).get(`/rooms/${room.roomId}`);
    expect(res.body).toEqual({ status: 'available' });
  });

  it('returns full at capacity', async () => {
    const { app, registry } = makeApp(4);
    const room = registry.create();
    const res = await request(app).get(`/rooms/${room.roomId}`);
    expect(res.body).toEqual({ status: 'full' });
  });
});

describe('POST /rooms/:roomId/join', () => {
  it('issues a guest token when no host token is supplied', async () => {
    const { app, registry, minter } = makeApp(0);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Ann' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ accessToken: 'guest.jwt', role: 'guest', displayName: 'Ann', roomId: room.roomId });
    expect(res.body.identity).toMatch(/^p_/);
    expect(minter.mintGuestToken).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Ann', room: room.roomId }),
    );
  });

  it('issues a host token for a valid host token', async () => {
    const { app, registry, minter } = makeApp(0);
    const room = registry.create();
    const res = await request(app)
      .post(`/rooms/${room.roomId}/join`)
      .send({ name: 'Host', hostToken: room.hostToken });
    expect(res.body).toMatchObject({ accessToken: 'host.jwt', role: 'host' });
    expect(minter.mintHostToken).toHaveBeenCalledOnce();
    expect(registry.get(room.roomId)?.hostIdentity).toBe(res.body.identity);
  });

  it('rejects an invalid host token as NOT_FOUND', async () => {
    const { app, registry } = makeApp(0);
    const room = registry.create();
    const res = await request(app)
      .post(`/rooms/${room.roomId}/join`)
      .send({ name: 'Mallory', hostToken: 'wrong' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('rejects join for an unknown room with NOT_FOUND', async () => {
    const { app } = makeApp(0);
    const res = await request(app).post('/rooms/unknown/join').send({ name: 'Ann' });
    expect(res.status).toBe(404);
  });

  it('rejects join at capacity with FULL', async () => {
    const { app, registry } = makeApp(4);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'Ann' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: 'FULL' });
  });

  it('rejects an invalid name with INVALID_NAME', async () => {
    const { app, registry } = makeApp(0);
    const room = registry.create();
    const res = await request(app).post(`/rooms/${room.roomId}/join`).send({ name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'INVALID_NAME' });
  });
});
```

- [ ] **Step 8: Run the endpoint tests**

Run: `cd backend && npx vitest run src/app.test.ts src/errors.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/errors.ts backend/src/errors.test.ts backend/src/routes/rooms backend/src/app.ts backend/src/app.test.ts
git commit -m "feat(backend): POST /rooms create + role-aware join + NOT_FOUND status"
```

---

### Task 5: Socket chat keyed by roomId

**Files:**
- Modify: `backend/src/socket.ts`
- Test: `backend/src/socket.test.ts`

**Interfaces:**
- Consumes: `LivekitAdmin.listParticipants(roomId)` (Task 3).
- Produces: `JoinChatPayload = { roomId: string; identity: string; role: 'host' | 'guest' }`; `ChatGatewayDeps = { config: Pick<AppConfig, 'corsOrigin'>; admin: Pick<LivekitAdmin, 'listParticipants'>; chat: ChatService }`.

- [ ] **Step 1: Update the test to pass a roomId (red)**

In `backend/src/socket.test.ts`, read the existing tests and update every `join_chat` payload and the `admin.listParticipants` fake so the room is keyed by an explicit id. The key changes: payloads become `{ roomId: 'r1', identity, role }`, the admin fake is `listParticipants: vi.fn(async (roomId) => roomId === 'r1' ? [{ identity, name }] : [])`, and `deps.config` is `{ corsOrigin: '*' }` (no `fixedRoomName`). Assert that `handleJoinChat` with an unknown/empty `roomId` emits `message_failed` with `{ code: 'NOT_A_MEMBER' }`, and that history/broadcast use `'r1'`.

```ts
it('binds and returns history for a member of the given room', async () => {
  const chat = createChatService();
  const admin = { listParticipants: vi.fn(async (roomId: string) =>
    roomId === 'r1' ? [{ identity: 'p_1', name: 'Ann' }] : []) };
  const socket = makeSocket();
  await handleJoinChat(socket, { config: { corsOrigin: '*' }, admin, chat },
    { roomId: 'r1', identity: 'p_1', role: 'guest' });
  expect(socket.data.binding).toEqual({ identity: 'p_1', displayName: 'Ann', roomName: 'r1' });
  expect(socket.joined).toContain('r1');
});

it('rejects a join with a missing roomId', async () => {
  const chat = createChatService();
  const admin = { listParticipants: vi.fn(async () => []) };
  const socket = makeSocket();
  await handleJoinChat(socket, { config: { corsOrigin: '*' }, admin, chat },
    { roomId: '', identity: 'p_1', role: 'guest' });
  expect(socket.emitted).toContainEqual(['message_failed', { code: 'NOT_A_MEMBER' }]);
});
```

> Match the existing test's helper names (`makeSocket`, `socket.emitted`, `socket.joined`) — adapt the snippets above to whatever the file already defines rather than introducing new helpers.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run src/socket.test.ts`
Expected: FAIL — handler still reads `deps.config.fixedRoomName` / payload has no `roomId`.

- [ ] **Step 3: Key the socket handlers by roomId (merge into the post-MR3 file — do NOT replace the top)**

> **Reconcile with MR3.** `socket.ts` already carries the typed event maps
> (`ServerToClientEvents` / `ClientToServerEvents`), the `ChatServer` / `ChatSocket` aliases (built on
> socket.io's own `Server` / `Socket` with `ChatSocketData`), and the guarded `socket.on(...)`
> listeners landed by MR3. **Keep all of that.** Apply only the *targeted* edits (a)–(c) below; there
> is no `EmittingSocket` type anymore — use `ChatSocket`.

(a) Add `roomId` to the join payload type (leave `SendMessagePayload`, `ChatSocketBinding`, and both
event maps exactly as they are):

```ts
export type JoinChatPayload = { roomId: string; identity: string; role: 'host' | 'guest' };
```

(b) Narrow `ChatGatewayDeps.config` — drop `fixedRoomName` (removed in Task 2):

```ts
export type ChatGatewayDeps = {
  config: Pick<AppConfig, 'corsOrigin'>;
  admin: Pick<LivekitAdmin, 'listParticipants'>;
  chat: ChatService;
};
```

(c) Rewrite `handleJoinChat` to take the room from the payload (not `config.fixedRoomName`) and pass
it to `listParticipants(roomName)`. Keep the existing `ChatSocket` parameter type:

```ts
export async function handleJoinChat(
  socket: ChatSocket,
  deps: ChatGatewayDeps,
  payload: JoinChatPayload,
): Promise<void> {
  const roomName = payload?.roomId;
  if (typeof roomName !== 'string' || roomName.length === 0) {
    socket.emit('message_failed', { code: 'NOT_A_MEMBER' });
    return;
  }
  const participants = await deps.admin.listParticipants(roomName);
  const match = participants.find((p) => p.identity === payload?.identity);
  if (!match) {
    // Not a current member of this room → do not bind, do not join the channel.
    socket.emit('message_failed', { code: 'NOT_A_MEMBER' });
    return;
  }
  socket.data.binding = { identity: match.identity, displayName: match.name, roomName };
  socket.join(roomName);
  socket.emit('chat_history', deps.chat.history(roomName));
}
```

`handleSendMessage` and `createSocketServer` are unchanged — they already use `binding.roomName` and
the typed `ChatServer` / `ChatSocket`, and the guarded listeners from MR3 stay as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run src/socket.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/socket.ts backend/src/socket.test.ts
git commit -m "feat(backend): key chat sockets by roomId from the join payload"
```

---

### Task 6: Server composition

**Files:**
- Modify: `backend/src/server.ts`

**Interfaces:**
- Consumes: `createRoomRegistry` (Task 1), updated `AppDeps`/socket deps.

- [ ] **Step 1: Wire the registry and drop the fixed-room bootstrap**

Replace `backend/src/server.ts` with:

```ts
// Load backend/.env into process.env before any config is read (no-op if absent, e.g. in prod).
import 'dotenv/config';
import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { createLivekitAdmin } from './livekitAdmin.js';
import { createTokenMinter } from './livekitTokens.js';
import { createRoomRegistry } from './rooms.js';
import { createApp } from './app.js';
import { createChatService } from './chat.js';
import { createSocketServer } from './socket.js';
import { logger } from './logger.js';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const admin = createLivekitAdmin(config);
  const minter = createTokenMinter(config);
  const registry = createRoomRegistry();
  const chat = createChatService();

  const app = createApp({ config, registry, admin, minter });
  const httpServer = createServer(app);
  createSocketServer(httpServer, { config, admin, chat });

  httpServer.listen(config.port, () => {
    logger.info({ port: config.port }, 'control plane listening');
  });
}

main().catch((err: unknown) => {
  logger.error({ err }, 'fatal startup error');
  process.exitCode = 1;
});
```

(The `await admin.ensureRoom()` startup call is gone — rooms are created on demand by `POST /rooms`.)

- [ ] **Step 2: Full backend gate**

Run: `cd backend && npm run typecheck && npm run lint && npm test`
Expected: typecheck clean, lint clean, all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "refactor(backend): compose room registry; rooms created on demand"
```

---

## Frontend

### Task 7: Routing dependency + boundaries + BrowserRouter

**Files:**
- Modify: `frontend/package.json` (via npm)
- Modify: `frontend/eslint.config.js`
- Modify: `frontend/src/main.tsx`

**Interfaces:**
- Produces: a `pages` ESLint boundary element (files under `src/pages/`) allowed to import `feature`/`shared`/`stores`; `app` allowed to import `pages`. `<BrowserRouter>` wraps `<App/>`.

- [ ] **Step 1: Install react-router-dom**

Run: `cd frontend && npm install react-router-dom@^7`
Expected: `react-router-dom` appears in `dependencies`.

- [ ] **Step 2: Add the `pages` boundary element**

In `frontend/eslint.config.js`, add the element and dependency rules. The `settings['boundaries/elements']` array gains:

```js
{ type: 'pages', pattern: 'src/pages/*', mode: 'file' },
```

and the `boundaries/dependencies` `rules` array becomes:

```js
rules: [
  { from: { type: 'app' }, allow: { to: { type: ['feature', 'shared', 'stores', 'pages'] } } },
  { from: { type: 'pages' }, allow: { to: { type: ['feature', 'shared', 'stores'] } } },
  { from: { type: 'feature' }, allow: { to: { type: ['shared', 'stores'] } } },
  { from: { type: 'shared' }, allow: { to: { type: 'shared' } } },
  { from: { type: 'stores' }, allow: { to: { type: 'shared' } } },
],
```

- [ ] **Step 3: Wrap the app in BrowserRouter**

Replace `frontend/src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './shared/i18n';
import { App } from './App';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
```

- [ ] **Step 4: Verify install + lint config parse**

Run: `cd frontend && npx eslint eslint.config.js`
Expected: no config-parse error (no source files linted yet; exit 0).

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/eslint.config.js frontend/src/main.tsx
git commit -m "chore(frontend): add react-router-dom, pages boundary, BrowserRouter"
```

---

### Task 8: Shared types + API client

**Files:**
- Modify: `frontend/src/shared/types/index.ts`
- Modify: `frontend/src/shared/lib/apiClient.ts`
- Test: `frontend/src/shared/lib/apiClient.test.ts`

**Interfaces:**
- Produces:
  - `RoomStatus = 'available' | 'full' | 'not-found'`.
  - `JoinError = 'FULL' | 'INVALID_NAME' | 'NOT_FOUND' | 'INTERNAL'`.
  - `JoinResponse = { accessToken: string; livekitUrl: string; role: 'host' | 'guest'; identity: string; displayName: string; roomId: string }`.
  - `CreateRoomResponse = { roomId: string; hostToken: string }`; `CreateRoomResult = ApiResponse<CreateRoomResponse, 'INTERNAL'>`.
  - `createRoom(): Promise<CreateRoomResult>`; `joinRoom(roomId: string, name: string, hostToken?: string): Promise<JoinResult>`; `getRoomStatus(roomId: string): Promise<RoomStatus>`.

- [ ] **Step 1: Update the API client test (red)**

Replace `frontend/src/shared/lib/apiClient.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoom, joinRoom, getRoomStatus } from './apiClient';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('createRoom', () => {
  it('returns roomId and hostToken on success', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ roomId: 'r1', hostToken: 'h1' }, { status: 201 }));
    const result = await createRoom();
    expect(result).toEqual({ ok: true, data: { roomId: 'r1', hostToken: 'h1' } });
  });

  it('returns INTERNAL on a non-ok response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    const result = await createRoom();
    expect(result).toEqual({ ok: false, error: 'INTERNAL' });
  });
});

describe('getRoomStatus', () => {
  it('maps a 404 to not-found', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'NOT_FOUND' }, { ok: false, status: 404 }));
    expect(await getRoomStatus('r1')).toBe('not-found');
  });

  it('returns the parsed status for a known room', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'full' }));
    expect(await getRoomStatus('r1')).toBe('full');
  });
});

describe('joinRoom', () => {
  it('sends the host token in the body and parses a host response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      accessToken: 'jwt', livekitUrl: 'ws://x', role: 'host', identity: 'p_1', displayName: 'Ann', roomId: 'r1',
    }));
    const result = await joinRoom('r1', 'Ann', 'h1');
    expect(result).toEqual({ ok: true, data: expect.objectContaining({ role: 'host', roomId: 'r1' }) });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ name: 'Ann', hostToken: 'h1' });
  });

  it('omits hostToken from the body for a guest join', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      accessToken: 'jwt', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann', roomId: 'r1',
    }));
    await joinRoom('r1', 'Ann');
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ name: 'Ann' });
  });

  it('maps a NOT_FOUND error body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'NOT_FOUND' }, { ok: false, status: 404 }));
    const result = await joinRoom('r1', 'Ann');
    expect(result).toEqual({ ok: false, error: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/shared/lib/apiClient.test.ts`
Expected: FAIL — `createRoom` not exported / signatures differ.

- [ ] **Step 3: Update shared types**

In `frontend/src/shared/types/index.ts`, change the top section to:

```ts
export type RoomStatus = 'available' | 'full' | 'not-found';
export type JoinError = 'FULL' | 'INVALID_NAME' | 'NOT_FOUND' | 'INTERNAL';

export type JoinResponse = {
  accessToken: string;
  livekitUrl: string;
  role: 'host' | 'guest';
  identity: string;
  displayName: string;
  roomId: string;
};

export type CreateRoomResponse = { roomId: string; hostToken: string };

// Generic envelope for API calls: a discriminated success/error union.
export type ApiResponse<TData, TError> =
  | { ok: true; data: TData }
  | { ok: false; error: TError };

export type JoinResult = ApiResponse<JoinResponse, JoinError>;
export type CreateRoomResult = ApiResponse<CreateRoomResponse, 'INTERNAL'>;
```

Leave the rest of the file (`ParticipantRole`, `ChatErrorCode`, `ChatMessage`, `CallParticipant`) unchanged.

- [ ] **Step 4: Rewrite the API client**

Replace `frontend/src/shared/lib/apiClient.ts` with:

```ts
import { z } from 'zod';
import urlJoin from 'url-join';
import type { CreateRoomResult, JoinResult, RoomStatus } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

// Endpoint URL builders kept in one place so paths are not scattered across call sites.
const roomsUrl = (): string => urlJoin(BASE_URL, 'rooms');
const roomStatusUrl = (roomId: string): string => urlJoin(roomsUrl(), encodeURIComponent(roomId));
const joinUrl = (roomId: string): string => urlJoin(roomStatusUrl(roomId), 'join');

// Response schemas — validate untrusted server payloads at the boundary instead of casting.
const createRoomResponseSchema = z.object({ roomId: z.string(), hostToken: z.string() });
const roomStatusResponseSchema = z.object({ status: z.enum(['available', 'full']) });
const joinResponseSchema = z.object({
  accessToken: z.string(),
  livekitUrl: z.string(),
  role: z.enum(['host', 'guest']),
  identity: z.string(),
  displayName: z.string(),
  roomId: z.string(),
});
const errorBodySchema = z.object({ error: z.enum(['FULL', 'INVALID_NAME', 'NOT_FOUND', 'INTERNAL']) });

export async function createRoom(): Promise<CreateRoomResult> {
  const res = await fetch(roomsUrl(), { method: 'POST' });
  if (!res.ok) return { ok: false, error: 'INTERNAL' };
  const data: unknown = await res.json();
  const parsed = createRoomResponseSchema.safeParse(data);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'INTERNAL' };
}

export async function getRoomStatus(roomId: string): Promise<RoomStatus> {
  const res = await fetch(roomStatusUrl(roomId));
  if (res.status === 404) return 'not-found';
  const body: unknown = await res.json();
  const parsed = roomStatusResponseSchema.safeParse(body);
  if (parsed.success) return parsed.data.status;
  throw new Error('Malformed room status response');
}

export async function joinRoom(roomId: string, name: string, hostToken?: string): Promise<JoinResult> {
  const payload = hostToken !== undefined ? { name, hostToken } : { name };
  const res = await fetch(joinUrl(roomId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    const data: unknown = await res.json();
    const parsed = joinResponseSchema.safeParse(data);
    return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'INTERNAL' };
  }
  const body: unknown = await res.json().catch(() => ({}));
  const parsed = errorBodySchema.safeParse(body);
  return { ok: false, error: parsed.success ? parsed.data.error : 'INTERNAL' };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/shared/lib/apiClient.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/types/index.ts frontend/src/shared/lib/apiClient.ts frontend/src/shared/lib/apiClient.test.ts
git commit -m "feat(frontend): API client for create/join with roomId + host token"
```

---

### Task 9: i18n strings (landing, copy link, invalid link, entry label)

**Files:**
- Modify: `frontend/src/shared/i18n/en.ts`
- Modify: `frontend/src/shared/i18n/ru.ts`
- Modify: `frontend/src/shared/i18n/index.ts`

**Interfaces:**
- Produces namespaces/keys: `landing.{tagline,startCall,startCallError}`; `call.{copyLink,linkCopied,copyFailed}`; `roomStates.{notFoundTitle,notFoundBody,startNewCall}`; `prejoin.join`.

- [ ] **Step 1: Add a parity test (red)**

Create `frontend/src/shared/i18n/m3-keys.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';

describe('M3 i18n keys', () => {
  it('exposes the landing namespace with EN/RU parity', () => {
    expect(Object.keys(en.landing)).toEqual(['tagline', 'startCall', 'startCallError']);
    expect(Object.keys(ru.landing)).toEqual(Object.keys(en.landing));
  });
  it('exposes copy-link and not-found strings', () => {
    expect(en.call.copyLink).toBe('Copy link');
    expect(en.call.linkCopied).toBe('Link copied!');
    expect(en.roomStates.notFoundTitle).toBe('This call was not found.');
    expect(en.prejoin.join).toBe('Join');
    expect(ru.call.copyLink.length).toBeGreaterThan(0);
  });
});
```

Run: `cd frontend && npx vitest run src/shared/i18n/m3-keys.test.ts` → Expected: FAIL.

- [ ] **Step 2: Add the EN strings**

In `frontend/src/shared/i18n/en.ts`, add a `landing` block and the new keys (insert `landing` after `common`, add `join` to `prejoin`, the three keys to `call`, and the three to `roomStates`):

```ts
  landing: {
    tagline: 'Group video calls for up to four people. No sign-up required.',
    startCall: 'Start a call',
    startCallError: 'Unable to start a call right now. Please try again.',
  },
```

```ts
    join: 'Join',
```
(added to the `prejoin` object)

```ts
    copyLink: 'Copy link',
    linkCopied: 'Link copied!',
    copyFailed: 'Unable to copy. Please copy the link from the address shown below:',
```
(added to the `call` object)

```ts
    notFoundTitle: 'This call was not found.',
    notFoundBody: 'The link may be incorrect or expired.',
    startNewCall: 'Start a new call',
```
(added to the `roomStates` object)

- [ ] **Step 3: Add the RU strings**

In `frontend/src/shared/i18n/ru.ts`, mirror every key (the `Translations` mapped type will fail typecheck until all are present):

```ts
  landing: {
    tagline: 'Групповые видеозвонки до четырёх человек. Без регистрации.',
    startCall: 'Начать звонок',
    startCallError: 'Не удалось начать звонок. Пожалуйста, попробуйте снова.',
  },
```

```ts
    join: 'Присоединиться',
```
(in `prejoin`)

```ts
    copyLink: 'Скопировать ссылку',
    linkCopied: 'Ссылка скопирована!',
    copyFailed: 'Не удалось скопировать. Пожалуйста, скопируйте ссылку из адреса ниже:',
```
(in `call`)

```ts
    notFoundTitle: 'Звонок не найден.',
    notFoundBody: 'Ссылка может быть неверной или устаревшей.',
    startNewCall: 'Начать новый звонок',
```
(in `roomStates`)

- [ ] **Step 4: Register the `landing` namespace**

In `frontend/src/shared/i18n/index.ts`, add `'landing'` to the `ns` array:

```ts
  ns: ['common', 'prejoin', 'call', 'roomStates', 'chat', 'landing'],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/shared/i18n`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/i18n
git commit -m "feat(frontend): i18n strings for landing, copy link, invalid link (EN/RU)"
```

---

### Task 10: Invalid-link screen

**Files:**
- Create: `frontend/src/features/room-states/InvalidLinkScreen.tsx`
- Test: `frontend/src/features/room-states/InvalidLinkScreen.test.tsx`
- Modify: `frontend/src/features/room-states/index.ts`

**Interfaces:**
- Produces: `InvalidLinkScreen` (no props); renders the not-found message and a "Start a new call" button that navigates to `/`.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/features/room-states/InvalidLinkScreen.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../../shared/i18n';
import { InvalidLinkScreen } from './InvalidLinkScreen';

describe('InvalidLinkScreen', () => {
  it('shows the not-found message and a start-new-call link', () => {
    render(
      <MemoryRouter>
        <InvalidLinkScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText('This call was not found.')).toBeInTheDocument();
    expect(screen.getByText('The link may be incorrect or expired.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a new call/i })).toHaveAttribute('href', '/');
  });
});
```

Run: `cd frontend && npx vitest run src/features/room-states/InvalidLinkScreen.test.tsx` → Expected: FAIL.

- [ ] **Step 2: Implement the screen**

```tsx
// frontend/src/features/room-states/InvalidLinkScreen.tsx
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Text } from '../../shared/ui/Text';

export function InvalidLinkScreen(): JSX.Element {
  const { t } = useTranslation('roomStates');
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">
      <Text variant="title">{t('notFoundTitle')}</Text>
      <Text variant="body">{t('notFoundBody')}</Text>
      <Link
        to="/"
        className="rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-muted"
      >
        {t('startNewCall')}
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Export it**

In `frontend/src/features/room-states/index.ts`, add:

```ts
export { InvalidLinkScreen } from './InvalidLinkScreen';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/features/room-states/InvalidLinkScreen.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/room-states/InvalidLinkScreen.tsx frontend/src/features/room-states/InvalidLinkScreen.test.tsx frontend/src/features/room-states/index.ts
git commit -m "feat(frontend): invalid-link (call-not-found) screen"
```

---

### Task 11: Landing page

**Files:**
- Create: `frontend/src/pages/LandingPage.tsx`
- Test: `frontend/src/pages/LandingPage.test.tsx`

**Interfaces:**
- Consumes: `createRoom` (Task 8), react-router `useNavigate`.
- Produces: `LandingPage` (no props). On "Start a call": calls `createRoom()`; success → `navigate(\`/r/${roomId}#h=${hostToken}\`)`; failure → inline error `landing.startCallError`, button stays enabled.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/pages/LandingPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '../shared/i18n';

const createRoom = vi.fn();
const navigate = vi.fn();
vi.mock('../shared/lib/apiClient', () => ({ createRoom: (...a: unknown[]) => createRoom(...a) }));
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

import { LandingPage } from './LandingPage';

beforeEach(() => {
  createRoom.mockReset();
  navigate.mockReset();
});

describe('LandingPage', () => {
  it('renders the tagline and start button', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    expect(screen.getByText(/no sign-up required/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start a call/i })).toBeInTheDocument();
  });

  it('navigates to the host URL (with hash token) on success', async () => {
    createRoom.mockResolvedValue({ ok: true, data: { roomId: 'r1', hostToken: 'h1' } });
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start a call/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/r/r1#h=h1'));
  });

  it('shows an inline error on failure and keeps the button enabled', async () => {
    createRoom.mockResolvedValue({ ok: false, error: 'INTERNAL' });
    render(<MemoryRouter><LandingPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /start a call/i }));
    await waitFor(() =>
      expect(screen.getByText('Unable to start a call right now. Please try again.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /start a call/i })).toBeEnabled();
  });
});
```

Run: `cd frontend && npx vitest run src/pages/LandingPage.test.tsx` → Expected: FAIL.

- [ ] **Step 2: Implement the page**

```tsx
// frontend/src/pages/LandingPage.tsx
import { useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { createRoom } from '../shared/lib/apiClient';
import { Button } from '../shared/ui/Button';
import { Text } from '../shared/ui/Text';

export function LandingPage(): JSX.Element {
  const { t } = useTranslation('landing');
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleStart(): Promise<void> {
    setError(false);
    setBusy(true);
    const result = await createRoom();
    setBusy(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    // Host token rides in the hash fragment: never sent to the server in the request line
    // or Referer, so the participant URL (without the hash) stays free of the secret.
    navigate(`/r/${result.data.roomId}#h=${result.data.hostToken}`);
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 text-center">
      <Text variant="title">{t('tagline')}</Text>
      <Button type="button" onClick={() => void handleStart()} disabled={busy}>
        {t('startCall')}
      </Button>
      {error ? <p className="text-sm text-amber-400">{t('startCallError')}</p> : null}
    </div>
  );
}
```

- [ ] **Step 3: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/LandingPage.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LandingPage.tsx frontend/src/pages/LandingPage.test.tsx
git commit -m "feat(frontend): landing page with Start a call → host room URL"
```

---

### Task 12: Host-only Copy link control

**Files:**
- Create: `frontend/src/features/call/components/CopyLinkButton.tsx`
- Test: `frontend/src/features/call/components/CopyLinkButton.test.tsx`
- Modify: `frontend/src/features/call/index.ts`
- Modify: `frontend/src/features/call/components/ControlsBar.tsx`
- Modify: `frontend/src/features/call/components/ControlsBar.test.tsx`
- Modify: `frontend/src/features/call/CallShell.tsx`

**Interfaces:**
- Consumes: `ParticipantRole` (shared types).
- Produces:
  - `CopyLinkButton` — props `{ url: string }`. Click → `navigator.clipboard.writeText(url)`; success → show `call.linkCopied` for 2s; failure → show `call.copyFailed` + the URL as selectable text.
  - `ControlsBarProps = { onLeave: () => void; role: ParticipantRole; participantUrl: string }`; renders `CopyLinkButton` only when `role === 'host'`.
  - `CallShellProps` gains `role: ParticipantRole; participantUrl: string`, forwarded to `ControlsBar`.

- [ ] **Step 1: Write the failing test for CopyLinkButton**

```tsx
// frontend/src/features/call/components/CopyLinkButton.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '../../../shared/i18n';
import { CopyLinkButton } from './CopyLinkButton';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('CopyLinkButton', () => {
  it('copies the url and confirms for 2 seconds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyLinkButton url="https://app/r/r1" />);
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith('https://app/r/r1'));
    expect(screen.getByText('Link copied!')).toBeInTheDocument();
    vi.advanceTimersByTime(2000);
    await waitFor(() => expect(screen.queryByText('Link copied!')).not.toBeInTheDocument());
  });

  it('shows a fallback with the selectable url when clipboard is denied', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<CopyLinkButton url="https://app/r/r1" />);
    fireEvent.click(screen.getByRole('button', { name: /copy link/i }));
    await vi.waitFor(() =>
      expect(screen.getByText(/Unable to copy/i)).toBeInTheDocument(),
    );
    expect(screen.getByText('https://app/r/r1')).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npx vitest run src/features/call/components/CopyLinkButton.test.tsx` → Expected: FAIL.

- [ ] **Step 2: Implement CopyLinkButton**

```tsx
// frontend/src/features/call/components/CopyLinkButton.tsx
import { useEffect, useRef, useState } from 'react';
import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';

export type CopyLinkButtonProps = { url: string };

type CopyState = 'idle' | 'copied' | 'failed';

export function CopyLinkButton({ url }: CopyLinkButtonProps): JSX.Element {
  const { t } = useTranslation('call');
  const [state, setState] = useState<CopyState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('failed');
    }
  }

  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="rounded-lg bg-transparent px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-muted"
      >
        {t('copyLink')}
      </button>
      {state === 'copied' ? (
        <span className="absolute -top-7 whitespace-nowrap text-xs text-emerald-400">
          {t('linkCopied')}
        </span>
      ) : null}
      {state === 'failed' ? (
        <div className="absolute -top-14 w-72 rounded-md bg-surface-muted p-2 text-xs text-slate-200">
          <p>{t('copyFailed')}</p>
          <p className="select-all break-all font-mono">{url}</p>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Export from the feature entry**

In `frontend/src/features/call/index.ts`, add an export for `CopyLinkButton` alongside the existing exports (read the file and append):

```ts
export { CopyLinkButton } from './components/CopyLinkButton';
```

- [ ] **Step 4: Update ControlsBar test (red on the new behavior)**

In `frontend/src/features/call/components/ControlsBar.test.tsx`, render `ControlsBar` with the new required props and assert the host sees Copy link and the guest does not. Read the file and update each `render(<ControlsBar ... />)` to include `role` and `participantUrl`; add:

```tsx
it('shows Copy link to the host only', () => {
  // host
  renderControls({ role: 'host', participantUrl: 'https://app/r/r1' });
  expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
});

it('hides Copy link from a guest', () => {
  renderControls({ role: 'guest', participantUrl: 'https://app/r/r1' });
  expect(screen.queryByRole('button', { name: /copy link/i })).not.toBeInTheDocument();
});
```

> Adapt to the file's existing render helper/`LiveKitRoom` wrapper. If tests mount `ControlsBar` directly, supply `role`/`participantUrl` in every existing `render` call so they typecheck.

- [ ] **Step 5: Add the props to ControlsBar**

In `frontend/src/features/call/components/ControlsBar.tsx`, update the imports, props, and render the button. Add near the top:

```tsx
import type { ParticipantRole } from '../../../shared/types';
import { CopyLinkButton } from './CopyLinkButton';
```

Change the props type and signature:

```tsx
export type ControlsBarProps = {
  onLeave: () => void;
  role: ParticipantRole;
  participantUrl: string;
};

export function ControlsBar({ onLeave, role, participantUrl }: ControlsBarProps): JSX.Element {
```

Insert the host-only control just before the `<Button variant="ghost" ...>Leave</Button>`:

```tsx
      {role === 'host' ? <CopyLinkButton url={participantUrl} /> : null}
```

- [ ] **Step 6: Forward the props through CallShell**

In `frontend/src/features/call/CallShell.tsx`, add to `CallShellProps`:

```tsx
import type { ParticipantRole } from '../../shared/types';
```

```tsx
export type CallShellProps = {
  accessToken: string;
  serverUrl: string;
  role: ParticipantRole;
  participantUrl: string;
  onLeave: () => void;
  onConnectError: () => void;
  onRoomFull: () => void;
};
```

Destructure `role, participantUrl` in the function signature and pass them to `ControlsBar`:

```tsx
      <ControlsBar onLeave={onLeave} role={role} participantUrl={participantUrl} />
```

- [ ] **Step 7: Run the call-feature tests**

Run: `cd frontend && npx vitest run src/features/call`
Expected: PASS (CopyLinkButton + ControlsBar). `CallShell` has no test of its own; it is exercised via RoomPage in Task 13.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/call
git commit -m "feat(frontend): host-only Copy link control with clipboard fallback"
```

---

### Task 13: Room page (state machine + role + host token)

**Files:**
- Create: `frontend/src/pages/RoomPage.tsx`
- Test: `frontend/src/pages/RoomPage.test.tsx`
- Modify: `frontend/src/features/prejoin/PreJoinScreen.tsx`

**Interfaces:**
- Consumes: `useParams`/`useLocation` (router), `getRoomStatus`, `joinRoom` (Task 8), `PreJoinScreen`, `CallShell`, `ChatPanel`, `ConnectingScreen`, `CallFullScreen`, `ConnectErrorScreen`, `InvalidLinkScreen`, the four stores.
- Produces: `RoomPage` (no props). Reads `roomId` from the path and the host token from `location.hash` (`#h=<token>`). Drives `loading → not-found | full | prejoin → connecting → in-call | connect-error`. Builds `participantUrl = \`${window.location.origin}/r/${roomId}\`` and passes `role`/`participantUrl` to `CallShell`.

- [ ] **Step 1: Give PreJoinScreen a role-aware entry label**

In `frontend/src/features/prejoin/PreJoinScreen.tsx`, add an optional `role` prop and switch the button label. Add the import and update props:

```tsx
import type { ParticipantRole } from '../../shared/types';
```

```tsx
export type PreJoinScreenProps = {
  onEnter: (name: string) => void;
  submitting?: boolean;
  role?: ParticipantRole;
  error?: boolean;
};

export function PreJoinScreen({ onEnter, submitting = false, role = 'guest', error = false }: PreJoinScreenProps): JSX.Element {
```

Change the button label line to:

```tsx
        {role === 'host' ? t('enterCall') : t('join')}
```

Add a join-error line just above the `<Button>` (reuses the existing `common.connectError` string —
no new i18n key; the `prejoin` namespace can reach it with the `common:` prefix):

```tsx
      {error ? <p className="text-sm text-amber-400">{t('common:connectError')}</p> : null}
```

- [ ] **Step 2: Write the failing RoomPage test**

```tsx
// frontend/src/pages/RoomPage.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../shared/i18n';

const getRoomStatus = vi.fn();
const joinRoom = vi.fn();
vi.mock('../shared/lib/apiClient', () => ({
  getRoomStatus: (...a: unknown[]) => getRoomStatus(...a),
  joinRoom: (...a: unknown[]) => joinRoom(...a),
}));

let onConnectErrorCallback: (() => void) | null = null;
vi.mock('../features/call', () => ({
  CallShell: ({ onConnectError, role }: { onConnectError: () => void; role: string }) => {
    onConnectErrorCallback = onConnectError;
    return <div>in-call-shell role:{role}</div>;
  },
  ConnectingScreen: () => <div>connecting</div>,
}));

import { RoomPage } from './RoomPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/r/:roomId" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }) } });
  getRoomStatus.mockReset();
  joinRoom.mockReset();
  onConnectErrorCallback = null;
});
afterEach(async () => {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  vi.unstubAllGlobals();
});

describe('RoomPage', () => {
  it('shows the invalid-link screen when the room is not found', async () => {
    getRoomStatus.mockResolvedValue('not-found');
    renderAt('/r/ghost');
    await waitFor(() => expect(screen.getByText('This call was not found.')).toBeInTheDocument());
  });

  it('shows the full screen when the room is full', async () => {
    getRoomStatus.mockResolvedValue('full');
    renderAt('/r/r1');
    await waitFor(() => expect(screen.getByText('This call is full.')).toBeInTheDocument());
  });

  it('shows the guest entry label and joins as guest (no hash token)', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: true, data: { accessToken: 'j', livekitUrl: 'ws://x', role: 'guest', identity: 'p_1', displayName: 'Ann', roomId: 'r1' } });
    renderAt('/r/r1');
    await waitFor(() => screen.getByLabelText(/your name/i));
    expect(screen.getByRole('button', { name: /^join$/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() => expect(screen.getByText(/in-call-shell role:guest/)).toBeInTheDocument());
    expect(joinRoom).toHaveBeenCalledWith('r1', 'Ann', undefined);
  });

  it('passes the hash host token to joinRoom and enters as host', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: true, data: { accessToken: 'j', livekitUrl: 'ws://x', role: 'host', identity: 'p_1', displayName: 'Host', roomId: 'r1' } });
    renderAt('/r/r1#h=secret');
    await waitFor(() => screen.getByLabelText(/your name/i));
    expect(screen.getByRole('button', { name: /enter call/i })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Host' } });
    fireEvent.click(screen.getByRole('button', { name: /enter call/i }));
    await waitFor(() => expect(screen.getByText(/in-call-shell role:host/)).toBeInTheDocument());
    expect(joinRoom).toHaveBeenCalledWith('r1', 'Host', 'secret');
  });

  it('shows an inline error and returns to pre-join when join fails with INTERNAL', async () => {
    getRoomStatus.mockResolvedValue('available');
    joinRoom.mockResolvedValue({ ok: false, error: 'INTERNAL' });
    renderAt('/r/r1');
    await waitFor(() => screen.getByLabelText(/your name/i));
    fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Ann' } });
    fireEvent.click(screen.getByRole('button', { name: /^join$/i }));
    await waitFor(() =>
      expect(screen.getByText(/unable to connect to the call service/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /^join$/i })).toBeInTheDocument();
  });
});
```

Run: `cd frontend && npx vitest run src/pages/RoomPage.test.tsx` → Expected: FAIL.

- [ ] **Step 3: Implement RoomPage**

```tsx
// frontend/src/pages/RoomPage.tsx
import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { getRoomStatus, joinRoom } from '../shared/lib/apiClient';
import type { JoinResponse, ParticipantRole } from '../shared/types';
import { PreJoinScreen } from '../features/prejoin';
import { CallFullScreen, ConnectErrorScreen, InvalidLinkScreen } from '../features/room-states';
import { CallShell, ConnectingScreen } from '../features/call';
import { ChatPanel } from '../features/chat';
import { useConnectionStore } from '../stores/useConnectionStore';
import { useMediaStore } from '../stores/useMediaStore';
import { useChatStore } from '../stores/useChatStore';
import { useParticipantsStore } from '../stores/useParticipantsStore';

type View = 'loading' | 'prejoin' | 'full' | 'not-found' | 'connecting' | 'in-call' | 'connect-error';

function readHostToken(hash: string): string | undefined {
  // Host URL: /r/<roomId>#h=<token>. The hash is never sent to the server.
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('h');
  return token ?? undefined;
}

export function RoomPage(): JSX.Element {
  const { roomId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const hostToken = readHostToken(location.hash);
  const intendedRole: ParticipantRole = hostToken !== undefined ? 'host' : 'guest';

  const [view, setView] = useState<View>('loading');
  const [session, setSession] = useState<JoinResponse | null>(null);
  const [capacityTick, setCapacityTick] = useState(0);
  const [joinError, setJoinError] = useState(false);

  const setPhase = useConnectionStore((s) => s.setPhase);
  const resetConnection = useConnectionStore((s) => s.reset);
  const resetMedia = useMediaStore((s) => s.reset);
  const resetChat = useChatStore((s) => s.reset);
  const resetParticipants = useParticipantsStore((s) => s.reset);

  useEffect(() => {
    let cancelled = false;
    getRoomStatus(roomId)
      .then((status) => {
        if (cancelled) return;
        if (status === 'not-found') setView('not-found');
        else setView(status === 'full' ? 'full' : 'prejoin');
      })
      .catch(() => {
        if (!cancelled) setView('prejoin');
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, capacityTick]);

  function recheckCapacity(): void {
    setView('loading');
    setCapacityTick((n) => n + 1);
  }

  async function handleEnter(name: string): Promise<void> {
    setJoinError(false);
    setView('connecting');
    setPhase('connecting');
    const result = await joinRoom(roomId, name, hostToken);
    if (!result.ok) {
      if (result.error === 'FULL') setView('full');
      else if (result.error === 'NOT_FOUND') setView('not-found');
      // INTERNAL / unexpected: fall back to pre-join and surface an inline error.
      else {
        setJoinError(true);
        setView('prejoin');
      }
      setPhase('idle');
      return;
    }
    setSession(result.data);
    useConnectionStore.getState().setLocalParticipant({
      identity: result.data.identity,
      displayName: result.data.displayName,
    });
    setView('in-call');
  }

  function leave(): void {
    setSession(null);
    resetConnection();
    resetMedia();
    resetChat();
    resetParticipants();
    recheckCapacity();
  }

  if (view === 'loading' || view === 'connecting') return <ConnectingScreen />;
  if (view === 'not-found') return <InvalidLinkScreen />;
  if (view === 'full') return <CallFullScreen onBackToHome={() => navigate('/')} />;
  if (view === 'connect-error') return <ConnectErrorScreen onRetry={recheckCapacity} />;
  if (view === 'in-call' && session) {
    const participantUrl = `${window.location.origin}/r/${session.roomId}`;
    return (
      <>
        <CallShell
          accessToken={session.accessToken}
          serverUrl={session.livekitUrl}
          role={session.role}
          participantUrl={participantUrl}
          onLeave={leave}
          onConnectError={() => setView('connect-error')}
          onRoomFull={() => setView('full')}
        />
        <ChatPanel role={session.role} />
      </>
    );
  }
  return <PreJoinScreen role={intendedRole} error={joinError} onEnter={(name) => void handleEnter(name)} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/RoomPage.test.tsx src/features/prejoin`
Expected: PASS. (Existing prejoin tests that asserted "Enter call" must be checked — guest is now "Join". If `PreJoinScreen.test.tsx` renders without a `role`, it defaults to guest → update those assertions to `/join/i` in this step.)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/RoomPage.tsx frontend/src/pages/RoomPage.test.tsx frontend/src/features/prejoin/PreJoinScreen.tsx frontend/src/features/prejoin/PreJoinScreen.test.tsx
git commit -m "feat(frontend): RoomPage drives role-aware join from URL + hash token"
```

---

### Task 14: App router shell + chat socket roomId

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/features/chat/hooks/useChat.ts`

**Interfaces:**
- Consumes: `LandingPage`, `RoomPage` (pages), `InvalidLinkScreen` (room-states), `TopBar`/`useApplyUiPreferences` (preferences), react-router `Routes`/`Route`.
- Produces: `App` renders `TopBar` + routes `/` → `LandingPage`, `/r/:roomId` → `RoomPage`, `*` → `InvalidLinkScreen`. `useChat` sends the real `roomId` in `join_chat`.

- [ ] **Step 1: Make useChat send the roomId**

The socket join now requires a `roomId` (Task 5). The local participant's room is the `roomId` returned at join; thread it via the connection store's `localParticipant`. Update `frontend/src/stores/useConnectionStore.ts` `LocalParticipant`:

```ts
export type LocalParticipant = { identity: string; displayName: string; roomId: string };
```

and update `RoomPage` Step 3's `setLocalParticipant` call to include `roomId: result.data.roomId` (apply this edit now):

```ts
    useConnectionStore.getState().setLocalParticipant({
      identity: result.data.identity,
      displayName: result.data.displayName,
      roomId: result.data.roomId,
    });
```

In `frontend/src/features/chat/hooks/useChat.ts`, include the roomId in both `join_chat` emits:

```ts
      socket.emit('join_chat', { roomId: localParticipant.roomId, identity, role });
```

```ts
    socket.emit('join_chat', { roomId: localParticipant.roomId, identity: localParticipant.identity, role });
```

> Update `frontend/src/stores/useConnectionStore.test.ts` and any `useChat`/store test that constructs a `LocalParticipant` to include `roomId` so they typecheck.

- [ ] **Step 2: Rewrite App.tsx as the router shell**

Replace `frontend/src/App.tsx` with:

```tsx
import type { JSX } from 'react';
import { Routes, Route } from 'react-router-dom';
import { TopBar, useApplyUiPreferences } from './features/preferences';
import { InvalidLinkScreen } from './features/room-states';
import { LandingPage } from './pages/LandingPage';
import { RoomPage } from './pages/RoomPage';

export function App(): JSX.Element {
  useApplyUiPreferences();
  return (
    <>
      <TopBar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/r/:roomId" element={<RoomPage />} />
        <Route path="*" element={<InvalidLinkScreen />} />
      </Routes>
    </>
  );
}
```

- [ ] **Step 3: Replace App.test.tsx with a thin routing test**

Replace `frontend/src/App.test.tsx` with:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import './shared/i18n';

vi.mock('./pages/LandingPage', () => ({ LandingPage: () => <div>landing</div> }));
vi.mock('./pages/RoomPage', () => ({ RoomPage: () => <div>room</div> }));

import { App } from './App';

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('App routing', () => {
  it('renders the landing page at /', () => {
    renderAt('/');
    expect(screen.getByText('landing')).toBeInTheDocument();
  });

  it('renders the room page at /r/:roomId', () => {
    renderAt('/r/r1');
    expect(screen.getByText('room')).toBeInTheDocument();
  });

  it('renders the invalid-link screen for an unknown path', () => {
    renderAt('/nonsense');
    expect(screen.getByText('This call was not found.')).toBeInTheDocument();
  });

  it('shows the theme and language controls on every screen', () => {
    renderAt('/');
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /russian/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the affected tests**

Run: `cd frontend && npx vitest run src/App.test.tsx src/features/chat src/stores/useConnectionStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/App.test.tsx frontend/src/features/chat/hooks/useChat.ts frontend/src/stores/useConnectionStore.ts frontend/src/stores/useConnectionStore.test.ts
git commit -m "feat(frontend): router shell (landing/room/invalid) + roomId-keyed chat join"
```

---

### Task 15: Full-stack gate

**Files:** none (verification only).

- [ ] **Step 1: Backend gate**

Run: `cd backend && npm run typecheck && npm run lint && npm test`
Expected: all clean / PASS.

- [ ] **Step 2: Frontend gate**

Run: `cd frontend && npm run typecheck && npm run lint && npm test`
Expected: all clean / PASS. If ESLint reports a `boundaries` violation, confirm `pages` imports only `features`/`shared`/`stores` and that `App.tsx` is the only importer of `pages`.

- [ ] **Step 3: Manual smoke (Docker)**

Run: `docker compose up --build` (repo root), then in a browser:
1. Open `http://localhost:5173/` → landing shows the tagline + "Start a call".
2. Click "Start a call" → URL becomes `/r/<id>#h=<token>`; pre-join shows "Enter call →"; enter a name → in-call; "Copy link" is visible.
3. Click "Copy link" → "Link copied!"; paste into a second browser → URL is `/r/<id>` (no `#h=`); pre-join shows "Join"; join as guest → both tiles appear; guest has no "Copy link".
4. Open `/r/bogus-id` → "This call was not found." with "Start a new call".

Expected: all four behave as described.

- [ ] **Step 4: Commit any smoke fixes, then finish the branch**

```bash
git add -A && git commit -m "fix(m3): smoke-test adjustments"   # only if needed
```

Then follow `superpowers:finishing-a-development-branch`.

---

## Self-Review

**Spec coverage (M3 scope):**
- FR-1 (create room, two URLs) → Tasks 4, 8, 11 (`POST /rooms`, `createRoom`, landing navigate to `/r/:id#h=`).
- FR-7 (host role from valid host URL; invalid → not-found) → Task 4 (`verifyHostToken`, `NOT_FOUND`), Task 13 (hash token → join).
- FR-8 (guest role from participant URL) → Task 4 (no host token → guest), Task 13.
- FR-9 (host-only Copy link, participant URL without token) → Task 12 (`CopyLinkButton`, role gate), Task 13 (`participantUrl` without hash).
- FR-30 / US-17 (landing content) → Task 11 + Task 9 (tagline/button) + global TopBar (theme/lang).
- US-1 (start a call + failure message) → Task 11.
- US-3 (copy link success/failure) → Task 12.
- US-4 (join via link; full; not-found) → Tasks 8/13 (`available`/`full`/`not-found`); **ended branch intentionally deferred to M4** (Global Constraints).
- NFR-6/7 (128-bit tokens) → Task 1 (`randomBytes(16).base64url`), asserted in `rooms.test.ts`/`app.test.ts`.
- Gap (a) routing → Tasks 7, 13, 14. Gap (b) URL/token scheme → hash-fragment design (Tasks 11/13). Gap (c) US-4 ended deferral → Global Constraints + Task 13 maps only the three live states. Gap (d) registry shaped for M4 → Task 1 (`hostIdentity`, `setHostIdentity`).

**Placeholder scan:** none — every code/test step carries complete code; commands have expected output.

**Type consistency:** `JoinResponse` (`role`/`roomId`) is identical in shared types (Task 8), `joinResponseSchema` (Task 8), backend join response (Task 4), and consumed in RoomPage (Task 13). `LocalParticipant` gains `roomId` (Task 14) and every emit/consumer is updated. `ControlsBarProps`/`CallShellProps` (`role`, `participantUrl`) match between Tasks 12 and 13. `RoomRegistry` method names (`create`/`get`/`verifyHostToken`/`setHostIdentity`) are consistent across Tasks 1, 4, 6.

**Out-of-scope guard:** no room destruction, ended-marker, grace, remove-guest, or Leave/Rejoin behavior is implemented — those remain for M4, which builds on `hostIdentity` recorded here.

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-30-m3-host-guest-rooms.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?** (Per memory `use-subagent-driven-implementation`, option 1 is our default — but I will not start until you confirm.)
