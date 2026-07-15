# Fix Plan — Dev feedback (chat UX + keyboard nav)

**Date:** 2026-07-03
**Source:** developer feedback on the running app (received before the PRD-gap-fix branch was reviewed).
**Status:** plan only — not yet implemented.

> Note: this feedback predates the `fix(prd-gaps)` commit (2ada09c). Item 2 partially overlaps work
> already landed there (chat auto-scroll to newest); this plan finishes the layout side of it.

## Parallelization verdict

**Not worth parallelizing.** Only 4 small fixes and two of them (items 1 & 2) both edit
`MessageList.tsx`, so agents would contend. Do it sequentially in one short pass; item 4 needs a
debugging step, not fan-out.

---

## Fix 1 — Empty-chat state needs an icon, not just text

**Problem:** Figma `Frame 1321314319` shows the empty chat with a picture/placeholder icon **above**
the "no messages" text. Our empty state renders text only (`MessageList.tsx:24-28`,
`t('empty')` = "No messages yet.").

**Files:**
- `frontend/src/shared/assets/icons/` — add the icon SVG + register it.
- `frontend/src/shared/assets/icons/index.ts` — add the import, the `IconName` union member, and the `ICONS` map entry.
- `frontend/src/features/chat/components/MessageList.tsx` — empty branch.
- `frontend/src/features/chat/components/MessageList.test.tsx` — assert the icon renders.

**Steps:**
1. Pull the exact icon from Figma `Frame 1321314319` via the Figma MCP (`get_design_context` /
   `get_screenshot` / `download_assets`) to match the design; author it as an inline SVG using
   `fill`/`stroke="currentColor"` (per `40-styling-and-i18n.md`) so it inherits `text-slate-500`.
2. Register it in `icons/index.ts` (e.g. `IconName` `'noMessages'` or `'imagePlaceholder'`).
3. In the empty branch render the icon centered **above** `t('empty')` (keep the existing string;
   it already exists EN/RU). Match Figma size/spacing/muted color.
4. Test: empty list renders both the icon and the message.

**Verify by eye:** open chat with no messages → icon + "No messages yet." centered, matching Figma.

---

## Fix 2 — Messages must be bottom-anchored (stop forcing scroll)

**Problem:** messages align to the **top** of the panel while the newest is at the bottom, so with a
full history the user must scroll down to the latest. (Auto-scroll-to-newest already landed in
2ada09c; this fixes the *resting layout* so short histories sit at the bottom and long ones open at
the newest message.)

**Files:** `frontend/src/features/chat/components/MessageList.tsx` (+ its test).

**Steps:**
1. Restructure so the scroll container is a `flex flex-col overflow-y-auto` and the `<ul>` gets
   `mt-auto` (push content to the bottom when it's shorter than the viewport). Keep the `listRef`
   auto-scroll effect on the scroll container so it still snaps to newest on send/receive.
   - Watch out: putting `justify-end` directly on an `overflow-y-auto` flex container can clip the
     top items in some browsers — use the `mt-auto` inner-wrapper pattern instead.
2. Confirm the auto-scroll effect targets the actual scrolling element after the restructure (the
   ref must be on the element with `overflow-y-auto`).
3. Test: with a short list, items sit at the bottom; with a long list, `scrollTop` is at the bottom
   (newest visible) on mount/append.

**Verify by eye:** few messages → they sit at the bottom near the input; many messages → panel opens
showing the newest without manual scrolling.

---

## Fix 3 — Own-message attachments are left-aligned (should follow the bubble side)

**Problem:** own text bubbles are right-aligned (`ChatMessageItem.tsx:53` `self-end text-right`), but
the attachments row (`:75-92` `flex flex-wrap gap-2`) defaults to `justify-start`, so images/files on
your own messages render on the **left** while your text is on the right.

**Files:** `frontend/src/features/chat/components/ChatMessageItem.tsx` (+ its test).

**Steps:**
1. Add a side-aware justify to the attachments container: `clsx('mt-1 flex flex-wrap gap-2', isOwn && 'justify-end')`
   so own attachments hug the right edge, matching the text; incoming stay `justify-start`.
2. Sanity-check the "Sending…"/"Not delivered" rows and the attachment-only name row also sit on the
   correct side for own messages (li is already `text-right` for own).
3. Test: an own message with ≥2 attachments has the attachments container aligned to the end.

**Verify by eye:** send several files → thumbnails/chips appear on the right, under your right-aligned text.

---

## Fix 4 — Keyboard navigation incomplete (Copy link not operable from keyboard)

**Problem:** the dev reports keyboard nav "not done"; concrete case: focusing **Copy link** and
activating it produces no "Link copied!" confirmation. `ControlButton` is already a native `<button>`
(`ControlButton.tsx:36`) which *should* fire `onClick` on Enter/Space, so the root cause needs to be
found, not guessed.

**Approach:** use **systematic-debugging** first — reproduce, then find the actual cause before editing.

**Likely candidates to check:**
- Is the button actually in the Tab order and reachable on the in-call screen (nothing with
  `tabindex=-1`, no overlay/pointer trap, host-only render present)?
- Does `navigator.clipboard.writeText` reject under keyboard activation / non-HTTPS / unfocused-document
  in the target browser? If it can reject, the current `catch` sets `failed` (shows the URL box) — but
  the dev sees *nothing*, which points more at focus/reachability than at the clipboard call.
- Does the `Tooltip` wrapper interfere with focus/activation?

**Files (likely):** `frontend/src/features/call/components/CopyLinkButton.tsx`,
`frontend/src/shared/ui/ControlButton.tsx`, possibly `ControlsBar.tsx` and `shared/ui/Tooltip.tsx`;
plus a broader Tab-order pass across landing / pre-join / in-call / chat.

**Steps:**
1. Reproduce in a real browser (Tab to Copy link, press Enter, then Space) and identify whether the
   handler fires at all (temporary log / breakpoint).
2. Fix the found cause. If clipboard rejects under keyboard activation, add a resilient fallback
   (e.g. a hidden selectable input + `document.execCommand('copy')`, or surface the existing
   `copyFailed` selectable-URL path) so the confirmation/feedback always appears.
3. Broader keyboard-nav audit (dev said nav is "not done" in general): verify every interactive
   control (controls bar, chat input/attach/send, theme/language, remove-guest, dialog buttons,
   room-state CTAs) is Tab-reachable and Enter/Space-activatable with the focus ring from NFR-2.
4. Tests: `userEvent.tab()` reaches Copy link and `userEvent.keyboard('{Enter}')` (and Space) shows
   the "Link copied!" confirmation (mock `navigator.clipboard`).

**Verify by eye:** Tab through the call screen → focus ring visible on each control; Tab to Copy link,
press Enter → "Link copied!" appears; repeat with Space.

---

## Suggested commit grouping

Small, so 1–2 commits: (a) chat UX (Fixes 1–3), (b) keyboard navigation (Fix 4). Run
`typecheck` + `lint` + tests for both `frontend/` and `backend/` once at the end, then a Docker smoke
of the chat panel and keyboard flow.
