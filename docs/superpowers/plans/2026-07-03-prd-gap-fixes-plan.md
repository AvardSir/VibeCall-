# PRD Gap-Fix Plan — Missing + Deviations

**Date:** 2026-07-03
**Source:** PRD-compliance audit (11-agent parallel review) of `prd-kmb-video-chat.md` v2.0.
**Scope:** the one **Missing** requirement and all **Partial / deviation** findings. Runtime-only
`cannot-verify` items (NFR-1/5/9/13) are **out of scope** here.

---

## Parallelization verdict

**Yes — parallelize into 8 streams.** The blocker is three *shared* files that many fixes want:

| Shared file | Fixes that naively touch it |
| --- | --- |
| `frontend/src/features/call/components/ControlsBar.tsx` | in-call disable-on-denied, toggle error handling, unread-dot, 24px gap |
| `frontend/src/shared/i18n/en.ts` + `ru.ts` | unsupported-browser string, camera/mic error strings, counter reword |
| `backend/src/socket.ts` | chat trim, grace-state push on join |

We remove all three contention points **up front in a single sequential Phase 0**, after which the
8 streams are **fully file-disjoint** → no merge conflicts, no worktrees needed (agents edit
different files in the same tree). Phase 0 is ~30 min of mechanical edits; the parallel Phase 1
is where the real time is saved.

Design decisions that make the streams disjoint:
- **All i18n edits live in Phase 0.** Streams only *consume* keys, never edit `en.ts`/`ru.ts`.
- **All `ControlsBar.tsx` edits go to one stream (S2).** The unread-dot fix (C3) moves out of the
  "chat" stream into S2 because it lives in `ControlsBar`.
- **Chat text trim is applied in `backend/src/chat.ts` `validateMessage`, not in `socket.ts`.** That
  keeps `socket.ts` owned solely by the grace stream (S6).

---

## Phase 0 — sequential prerequisites (main tree, one commit)

Do these first, alone, then dispatch Phase 1.

1. **i18n keys (`en.ts` + `ru.ts`, keep both in parity):**
   - `roomStates.unsupportedBrowser` = `"Your browser may not support video calls. Please use the latest version of Chrome, Firefox, Safari, or Edge."` (RU translation).
   - `call.cameraAccessError` = `"Unable to access camera. Please check your device or browser settings."`
   - `call.micAccessError` = `"Unable to access microphone. Please check your device or browser settings."`
   - Reword `chat.charCount` from `'{{length}}/1000'` to a **remaining** count, e.g. `'{{remaining}} characters left'` / RU equivalent (the PRD says the counter shows the remaining count).
2. **No shared type changes are required** — `useMediaStore` already exposes
   `cameraPermission` / `micPermission`, which S2 consumes.

**Gate after Phase 0:** `npm run typecheck` in `frontend/` (keys resolve, no unused-key breakage).

---

## Phase 1 — 8 parallel streams (file-disjoint)

Each stream: **owns only the files listed**, must not touch `en.ts`/`ru.ts`, must add/adjust the
co-located `*.test.ts(x)` for the behavior it changes, and must **not** run repo-wide lint/typecheck
(that happens once in Phase 2, per house style for milestone mode).

### S1 — Pre-join per-device permissions  *(root cause; enables 2 dead PRD scenarios)*
- **Files:** `frontend/src/features/prejoin/hooks/useDevicePermissions.ts` (+ `.test.ts`).
- **Fix:** replace the single `getUserMedia({video,audio})` with **two independent requests** (or a
  combined request plus a per-track fallback) so camera-only-denied and mic-only-denied set
  `cameraPermission`/`micPermission` independently instead of collapsing both to `denied`.
  Preserve current both-granted / both-denied behavior and stream cleanup.
- **PRD:** US-2, FR-11 (four distinct outcomes). The four branches already exist in
  `PreJoinScreen.tsx` — do **not** edit that file; just make the hook drive them.
- **Done when:** unit test proves cam-denied+mic-granted yields `{cameraPermission:'denied', micPermission:'granted'}` and vice-versa.

