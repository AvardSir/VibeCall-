# PRD Gap → Roadmap (bring implementation up to PRD)

> **Status:** Roadmap / decomposition. Each milestone below becomes its own detailed
> implementation plan (`docs/superpowers/plans/YYYY-MM-DD-<milestone>.md`) written with the
> `superpowers:writing-plans` skill, one at a time, in the agreed order.

**Goal:** Bring the existing kmb-video-chat implementation to full PRD behavior
(`prd-kmb-video-chat.md` v2.0).

**Source of truth (decided 2026-06-30):** The **PRD is binding**. The **Figma file is outdated** and
is used only as a *visual reference* for the screens it happens to cover (dark palette, typography,
component look, room layouts, chat panel, pre-join). On any PRD-vs-Figma conflict, **PRD wins**.
Scope = **full PRD v1.0** — nothing is cut to match Figma. For screens/features Figma lacks (landing
+ host link model, theme toggle, language selector, light theme, chat attachments, screen share,
host controls, most status screens), design in a consistent style and build per PRD. See memory
`figma-outdated-prd-authoritative`.

**Figma reference:** file `RhDsYTrw77YBs88mLteyUP` — covers dark-theme tokens (Colors/Fonts),
components (mic/cam/logout/chat icons, videocontainer, Input, Button, control, tooltip, error),
pre-join + "Room is full", and rooms for 1/2/3/4 participants with a text-only chat panel.

**Scope reality:** This is full-stack. The backend today is a **single fixed room `main`** with
guest-only join, text chat, and capacity cap. Everything host-related, multi-room, attachments,
screen-share, grace, and personalization is absent on **both** ends.

---

## What already exists (baseline — do NOT rebuild)

- Fixed room `main`; `GET /rooms/:roomName` (status `available|full`); `POST /rooms/:roomName/join`
  (guest-only, returns `accessToken/livekitUrl/role:'guest'/identity/displayName`).
- Capacity cap (4) enforced server-side; surfaced as `full` + `CallFullScreen`.
- Pre-join: camera/mic preview, permission handling, name validation (client + server in sync).
- LiveKit wired on the client (`CallShell` connects); **own tile only** — no remote grid.
- Text chat over Socket.IO: `join_chat` / `send_message` / `chat_history` / `chat_message` /
  `message_failed`; in-memory history; unread count (client-side); optimistic send + failed status.
- Stores: `useMediaStore`, `useConnectionStore`, `useChatStore`, `useUiStore` (theme/language state
  exists but is **not wired** to `document` class or `i18n.changeLanguage`, no persistence).
