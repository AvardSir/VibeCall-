# MR3 — Review-Fix Plan

Reviewer: **artem.ry** (Maintainer). Source: `Мр3 последние правки.txt`.
Resolution rule for this pass: **favor the reviewer** — treat their preference as correct unless it
breaks something. Each item below is verified against the current code, not the MR paste (the paste
mixes old + already-edited code).

> **Sequencing vs. M3 — do MR3 first.** This is a review-fix pass on the MR that is currently open
> with artem.ry, so it must land before/as part of merging that MR. It also **must run before M3**
> (`2026-06-30-m3-host-guest-rooms.md`): both plans rewrite the **same `backend/src/socket.ts`** and
> both remove `fixedRoomName` from `config`. M3 re-keys chat/socket by `roomId`; the typed-events and
> DI-removal work here (§2) survives that change and makes it cleaner, but only if MR3 goes first —
> otherwise §2 gets partially redone. **Order: MR3 → M3.** When M3 later re-keys `socket.ts`, keep the
> typed `ClientToServerEvents`/`ServerToClientEvents` maps introduced in §2a/§3b.

Legend: ✅ already done · 🔴 correctness · 🟠 refactor · 🟡 minor/naming · ⚙️ infra ·
❓ judgment call (reviewer didn't fully specify — chosen reviewer-aligned option, flagged)

---

## 0. Already addressed — no action
- **#13 `apiClient.ts` "url-join либа"** ✅ — already imports `url-join` and builds URLs with it
  (`roomStatusUrl`, `joinUrl`). Verify `url-join` is in `frontend/package.json` deps.

---

## 1. 🔴 Correctness — `handleSendMessage` swallows nothing (`backend/src/socket.ts`, #3)
**Comment:** "а почему тут ошибки не ловишь?"
`join_chat` wraps its handler in `.catch(...)`; `send_message` calls `handleSendMessage(...)` bare.
It's synchronous but `chat.validateText/build/append` and `io.to().emit` can throw — the throw escapes
into Socket.IO's listener.
**Fix:** wrap the `send_message` listener body in `try/catch`, log via `logger.error({ err }, 'send_message handler failed')`,
mirroring the `join_chat` arm. (Keep `handleSendMessage` itself sync; guard at the listener.)

---

## 2. Backend socket typing + DI (`backend/src/socket.ts`, #1 & #2)

### 2a. 🟠 Type the socket events (#1 "типизировать ивенты сокета")
Introduce typed event maps and apply them to `Server`/`Socket`:
```ts
type ClientToServerEvents = {
  join_chat: (p: JoinChatPayload) => void;
  send_message: (p: SendMessagePayload) => void;
};
type ServerToClientEvents = {
  chat_history: (messages: ChatMessage[]) => void;
  chat_message: (message: ChatMessage) => void;
  message_failed: (e: { code: ChatErrorCode | 'NOT_A_MEMBER' }) => void;
};
```
Type `new Server<ClientToServerEvents, ServerToClientEvents, ...>` so `emit`/`on` are checked instead
of `emit(event: string, payload: unknown)`.

### 2b. 🟠 DI shape (#2 "DI такое спорное решение, тем более в таком виде(") — REVISED 2026-07-01: keep DI, drop the hand-rolled socket subsets
**Correction:** the original "drop DI, import modules directly like the rest of the backend" premise was
wrong — the rest of the backend **uses** DI (`createApp(deps: AppDeps)` with the same `Pick<LivekitAdmin,…>`
shape; controllers receive `config`/`admin` via deps). Removing DI only from `socket.ts` would make the
backend inconsistent. The reviewer's "тем более в таком виде(" targets the **hand-rolled structural
subsets** `EmittingSocket`/`Broadcaster` (reinventing types Socket.IO already provides), not the deps object.
**Decision (confirmed with user):**
- **Delete** `EmittingSocket` and `Broadcaster`. Type the handlers with Socket.IO's own generic
  `Socket<...>` / `Server<...>` (from §2a), with `SocketData = { binding?: ChatSocketBinding }` as the
  socket-data generic. Introduce readable aliases (e.g. `ChatSocket`, `ChatServer`).
- **Keep** the `ChatGatewayDeps` deps object and the injection in `server.ts` — consistent with
  `AppDeps`/`createApp`. (Its `Pick<>` narrowing mirrors `AppDeps`; leave it.)
- Because DI stays, `socket.test.ts` needs only minimal changes: keep `makeDeps`/`makeSocket`/`makeIo`,
  cast the fakes to the real types at the call sites (`as unknown as ChatSocket`/`ChatServer`). No module
  mocks, no handler-signature changes (params stay `(socket, deps, payload)` / `(socket, io, deps, payload)`;
  only the types tighten). §1's `send_message` try/catch stays.

> **Scope note (revised):** now that DI stays, this is a **typing change**, not a DI removal — much
> lighter than originally scoped. Do §2a first (define the event maps), then §2b (swap the hand-rolled
> socket subsets for real Socket.IO generics). Keep `handleJoinChat`/`handleSendMessage` **exported** and
> their signatures unchanged (params `(socket, deps, payload)` / `(socket, io, deps, payload)`); only the
> `socket`/`io` parameter TYPES change (`EmittingSocket`→`ChatSocket`, `Broadcaster`→`ChatServer`). The
> test keeps `makeDeps`/`makeSocket`/`makeIo`; add `as unknown as ChatSocket`/`ChatServer` casts at the
> call sites so the fakes satisfy the real types. No module mocks. `server.ts`'s
> `createSocketServer(httpServer, { config, admin, chat })` call is unchanged (deps object stays).

---

## 3. Frontend socket: extract from `useChat` + type events (#6 & #7)

### 3a. 🟠 Socket should not live in the chat hook (#6)
**Comment:** "сокет может быть не только в чате потенциально… лучше контекст или стор и доступ через
кастомный хук." Reviewer offered context **or** store.
**DECIDED: React context provider** (`shared/lib/SocketProvider.tsx`) owning one socket instance +
lifecycle, exposed via `useSocket()` (`shared/hooks/useSocket.ts`). A live socket is a connection, not UI
state, so context fits better than a Zustand store (and the store rules say stores hold UI state only).
`useChat` consumes `useSocket()` and keeps only chat concerns (join gating, message handlers).

### 3b. 🟠 Type frontend events (#7 "типизация событий")
Add `shared/lib/socketEvents.ts` with `ServerToClientEvents`/`ClientToServerEvents` (mirrors §2a).
**Decision (2026-07-01):** the maps are **deliberately duplicated** on FE and BE for now — this repo is
not an npm workspace and already uses the same "duplicate + cross-ref comment" convention
(`validation.ts`↔`useNameValidation.ts`, `ChatMessage`). Add a cross-reference comment in **both**
`shared/lib/socketEvents.ts` and `backend/src/socket.ts` pointing at each other **and** noting the
planned shared-contract module (see "Deferred follow-ups" below), so the temporary duplication is
explicit. Type the client as `Socket<ServerToClientEvents, ClientToServerEvents>`; drop the manual
payload casts in `useChat`'s `socket.on(...)` handlers.

---

## 4. 🟠 `apiClient` — generic wrapper + envelope, keep one guard on the token path (#14, #16, #17)

**Reviewer thread (3 comments on the same file, decoded):** manual type-guards were unreadable
(#14 — *already* replaced by zod in the current code) → zod on every response is overhead (#16) →
use the `ApiResponse` envelope and just state the type, trusting your own backend (#17). Net
direction: move *away* from heavy validation toward a lightweight generic wrapper.

**Verified against current code:** `apiClient.ts` currently runs `safeParse` on every response via
`roomStatusResponseSchema` / `joinResponseSchema` / `errorBodySchema`. The `ApiResponse<TData, TError>`
envelope and `JoinResult = ApiResponse<JoinResponse, JoinError>` already exist in `shared/types/index.ts`.

**DECIDED (confirmed 2026-07-01): generic `request<T>` wrapper everywhere; keep exactly ONE runtime
guard — on the `joinRoom` success (token) payload.** Rationale: that response feeds `accessToken` /
`livekitUrl` straight into the LiveKit SDK, so a blind `as JoinResponse` would turn a malformed backend
reply into a cryptic media failure three screens away instead of a clean `INTERNAL` at the boundary.
`getRoomStatus` (one string field) and the error branch are low-stakes → schema-free, which satisfies
the reviewer's "schemas on everything is overhead." This is a deliberate, narrow exception to
"favor the reviewer," scoped to the token path only.

**Steps:**
1. Add the generic wrapper (parses JSON, states the type; no runtime schema):
   ```ts
   async function request<T>(url: string, init?: RequestInit): Promise<T> {
     const res = await fetch(url, init);
     return (await res.json()) as T;
   }
   ```
2. `getRoomStatus` — drop `roomStatusResponseSchema`:
   ```ts
   export async function getRoomStatus(roomName: string): Promise<RoomStatus> {
     return (await request<{ status: RoomStatus }>(roomStatusUrl(roomName))).status;
   }
   ```
3. `joinRoom` — branch on `res.ok`, return the `JoinResult` envelope; keep `joinResponseSchema.safeParse`
   on the **success** body only, drop `errorBodySchema` (use the wrapper for the error branch):
   ```ts
   const joinResponseSchema = z.object({
     accessToken: z.string(), livekitUrl: z.string(),
     role: z.literal('guest'), identity: z.string(), displayName: z.string(),
   });

   export async function joinRoom(roomName: string, name: string): Promise<JoinResult> {
     const res = await fetch(joinUrl(roomName), {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ name }),
     });
     if (res.ok) {
       const parsed = joinResponseSchema.safeParse(await res.json());
       return parsed.success ? { ok: true, data: parsed.data } : { ok: false, error: 'INTERNAL' };
     }
     const body = (await res.json().catch(() => ({}))) as { error?: JoinError };
     return { ok: false, error: body.error ?? 'INTERNAL' };
   }
   ```
4. Keep the `zod` import (still used by the one `joinResponseSchema`). Remove `roomStatusResponseSchema`
   and `errorBodySchema`.
5. Tests: `apiClient.test.ts` — assert `getRoomStatus`/`joinRoom` happy paths, plus a malformed-join-body
   case still yields `{ ok: false, error: 'INTERNAL' }` (proves the retained guard works).

> Note: `useNameValidation`'s zod is a separate concern (see §8); the reviewer did **not** object to it.

---

## 5. 🟠 Extract a chat-message component (`MessageList.tsx`, #5)
**Comment:** "я бы в отдельный компонент chat message вынес."
Create `features/chat/components/ChatMessageItem.tsx` (avoid clashing with the `ChatMessage` type name)
holding the `<li>` render + `formatTime` + sending/failed status. `MessageList` maps items to it.

---

## 6. 🟠 `togglePanel` store action (`ControlsBar.tsx`, #4)
**Comment:** "togglePanel?" — replace `onClick={() => (isPanelOpen ? closePanel() : openPanel())}`.
Add `togglePanel` to `useChatStore` (open → also reset `unreadCount`, like `openPanel`; close → keep),
then `onClick={togglePanel}`. Keeps the open/close logic in the store per project rules.

---

## 7. 🟠 Memoization audit (#8) — DECIDED 2026-07-01: no-op (all current memos justified)
**Comment:** "пересмотреть ковровую мемоизацию… кастомные хуки ок, но в компонентах спорно."
Audit result (verified against code + prior-review ledger):
- `features/call/CallShell.tsx:30` `const handleError = useCallback(...)` → **KEEP.** It is passed to
  `<LiveKitRoom onError={handleError}>`; the prior whole-branch review added it deliberately so the SDK
  does not re-register the error listener on every render. The reviewer's #8 was about `useChat.ts` and
  he explicitly said hook-level memo is fine — this component memo is the justified exception, not the
  "carpet" he flagged. Removing it would regress a prior deliberate decision.
- `useChat.ts` `useCallback` and `useNameValidation.ts` `useMemo` are in **custom hooks** → keep
  (explicitly OK to the reviewer).
> Net: this item requires **no code change** — it is an audit that confirms the existing memos are all
> justified. Record the rationale; do not remove anything.

---

## 8. 🟡 `useNameValidation` unreadable ternaries (#15)
**Comment:** "нечитаемые тернарники((."
The refine `error:` values are already exactly the `NameErrorKey` strings (`nameEmpty|nameLength|nameChars`).
Replace the nested ternary with a direct, guarded read of `issue.message` (small `isNameErrorKey` guard or
a typed lookup), e.g. resolve to the message when it's a known key, else fall back to `nameEmpty`.

---

## 9. 🟡 ChatPanel redundant `aria-label` (#9 "title ниже")
The `<aside aria-label={t('title')}>` duplicates the visible `<header>{t('title')}</header>` directly below.
**Fix:** give the header an `id` and point the aside at it with `aria-labelledby`, dropping the redundant
`aria-label`.

---

## 10. 🟡 LanguageSelector `text` vs `label` (#11 "чем label от текст отличается?")
They differ (visible code `"EN"` vs accessible name e.g. `"English"`) but the names don't say so.
**Fix:** rename the prop `label` → `ariaLabel` in `LanguageButtonProps` (and the call sites) so the
distinction is self-documenting. No behavior change.

---

## 11. 🟡 Rename `DisplayNameInput` → `NameInput` (#12 "InputName? Зачем Display?")
Reviewer questions the "Display" prefix. Favor reviewer → rename component, file, props type
(`DisplayNameInputProps` → `NameInputProps`), and the import/usage in `PreJoinScreen.tsx:10,49`.
(Chose `NameInput` over `InputName` — adjective-noun reads more naturally and matches React naming.)

---

## 12. ⚙️ `.claude/settings.local.json` (#10 "попроси просто создать сеттинги с безопасными командами")
This is a **local, machine-specific** settings file that got committed; it contains a personal PowerShell
mp3-player command and absolute `C:\…` paths. Reviewer wants a minimal, safe allowlist.
**DECIDED: untrack + gitignore** — `git rm --cached .claude/settings.local.json`, add it to `.gitignore`
so personal allowlists never ship. If a shared baseline is wanted, commit a small `.claude/settings.json`
with only safe, portable commands (lint/typecheck/test/build).

---

## 13. ⚙️ Dockerfile base → alpine (`backend/Dockerfile.dev`, #18 "лучше alpine")
Change `FROM node:22-slim` → `FROM node:22-alpine`. The `CMD` uses `sh -c` + `node -e` (both fine on
alpine); deps are pure-JS so no build-toolchain needed. Smaller image.
> Consider the same for `frontend/Dockerfile.dev` for consistency (reviewer only flagged backend).

---

## Suggested order
> Whole pass runs **before M3** (see the sequencing note at the top).
1. 🔴 §1 (`send_message` error catch) — quick, correctness.
2. 🟡/⚙️ low-risk: §8, §9, §10 (rename), §11 (rename), §13 (alpine), §6 (togglePanel), §5 (extract component), §7 audit.
3. 🟠 typing: §2a (backend events) + §3b (frontend events).
4. 🟠 larger refactors: §4 apiClient (wrapper + one guard), §3a socket context (#6), §12 settings untrack.
5. 🟠 **heaviest, land last:** §2b DI removal (after §2a) — with the test-strategy decision recorded first.

Each change must keep `tsc --noEmit` + ESLint clean and update co-located tests.

## Resolved judgment calls (confirmed 2026-06-30)
1. **#2b DI:** drop `ChatGatewayDeps`/`EmittingSocket`/`Broadcaster`, import modules directly, rework `socket.test.ts`.
   Land last, after §2a; test rework via module mocks (strategy A) — see §2b scope note.
2. **#6 socket:** React context provider + `useSocket()` (not a Zustand store).
3. **#10 settings file:** untrack + gitignore `.claude/settings.local.json`.
4. **#14/16/17 apiClient zod (CONFIRMED 2026-07-01):** generic `request<T>` wrapper for `getRoomStatus`
   and the error branch; keep **exactly one** `safeParse` guard on the `joinRoom` success (token) payload;
   drop `roomStatusResponseSchema` + `errorBodySchema`, keep the `zod` import for the one remaining schema.
   Deliberate narrow exception to "favor the reviewer" — the join payload feeds tokens into LiveKit (see §4).

## Deferred follow-ups (own milestone — NOT in MR3)
- **Shared socket-contract module (decided 2026-07-01).** Replace the duplicated event maps (§2a/§3b)
  and the already-duplicated `ChatMessage` with a single shared source of truth consumed by both
  backend and frontend. Requires new build wiring (no npm workspace today): a root `shared/` dir, a
  tsconfig path/reference on each side (backend `rootDir`/`include` + ESM `.js` handling; frontend Vite
  alias), and unifying `ChatMessage`. Scoped as its own plan because it changes both build systems —
  out of scope for a review-fix pass. MR3 duplicates the maps as a documented temporary step.

## Updates (2026-07-01)
Post-review refinements folded in after verifying the plan against current code:
- Added the **MR3 → M3 sequencing** note (both rewrite `socket.ts` / remove `fixedRoomName`).
- Expanded **§2b** with an explicit test-rework strategy (module mocks, keep handlers exported, land last).
- Changed **§4** from "drop zod entirely" to a **middle ground** keeping one guard on the join-token path.
  Finalized §4 with concrete code (generic `request<T>` + retained `joinResponseSchema` on the success body).
- **§7:** resolved to **no-op** — `CallShell` `handleError` memo is justified (LiveKit listener stability,
  prior deliberate review decision); hook memos are reviewer-approved. Audit only, no code change.
- **§2a/§3b:** confirmed **temporary duplication** with cross-ref comments; real shared-contract module
  deferred to its own milestone (see "Deferred follow-ups").