### S2 — In-call controls bar  *(owns ControlsBar exclusively: C3, P2, P3, X2)*
- **Files:** `frontend/src/features/call/components/ControlsBar.tsx` (+ tests `ControlsBar.test.tsx`, `ControlsBar.chat.test.tsx`).
- **Fixes:**
  - **P2 (FR-12/17/18, US-6/7):** read `cameraPermission`/`micPermission` from `useMediaStore`;
    when denied, render the mic/cam `ControlButton` as `disabled` (greyed) and guard against
    `setCamOn(true)`/`setMicOn(true)`.
  - **P3 (FR-17/18):** wrap `setCameraEnabled`/`setMicrophoneEnabled` in `.catch` → revert the store
    toggle to its previous value and surface the inline error above the bar using the Phase-0
    `call.cameraAccessError` / `call.micAccessError` keys, auto-dismiss after 4000ms (mirror the
    existing `shareError` pattern already in this component).
  - **C3 (FR-25/US-9):** change the unread indicator from a numeric badge (`{unreadCount}`) to a
    small **dot** (presence-only); keep the appears-while-hidden / clears-on-open logic.
  - **X2 (FR-19):** increase separation of the red End/Leave button from the adjacent control from
    `gap-4` (16px) to **≥24px** (e.g. an `ml-6`/spacer on the danger button, leaving the rest at `gap-4`).
- **Done when:** tests cover disabled-when-denied, error revert + message, dot render.

### S3 — Chat panel (display + input + state + backend validate)  *(C1, C2, C4, C5, C6)*
- **Files:** `frontend/src/features/chat/components/MessageList.tsx`,
  `ChatMessageItem.tsx`, `ChatInput.tsx`; `frontend/src/stores/useChatStore.ts`;
  `frontend/src/features/chat/hooks/useChat.ts`; `backend/src/chat.ts` (+ their tests).
- **Fixes:**
  - **C1 (US-9/FR-23):** auto-scroll the message list to the newest item on send/receive (ref +
    `scrollTop`/`scrollIntoView` effect keyed on message count; respect user-scrolled-up if trivial,
    otherwise always stick to bottom).
  - **C2 (US-9/FR-23):** format timestamps as 24-hour `HH:MM` — pass `{hour12:false}` (or
    `Intl.DateTimeFormat` with `hourCycle:'h23'`) in `ChatMessageItem.tsx`.
  - **C4 (VAL-ChatText):** trim leading/trailing whitespace **before send/broadcast** — apply in
    `backend/src/chat.ts` `validateMessage` (return trimmed `value`) **and** trim the frontend
    optimistic copy so it matches. (Do this in `chat.ts`, **not** `socket.ts`.)
  - **C5 (VAL-ChatText):** the counter must show **remaining** — pass `remaining = MAX - length` to
    the Phase-0 `chat.charCount` key in `ChatInput.tsx`.
  - **C6 (FR-24/US-10):** on `Not delivered`, provide a real resend path — either keep the failed
    message editable/retryable or restore text+staged attachments to the composer; add a retry
    affordance on the failed bubble. Fix the FIFO mislabel when multiple own messages are in flight
    (`useChatStore` reconciliation should match by id, not first-`sending`).
- **Note:** C3 (unread dot) is **not** here — it is in S2 (`ControlsBar`).
- **Done when:** tests cover scroll-to-bottom, 24h format, trim, remaining counter, resend restores content.

### S4 — Image lightbox / attachments  *(A1, A2)*
- **Files:** `frontend/src/features/chat/components/ImageLightbox.tsx`, `AttachmentThumbnail.tsx` (+ tests).
- **Fixes:**
  - **A1 (US-10/FR-27):** replace the fully-opaque `bg-black` backdrop with a **semi-transparent**
    dim (e.g. `bg-black/70`) so the call is visible behind. The backdrop was made opaque to fix a
    zoom flicker — re-solve the flicker without full opacity (e.g. isolate/opacity on the image layer,
    `will-change`, or a separate non-animated backdrop element) rather than reintroducing the flicker.
  - **A2 (FR-27 a11y):** make non-animated thumbnails focusable (`role="button"` + `tabIndex=0` +
    key handler, matching the animated variant) so focus can **return to the originating thumbnail**
    on lightbox close.
- **Done when:** test asserts backdrop is not fully opaque and thumbnail is focusable/focus-restored.

### S5 — Call-view fixes  *(X1, X3, X5)*
- **Files:** `frontend/src/features/call/CallShell.tsx`, `components/VideoTile.tsx`,
  `components/VideoGrid.tsx`, `components/ScreenShareView.tsx` (and `CallStage.tsx` if needed) (+ tests).