- Tailwind v4 (via `@tailwindcss/vite`, tokens in `index.css` `@theme`, `.dark` custom variant).
- i18n: EN/RU with exact key parity; `lng:'en'` hardcoded; switching not wired.
- Stack actually installed: React 19.2, TS 6.0, Vite 8, Tailwind 4.3, Vitest 4, Express-based
  backend. (Deviates from CLAUDE.md's "React 18"; see memory `stack-react19-deviation`.)

---

## Milestones (each = one independent, shippable plan)

Ordered by value + dependency. M1 and M5 directly address the user's stated pains
(theme/language, photos/files in chat). M3 is the architectural foundation for host features.

| # | Milestone | PRD coverage | Side | Depends on | Independent deliverable |
|---|-----------|--------------|------|-----------|--------------------------|
| **M1** | **Theme + Language switching** | FR-28, FR-29, US-15, US-16; NFR-4/5 | FE only | — | Top-right theme toggle + EN/RU selector on every screen; instant app-wide switch; session-persisted; resets to Dark/EN on new browser session |
| **M2** | **Adaptive video grid + camera-off / mute tiles + tooltips** | FR-13, FR-14, FR-15, FR-20; US-5/6/7 | FE only | — | Remote participants render; 1/2/3/4 layouts; camera-off = centered mic-icon + name (no avatar); corner/centered mute indicator; state-aware tooltips |
| **M3** | **Host/Guest model: landing, multi-room, roles, copy link** | FR-1, FR-7, FR-8, FR-9, FR-30; US-1/3/4/17; NFR-6/7 | BE + FE | — (but is foundation for M4) | Landing page + "Start a call" creates an independent room with a secret host URL + participant URL; role-aware join; host-only "Copy link" |
| **M4** | **Host lifecycle: end call, remove guest, grace, status screens** | FR-3, FR-4, FR-6, FR-19; US-11/12/13/14; §7 screens | BE + FE | M3 | End call (destroy room), Leave/Rejoin, Remove-guest (modal + LiveKit kick), 60s host grace overlay + countdown, all status screens (ended/removed/left/host-ended/not-found) |
| **M5** | **Chat attachments + image lightbox** | FR-26, FR-27; US-10; validation table row 3 | BE + FE | — (only existing chat) | Paperclip → stage ≤5 files (type/size validated), image thumbnails + file chips, full-size image overlay (Esc/backdrop close), Sending…/Not delivered status |
| **M6** | **Screen share** | FR-16; US-8 | BE + FE | M2 | Share button + one-sharer arbitration, shared content as "contain" main area with label, participant tiles → thumbnail strip, Stop sharing, error/auto-dismiss |
| **M7a** | **Figma pixel-perfect: foundation** | Visual conformance (no new FR) — audit §5 items 1,2,3,5,6,9,10 | FE only | — (incorporates commit `385f7c9`) | Roboto Flex + Figma type scale; `@theme` tokens (accent-active, danger-strong, text-muted, white overlays); `Button` (primary/secondary/danger, 48px, `rounded-[10px]`); pre-join card rebuilt pixel-perfect (412px card + name input + inline error); Figma icon SVGs exported & bundled; `Tooltip` + inline-error sizing. Every Figma-covered **static** surface matches Figma |
| **M7b** | **Figma pixel-perfect: in-call rebuilds** | Visual conformance (no new FR) — audit §5 items 4,7,8 | FE only | M7a + M5 + M6 | V2 controls bar (48px round icon controls: mic/cam white, end/leave red, chat dark→blue, screen-share slot, copy-link → bottom-right group); grid geometry (gap-4, per-count widths 1220/1382/1168, `aspect-video`, 1/2/3/4 layouts); chat panel + message items + input rebuilt to Figma (340px panel, close-arrow header, separator, fade gradient, bubble radii, inline timestamp, single-line send-icon input). Every Figma-covered **in-call** surface pixel-perfect |

**Cross-cutting (folded into the milestone that first needs it, not a separate plan):**
- Unsupported-browser screen (FR-31) → M1 or M3 (first-screen check).
- a11y: keyboard nav + focus + aria-labels (NFR-2/3) → applied per component as built.
- i18n string completeness (every new string EN+RU verbatim from PRD) → every milestone.
- `NFR-12` "Unable to connect…" message → M3/M4 connection handling.

---

## Recommended order

1. **M1 — Theme + Language.** Smallest, frontend-only, zero dependencies, immediately visible, and
   it unblocks verifying the Light theme for everything built afterward.
2. **M2 — Video grid.** The actual core call experience; currently only your own tile shows.
3. **M3 — Host/Guest + landing.** The foundation the host features hang off.
4. **M4 — Host lifecycle.** Builds on M3.
5. **M5 — Chat attachments.** Independent; can be pulled earlier if "photos in chat" is the priority.
6. **M6 — Screen share.** Reuses M2's tile rendering for the thumbnail strip.
7. **M7a — Figma foundation.** After the functional milestones land; corrects the design-system
   primitives (font, type scale, tokens, `Button`, pre-join card, icons, tooltip) every screen
   composes. Self-contained (FE only); incorporates the already-built base on branch
   `feat/figma-design-audit` (commit `385f7c9`) rather than redoing it.
8. **M7b — Figma in-call rebuilds.** Last. Depends on M7a (design system) **and** M5 + M6, because
   the controls-bar / grid / chat-panel rebuilds touch the *final* chat and controls/share code.

> **M2 deviation (2026-07-02, intentional):** active-speaker highlighting was implemented in M2's
> `VideoTile` despite PRD non-goal #8 — kept for Figma visual fidelity. Recorded in
> `docs/superpowers/specs/subtasks/03-videochat.md` §8.
>
> M5 (attachments / "фото в чате") is independent of M2–M4 and may be reprioritized to right after
> M1 if that pain matters more than the video grid.
>
> **M7 (pixel-perfect Figma conformance) runs last, split into M7a + M7b.** Its source of truth is
> the **Figma Conformance Audit** (`docs/superpowers/design/2026-07-01-figma-conformance-audit.md`) —
> a complete, MCP-verified gap analysis with a ranked §5 fix backlog and exact per-component values.
> M7 is the delivery vehicle for that backlog; it adds **no new PRD behavior**, only visual fidelity
> on the screens Figma covers. Screens Figma lacks stay styled per PRD (audit §6) and are out of M7
> scope. The 4-up grid has no V2 Figma frame → M7b uses the audit's V1-geometry fallback (2×2,
> 576×324, gap 16, content 1168×664) with a comment noting it was not confirmed in V2.

---

## Resolved architectural decision (room model)

**Decided: build the PRD host/guest model** (not Figma's simpler single-room "join by name").
PRD **FR-1 + intro** require *multiple independent rooms* and a *secret host URL token* — the
current fixed-`main`-room backend cannot express this. **M3 therefore includes a real backend
change**: a room-creation endpoint, a host-token concept (≥128-bit, NFR-6/7), room-keyed state
(rooms registry, chat history keyed by room, socket room keying), and role-aware token minting.
This is the largest single item in the roadmap and the foundation M4 builds on.