- **Fixes:**
  - **X1 (US-13/FR-6):** auto-dismiss the remove-guest dialog when the targeted guest leaves before
    confirm — add an effect in `CallShell` watching the participants roster; clear `removeTarget`
    when its identity is no longer present.
  - **X3 (ES-HostAlone):** render "Waiting for someone to join…" as a **centered overlay** on the
    lone host's tile (not a bottom pill), **and** keep it visible as a notice in the screen-share
    layout (`ScreenShareView`) when the lone host is sharing.
  - **X5 (FR-14):** camera-off tile background must stay **dark in both themes** — replace
    `bg-slate-200 dark:bg-surface-elevated` on the camera-off fill with a dark backing in light theme
    too (video tiles keep a dark backing per Design Considerations §12).
- **Done when:** tests cover dialog auto-dismiss and waiting-overlay presence during share.

### S6 — Grace-state push on join  *(X4; owns socket.ts)*
- **Files:** `backend/src/socket.ts`, `grace.ts`, `server.ts`; `frontend/src/features/call/hooks/useRoomLifecycle.ts` (+ tests).
- **Fix (FR-4):** when a socket joins a room currently in grace, emit the **current countdown**
  immediately (extend `grace.ts` to expose remaining seconds; emit from `handleJoinChat` alongside
  `chat_history`/`share_state`) so a mid-grace joiner sees the overlay at once instead of on the next
  ~1s tick. Frontend consumes the initial value in `useRoomLifecycle`.
- **Done when:** backend test: joining during grace receives current-seconds event on connect.

### S7 — Unsupported-browser detection + screen  *(M1 — the only Missing item)*
- **Files (new + wiring):** new `frontend/src/shared/lib/detectBrowser.ts`; a new
  banner/notice component (e.g. `shared/ui/UnsupportedBrowserNotice.tsx`); wire it into the **first
  screen** — `App.tsx` / `pages/LandingPage.tsx` and `features/prejoin/PreJoinScreen.tsx` (a guest's
  first screen). Consumes Phase-0 `roomStates.unsupportedBrowser`.
- **Fix (FR-31 / ES-814):** detect browsers outside the supported set (latest-2 Chrome/Firefox/
  Safari/Edge — a pragmatic UA/feature check; e.g. missing `RTCPeerConnection`/`getDisplayMedia` or
  known-old UA) and show the verbatim message on the first screen; the user may continue at own risk
  (informational, non-blocking).
- **Note:** confine to `App.tsx` / `LandingPage.tsx` / `PreJoinScreen.tsx` + new files; **S1 does not
  touch these files** (S1 is hook-only), so no conflict.
- **Done when:** unit test with a stubbed unsupported UA renders the notice; supported UA does not.

### S8 — Focus-visible indicators  *(X6 / NFR-2)*
- **Files:** `frontend/src/shared/ui/ControlButton.tsx`, `features/preferences/components/ThemeToggle.tsx`,
  `LanguageSelector.tsx`, and shared button primitives used by room-state screens (+ tests if present).
- **Fix (NFR-2):** add explicit `focus-visible:` ring styling (theme-aware, AA-contrast) to icon-only
  and screen buttons instead of relying on the browser default outline.
- **Note:** `ControlButton.tsx` (shared/ui) is distinct from `ControlsBar.tsx` (S2) — disjoint.
- **Done when:** buttons have a visible, theme-aware focus ring.

---

## Phase 2 — integration & verification (main tree)

1. Merge/collect all stream edits (single tree, disjoint files → clean).
2. Run once: `frontend/`: `npm run typecheck && npm run lint && npm test`;
   `backend/`: `npm run typecheck && npm run lint && npm test`.
3. **Smoke the real stack** (`docker compose up --build`) — per house rule green gates ≠ works:
   - deny only camera in the browser prompt → verify S1 shows camera-off + mic-on pre-join, and S2
     keeps the in-call camera toggle disabled;
   - send a chat message → auto-scroll + 24h time + remaining counter; force a failure → resend;
   - open an image → semi-transparent backdrop, call visible behind, focus returns on close;
   - host disconnect → guest sees overlay; a guest joining mid-grace sees the countdown immediately;
   - open in an unsupported UA (or stub) → notice appears.
4. Commit grouping (per "prefer few logical commits"): suggested — (a) Phase 0 i18n, (b) permissions
   S1+S2, (c) chat S3+S2-dot, (d) attachments S4, (e) call-view S5+S6, (f) unsupported S7, (g) a11y S8.
   Adjust to keep it to a handful of coherent commits.

---

## Dependency notes

- **S2 depends on the store contract, not on S1's code** — `cameraPermission`/`micPermission` already
  exist; S1 only makes the *values* more accurate. Both can run concurrently.
- Everything else is independent.
- **No worktrees required:** the 8 streams are file-disjoint after Phase 0, so they can run
  concurrently in the same working tree; gates run once in Phase 2.
