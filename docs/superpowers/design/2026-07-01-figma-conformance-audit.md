# Figma Conformance Audit — pixel-perfect gap analysis (2026-07-01)

**Scope:** current frontend (M1–M3, `frontend/src/`) vs Figma `RhDsYTrw77YBs88mLteyUP` (page `0:1` "Design").
**Priority:** PRD wins on behavior/scope; **Figma visual fidelity is a TOP goal — pixel-perfect on the screens Figma covers** (pre-join, room grids 1–4, chat panel, room controls, shared components, dark palette). Screens Figma lacks (landing, host-link, status screens, attachments, share, light theme) are styled per PRD and are **out of audit scope** — no gaps invented there.
**Method:** exact values pulled via Figma MCP (`get_variable_defs`, `get_design_context`) + read-only comparison against `index.css`, `shared/ui/*`, `features/call/components/*`, `features/prejoin/*`, `features/chat/*`. Read-only — no code changed.
**V2 re-audit (2026-07-01):** All room-grid layout values (§4) have been re-verified against the **V2 section (`42:4635`)** — the confirmed final design. V1-derived numbers have been replaced. ⚠ **Open question: no 4-up frame exists in V2** — see §4 for details and interim fallback guidance.

---

## 0. Design decisions log (clarified with the user — 2026-07-01)

Running record of design clarifications from our sessions. (Durable cross-session principles — items 1–3 — are also saved in memory `figma-outdated-prd-authoritative`.)

1. **Figma fidelity = TOP priority** — pixel-perfect on the screens Figma covers; PRD still wins on behavior / scope / any conflict.
2. **V2 section (`42:4635`) = the FINAL design; V1 (`39:4398`) = outdated.** Build & audit room/controls layouts against V2. Shared frames (Fonts/Colors/Components, pre-join "Join the room") apply to both.
3. **Camera-off tile = mic-state icon + name, NO avatar** (PRD override; the V1 `cat`/placeholder images are NOT used). Cats may be reused later on unspecified screens (404 / empty states) — parked.
4. **Controls styling (V2):** mic + camera = **white** 48px round (dark icon), hover white/75; **end/leave = RED** round handset, hover `#c13c3c`; standalone chat button (bottom-right) = **dark** when panel closed, blue `#2c68fa` when open.
5. **Center controls bar = 4 buttons:** `mic · camera · screen-share · end/leave`. **Screen-share is the 3rd** (after camera, before end call); it is NOT in Figma V2 → generate it in the same V2 style.
6. **Copy link** (host-only; hidden for guests). **IN-CALL ONLY** (PRD FR-9) — bottom-right group, immediately **LEFT of the chat button** (variant A: `Copy link · Chat`). **NOT on pre-join:** wireframe H2 shows it on host pre-join, but the **wireframe is outdated and PRD wins** (FR-9 = in-call only); Figma Welcome frames also omit it. Style to match V2 (Copy link is PRD-only, absent from Figma). Code gap: M3's copy-link sits in the center bar → move to the right group.
7. **4-up grid:** no V2 frame exists → reuse **V1 geometry** (2×2, 576×324, gap 16, content 1168×664, side margins 136).
8. **Already applied + verified** (worktree branch `worktree-agent-a5f6807d1ebb330a0`, awaiting merge after M4): Roboto Flex variable font (`wdth 130`), `<Text>` type scale (300/452/600/800, H1 22/lh30, sm lh18), `Button` (`rounded-[10px]`, 48px, 16/452, `secondary`+`danger` variants).
9. **Chat input stays MULTI-LINE** (`<textarea>`) — deliberate, accepted deviation from Figma's single-line field (better UX; PRD mandates only text-only chat).
10. **Message sender-name color follows Figma:** **own** messages = blue `#2c68fa` (`--color-accent`), **others** = purple `#9180ff` (`--color-sender`).
11. **Pre-join device toggles (camera/mic):** **structure per PRD** (FR-10/11 require them in the card) + **visual design per Figma** — keep the toggles.
12. **Source-of-truth hierarchy:** **PRD is supreme** (behavior / scope / what-exists) → **Figma** = pixel-perfect visual target on covered screens → **wireframes** (`KMB_VideoChat_Wireframes`) are **ALSO outdated** (loose hints only; PRD wins over the wireframe too, e.g. copy-link-on-pre-join). General rule when they disagree: PRD decides *what/behavior*, Figma decides *how it looks*.

---

## 1. Summary & verdict

**Overall: ~60% there on structure/color, but NOT pixel-perfect — two systemic gaps dominate everything.** The color palette is essentially correct (7 core tokens match exactly). But **(A) the typeface and type scale are wrong across the entire app**, and **(B) the shared components (Button, control pills, Input) use different sizes/radii/paddings than Figma**. Because every screen composes those, fixing A + B moves the whole product most of the way to pixel-perfect.

**Top 10 highest-impact gaps (ranked):**
1. **Font family is not Roboto Flex.** Figma uses **Roboto Flex** (variable, `wdth 130`, specific `fontVariationSettings`); `index.css` declares no font-family → app renders in the Tailwind default system stack. Affects 100% of text.
2. **Type weights don't match.** Figma weights are **300 (body), 452 (button), 600 (subtext-bold), 800 (headings)**; code `<Text>` uses 400/500/600/700. Body text should be **light (300)**, headings **extrabold (800)** — currently regular/semibold.
3. **Type sizes/line-heights off.** Figma H1 = **22px/lh30**, H2 = **20px/lh28**, body = 16/lh24, subtext = **14/lh18**; code maps to Tailwind defaults (H1→24px `text-2xl`, subtext lh 20px). H1 size and all 14px line-heights are wrong.
4. **Button geometry wrong.** Figma: `rounded-[10px]`, `px-28 py-12`, **16px/weight-452 text**, height **48px**, fixed `w-[332px]` in forms. Code `Button`: `rounded-lg (8px)`, `px-4 py-2`, `text-sm (14) font-medium (500)`, ~34px tall, auto width.
5. **Missing "secondary" (white) button variant.** Figma has primary(blue) + **secondary(white bg / #181b1d text)**; code has primary + **ghost(transparent/slate-200)** — a different thing. Secondary=white is used in Figma CTAs.
6. **Call controls are text buttons, not round icon controls.** Figma (V2) controls = **48px round** (`rounded-[30px]`), 30px icon, but colors DIFFER by control (see §0.4 & §3 for the exact, corrected values): **mic + camera = white** (dark icon, hover white/75), **end/leave = RED** hangup, standalone **chat button = dark** (closed) / blue (open). Center bar = `mic · camera · screen-share · end/leave` (4). Code renders `<Toggle>` + text buttons ("Chat", "Leave") — no round icon controls.
7. **Input spec drift.** Figma input: bg `#2A2E30`, `rounded-[11px]`, `px-12 py-14` (48–52px tall), `w-[332px]`, placeholder `rgba(255,255,255,0.25)` weight-300, hover border white-25%, focus border `#2C68FA`, error border `#FF4E4E`. Verify the pre-join name field matches all of these.
8. **Grid gap + max-width.** Figma tile gap = **16px** (code `gap-3` = 12px); room content width ≈ **1168px** (4-up) / **1382px** (2-up), code caps at `max-w-5xl` (1024px). Tiles are **16:9** (576×324 / 683×384); verify tiles enforce 16:9.
9. **Chat panel width.** Figma docked chat = **340px** wide, full height; grid shrinks to ~1030px when open. Verify `ChatPanel` width = 340px and that the grid reflows.
10. **Missing overlay + extended palette tokens.** Figma uses `rgba(255,255,255,0.25/0.75)` overlays and extended reds/blue-less/`#9BA6B7` gray that aren't in `@theme` — needed for input placeholder, hover states, secondary-button hover.

---

## 2. Design tokens

### 2.1 Colors — Figma (`Colors` `31:2993`) vs `index.css` `@theme`

| Figma variable | Figma hex | Code token | Status |
|---|---|---|---|
| Primary/White | `#FFFFFF` | (Tailwind `white`) | ✓ |
| Primary/Black | `#181B1D` | `--color-surface` `#181b1d` | ✓ |
| Primary/Gray dark | `#1F2224` | `--color-surface-elevated` `#1f2224` | ✓ |
| Primary/Gray | `#2A2E30` | `--color-surface-muted` `#2a2e30` | ✓ |
| Primary/Blue | `#2C68FA` | `--color-accent` `#2c68fa` | ✓ |
| Primary/Blue more | `#285DDF` | `--color-accent-strong` `#285ddf` | ✓ |
| Secondary/Red | `#FF4E4E` | `--color-danger` `#ff4e4e` | ✓ |
| Secondary/Purple | `#9180FF` | `--color-sender` `#9180ff` | ✓ |
| Primary/Blue less | `#487CFD` | — | **MISSING** (blue pressed/active) |
| Secondary/Red more | `#C13C3C` | — | **MISSING** (danger hover) |
| Secondary/Red less | `#F46F6F` | — | MISSING (danger subtle) |
| Overlay gray / Gray 25% | `#9BA6B7` | — | **MISSING** (secondary/placeholder text) |
| Overlay white 25% / 75% | `rgba(255,255,255,.25/.75)` | — | **MISSING** (placeholder, hover states) |

> Core palette is exact — good. Add the missing overlay + hover tokens; several component states below depend on them. Note the `control` component pulls a stray `Fora Main / Black #1D1D1B` (vs `#181B1D`) — a library remnant; treat `#181B1D` as canonical.

### 2.2 Typography — Figma (`Fonts` `3:2505`) vs `shared/ui/Text.tsx`

Figma family = **`Roboto Flex`** (variable; call sites carry `fontVariationSettings: '"GRAD" 0,"XOPQ" 96,"XTRA" 468,"YOPQ" 79,"YTAS" 750,"YTDE" -203,"YTFI" 738,"YTLC" 514,"YTUC" 712,"wdth" 130'`).

| Figma style | size | weight | line-height | Nearest code (`<Text>`) | Gap |
|---|---|---|---|---|---|
| H1 | 22 | **800** | 30 | `size="2xl"` → 24px + `weight` 600/700 | size 24≠22, weight, lh |
| H2 | 20 | **800** | 28 | `size="xl"` → 20px | weight (max is bold 700≠800), lh |
| P (body) | 16 | **300** | 24 | `size="md"` → 16px, `weight="regular"` (400) | **weight 400≠300** |
| P bold | 16 | **800** | 24 | `weight="bold"` (700) | weight 700≠800 |
| Subtext bold | 14 | 600 | 18 | `size="sm"` + `weight="semibold"` (600) | **lh 20≠18** (Tailwind `text-sm` default) |
| Subtext | 14 | **300** | 18 | `size="sm"` + regular (400) | weight + lh |
| Button label | 16 | **452** | 24 | (Button uses `text-sm`+`font-medium`) | size 14≠16, weight 500≠452 |

**Findings:** (a) `index.css` has no `font-family` / `@font-face` — **Roboto Flex is not loaded**; (b) the code weight scale (400/500/600/700) can't express Figma's 300/452/800; (c) `<Text>` `SIZE_CLASSES` uses the Tailwind default scale, so H1 renders 24px (Figma 22) and all 14px text renders lh 20 (Figma 18).

### 2.3 Spacing / radius (from components)
- Button radius **10px**, Input radius **11px**, control pill radius **30px** (full-round on 48px). Code uses `rounded-lg` (8px) uniformly.
- Form control width **332px**; form vertical rhythm **24px** gaps (pre-join Title→Input→Button).
- Grid gap **16px**; controls-bar gap **16px** (control 48px, next at +64).

---

## 3. Shared components (Figma spec → code gap)

**Button** (`31:4741`) — Figma: `flex items-center justify-center px-[28px] py-[12px] rounded-[10px] w-[332px]`, text `Roboto Flex 16px / weight 452 / lh24`. Primary bg `#2C68FA`, hover `#285DDF`, text white. Secondary bg `#FFFFFF` (hover `rgba(255,255,255,.75)`), text `#181B1D`.
→ Code `shared/ui/Button.tsx`: `rounded-lg px-4 py-2 text-sm font-medium`; primary `bg-accent hover:bg-accent/90`; **ghost** (transparent/slate-200) instead of **secondary(white)**; no `w-[332px]`, no size variant. **Gaps:** radius, padding, text size/weight, height (48 vs ~34), missing secondary(white) variant, hover should be solid `#285DDF` not `/90`.

**Input** (`31:4642`) — bg `#2A2E30`, `px-[12px] py-[14px] rounded-[11px] w-[332px]`; states: default (no border), hover (`border rgba(255,255,255,.25)`), focus (`border #2C68FA`, text white), error (`border #FF4E4E`); placeholder text `rgba(255,255,255,.25)` weight-300 16px.
→ Verify `features/prejoin` name field: expected `bg-surface-muted rounded-[11px] px-3 py-3.5`, focus ring/border `accent`, error border `danger`, placeholder `text-white/25`.

**Control button** (V2 confirmed — values extracted from `31:4947`/`31:4872`/`54:2973` and all V2 bar frames, 2026-07-01):
- Shape: `size-[48px] rounded-[30px]` (perfect circle).
- Icon: 30×30px, inset `left:9 top:9` (9px from all edges).
- Default **mic / cam: `bg-white`** with a dark icon — **confirmed via native screenshot of bar `31:4872`** (both circles are white, dark glyphs).
- Hover (mic/cam): `bg-[rgba(255,255,255,0.75)]` — confirmed on `54:2975` in 2-up.
- End/leave: `bg-[#ff4e4e]` (red) default, `bg-[#c13c3c]` hover — confirmed on `31:4950`/`54:2976` and the native `31:4872` screenshot (3rd control is a red hang-up).
- **Standalone chat button (panel CLOSED): DARK fill** (dark round bg + white speech-bubble icon) — **confirmed via native screenshot of `50:4092`**; it is NOT white like mic/cam. (A component-data read had lumped it with the white controls — the screenshot is canonical: closed = dark.)
- Chat button when panel OPEN: `bg-[#2c68fa]` (blue) — from `50:4129` in 3+chat.
- V2 bar carries **only 3 controls: mic · camera · end-leave** (NOT 4). **Screen-share is a PRD requirement (FR-21) absent from Figma V2 — DECISION (user 2026-07-01): generate a screen-share control in the SAME V2 style (48px white round, icon), inserted between camera and end-leave** → center bar order: **mic · camera · screen-share · end/leave(red)**.
- **Bottom-right group (layout per wireframe H3, `KMB_VideoChat_Wireframes_with_Overview.html`):** the host-only **"Copy link"** control sits immediately **LEFT of the Chat** control (order: `Copy link · Chat`), bottom-right, separate from the center bar. "Copy link" is **PRD-only** (FR-9: in-call only, host-only) — absent from Figma V2 (which predates the host model), so style it to match the V2 controls. The chat control is the standalone sibling at `left:1363` (right margin 29px); Copy link sits just left of it.
- Gap between controls in bar: **16px** (confirmed: x positions 0/64/128, spacing = 48+16=64 ✓).
- **4-up:** DECISION (user 2026-07-01) — reuse V1 geometry (2×2, 576×324, gap 16, content 1168×664, side margins 136) since V2 has no 4-up frame.
→ Code gaps: `ControlsBar` renders `<Toggle>` + text buttons (→ round icon buttons); **`CopyLinkButton` is currently in the CENTER bar next to Leave (M3 Task 12) — MOVE it to the bottom-right group, left of Chat, per wireframe**; add the screen-share control (V2-style) between camera and end/leave; the chat button is a standalone bottom-right sibling, not in the bar frame.

**Tooltip** (`56:3010` on 2-up, V2 confirmed) — `bg-white rounded-[8px] px-12 py-6`, text 14px/600/lh18 (Subtext-bold), total height **36px**. Tail: 14×6px downward white triangle below body. Positioned **44px above** the control button (y=716 vs button y=760). Tooltips are **state-aware** — the observed instance text is `"Turn off camera"` (shown while the camera is ON). Code has a custom `Tooltip`; verify bg-white (not dark!), height 36px, `rounded-[8px]`, padding, and 44px offset from trigger. **⚠ String wording differs:** Figma = `"Turn off camera"` vs current i18n `call.cameraTooltipOn` = `"Turn camera off"` — reconcile the exact tooltip strings (mic/camera/screen-share/end-leave) against the PRD (PRD is authoritative for copy); check all state-aware pairs.

**Error text** (`31:5088`, 192×24, `Secondary/Red`) — inline validation in red `#FF4E4E`, 14px. Verify NameField error uses `text-danger` at 14px.

**Video container** (`31:2927`) — variants: video / placeholder / camera-off ("Variant3"), 16:9 (e.g. 576×324, radius `rounded-[12px]`). **Camera-off tile** confirmed from V2 `50:3957`: bg `#1f2224`, centered content = 32×32 mic-off icon + name text 20px/800/lh28 (H2 style, `font-extrabold`), centered horizontally and vertically inside the tile with a `bg-[rgba(31,34,36,0.5)] rounded-[9px]` pill around both. **No avatar** — PRD-compliant ✓. **Name label** (live-video tile, bottom-left): `bg-[rgba(31,34,36,0.5)] rounded-[9px] pl-6 pr-10 py-5`; 20×20 mic icon; name text 14px/300/lh18 (Subtext style). Tile inner padding: `p-[10px]`. Verify `VideoTile` corner radius `rounded-[12px]` + 16:9 aspect + camera-off vs live-video variants.

**Chat field / send** (`42:5174`, states: `default` `42:5175` / `hover` `42:5177` / `Variant3` (active) `50:3600`) — full spec extracted 2026-07-01:

- **Container:** `w-[332px]`, `rounded-[11px]`, `px-[12px] py-[8px]`; height ~50px (py-8 + lh24 line = 8+24+8 = 40px inner → ~50px with border/padding). The container width inside the panel is `w-[316px]` (panel left-inset 12px on each side within 340px panel).
- **Background by state:**
  - `default`: `bg-[#181b1d]` (Primary/Black), no border
  - `hover`: `bg-[#1f2224]` (Primary/Gray dark), `border border-[rgba(255,255,255,0.25)]`
  - `Variant3` (text entered / active): `bg-[#181b1d]`, no border
- **Placeholder text:** `text-[rgba(255,255,255,0.25)]` (default) / `text-[rgba(255,255,255,0.5)]` (hover = "Start typing"), font-light (300), 16px/lh24, Roboto Flex wdth:130.
- **Active text:** `text-white`, font-light (300), 16px/lh24.
- **Send icon** (`42:5190`, `icon/send`): **34×34px** — confirmed from both `42:5174` Variant3 and `50:4178` (chat panel instance). ⚠ The prior one-liner said 24px — **corrected to 34px**. The send icon renders as a right-pointing arrow/chevron; color appears blue (`#2c68fa`) in hover+active states (same send icon asset used for hover and Variant3). `node-id: 50:3602` within the panel instance.
- **"Empty" icon** (`42:5186`, `Chat field/icon/empty`): 24×24px placeholder node — used when no send icon is shown (default no-content state). Renders as a dark square (empty/invisible in default state).
- **Gap between text and icon:** `gap-[12px]` (Variant3/hover); `gap-[23px]` (default — send icon is the same 34×34 but spacer is wider when placeholder state).
- **Bottom fade gradient** (inside panel): `bg-gradient-to-b from-[rgba(31,34,36,0.6)] to-[#1f2224]`, height 65px, sits at `top-[745px]` (above the input row at `top-[778px]`), `w-[316px]`, `left-[12px]` — creates a fade over the last messages.
- **Input row position in panel:** `left-[12px] top-[778px]` within the 840px panel → bottom margin = 840 − 778 − 50 ≈ 12px.

→ Code `features/chat/components/ChatInput.tsx`: uses a `<textarea rows={2}> + <Button>` in a `border-t` form — entirely wrong shape. **Gaps vs Figma:** (a) textarea (multi-line) instead of single-line input; (b) `<Button>` text label instead of 34×34 send icon SVG; (c) `rounded-lg` container instead of `rounded-[11px]`; (d) `bg-surface-muted` vs `bg-[#181b1d]`; (e) hover state border `rgba(255,255,255,0.25)` missing; (f) `border-t border-surface-muted` outer wrapper should be removed (panel input is inset 12px, no separator line); (g) padding `px-3 py-2` vs `px-[12px] py-[8px]`; (h) no bottom-fade gradient above input.

**Chat panel** (`50:4178`, `63:3131` — both are the same `chat` symbol; `50:4178` is the instance in the 3+chat frame) — full panel spec extracted 2026-07-01:

- **Panel container:** `w-[340px]`, full viewport height (840px), `bg-[#1f2224]` (Primary/Gray dark). Docked `right-0 top-0`.
- **Header row** (`top-[24px] left-[24px]`): `flex gap-[10px] items-start`.
  - **Close/back arrow** (`50:4243`, `arrow`): `bg-white rounded-[17px] size-[24px] overflow-clip`; inside: 16×16 `icon/arrow` rotated −90° (pointing left), inset 4px from all edges. The arrow icon is a right-pointing chevron/arrow SVG rotated to point left.
  - **"Chat" title**: 20px / weight 800 / lh28 (H2), `text-white`, Roboto Flex wdth:130.
- **Separator line** (`50:2796`): `absolute left-0 top-[64px] w-[340px] h-0` — a 1px horizontal rule spanning the full panel width at y=64.
- **Messages area:** `left-[12px] w-[316px]`, starts at `top-[93px]` (64px header + 29px gap below separator). Scrollable; overflows clip at `h-[426px]` starting `top-[389px]` in the panel's coordinate space — the visible messages region effectively fills from y=93 to y=743 (bottom of fade gradient at y=745).
- **Message groups:** vertically stacked, `gap-[4px]` between messages in the same group; `gap-[4px]` between consecutive bubbles in one group. No explicit gap between different-sender groups in Figma — groups simply flow with `py-px` wrapper.

**Single message item** (fully confirmed from `50:4178` / `63:3131`):

- **Bubble container:** `bg-[#181b1d] px-[12px] py-[10px]`, `gap-[4px]` between sender-name row and body+timestamp row.
- **Border-radius:** first bubble in a sender group = `rounded-[12px]` (all corners). Subsequent bubbles in same group = the "inner" corner closest to adjacent bubble is cut to `rounded-[4px]`:
  - Others (left-aligned): `rounded-bl-[4px] rounded-br-[12px] rounded-tl-[12px] rounded-tr-[12px]`
  - Own (right-aligned): `rounded-bl-[12px] rounded-br-[4px] rounded-tl-[12px] rounded-tr-[12px]`
- **Sender name line:** `font-semibold` (600) `text-[14px] lh-[18px]` (Subtext-bold style).
  - Others' sender name: `text-[#9180ff]` (Secondary/Purple = `--color-sender`).
  - Own sender name ("You"): `text-[#2c68fa]` (Primary/Blue = `--color-accent`).
- **Message text + timestamp on one line** (inline): message text `text-white font-light text-[14px] lh-[18px]`, then ` · ` separator, then timestamp `text-[rgba(255,255,255,0.5)] text-[14px]`. All Roboto Flex wdth:130.
- **Alignment:** Others = `items-start` (left edge at left-[12px] within panel); Own = `right-0` (right-aligned within the 316px area). No background color difference between own/others bubbles — both use `bg-[#181b1d]`.
- **"No messages yet" empty state:** not shown explicitly in any frame — Figma does not have an empty-chat frame. The PRD specifies this text; style it as 14px/300 `text-[rgba(255,255,255,0.5)]` centered vertically/horizontally in the messages area (consistent with the Subtext style and dim-text pattern).

→ Code `features/chat/components/ChatMessageItem.tsx` gaps: (a) sender name uses `text-xs text-slate-400` — must be 14px/600 `text-[#9180ff]` (others) / `text-[#2c68fa]` (own); (b) bubble uses `rounded-lg bg-surface-muted px-3 py-2 text-sm` — must be `rounded-[12px]/[4px] bg-[#181b1d] px-[12px] py-[10px] text-[14px]/lh-[18px]`; (c) timestamp is a separate `div` — should be inline after message text with ` · ` separator; (d) no distinction between first/subsequent bubbles in a group (rounded corner logic). Code `features/chat/ChatPanel.tsx` gaps: (e) `w-80` (320px) → must be `w-[340px]`; (f) header is a plain `border-b p-3` — must match Figma: close-arrow (`bg-white rounded-[17px] size-[24px]`) + H2 title at `left-[24px] top-[24px]`; (g) `bg-surface` → should be `bg-[#1f2224]`; (h) no bottom fade gradient above input; (i) `fixed` positioning is correct; (j) no separator line at y=64.

**Icon set** (`call-icon` component `24:2789`) — full glyph inventory extracted 2026-07-01:

The `call-icon` component has two props: `property1` (glyph category) and `property2` (state). All glyphs are **34×34px** at the component level (`size-[34px]`) and rendered at **30×30px** when inset 9px inside the 48px control button (`left:9 top:9`).

| Prop combination | node-id | Description | Export name |
|---|---|---|---|
| `property1="mic" property2="on"` | `10:3551` | Microphone active (dark glyph) | `mic-on` |
| `property1="mic" property2="off"` | `10:3553` | Microphone muted (crossed-out mic) | `mic-off` |
| `property1="cam" property2="on"` | `10:3592` | Camera active | `cam-on` |
| `property1="cam" property2="off"` | `24:2788` | Camera off (crossed-out cam) | `cam-off` |
| `property1="on" property2="logout"` | `31:2862` | Hang-up / leave (phone handset rotated) | `hangup` |
| `property1="chat" property2="on"` | `50:4082` | Chat / speech bubble | `chat` |

- The logout/hangup icon (`31:2862`) uses `overflow-clip` on the container; the glyph group is inset `31.55% 8.34% 35.07% 8.32%` inside the 34×34px box.
- All other glyphs (mic-on, mic-off, cam-on, cam-off, chat) are full-bleed images within the 34×34px box — export as SVG from Figma.
- **Screen-share glyph:** absent from Figma — must be sourced externally (a standard screen-share/monitor SVG in the same dark-on-white style, clipped to 30×30px). Per PRD FR-21 this glyph is mandatory.
- **Arrow icon** (`50:4239`, `icon/arrow`): 16×16px inside a `bg-white rounded-[17px] size-[24px]` circle. Used only as the chat-panel close button. Rotate −90° (makes right-pointing arrow point left). Export as SVG.
- **Send icon** (`42:5190`, `icon/send`): 34×34px, used in the chat input row. Renders as a right-pointing filled chevron/arrow in blue (`#2c68fa`). Export as SVG. ⚠ The prior spec entry said 24px — **corrected to 34px** (confirmed from `42:5174` Variant3 code and panel instance `I50:4178;42:5192;50:3602`).

→ All glyphs must be **exported as SVG** from Figma and bundled in `shared/assets/icons/` (or similar). The control bar currently imports no SVGs — this is the primary gap for the controls-bar visual rebuild (backlog item 4).

---

## 4. Per-screen gaps

**Pre-join** — Welcome states `2:1881` (W1 empty), `31:4649` (W2 name entered), `31:4976` (W3 error), `31:5094` (W4 room-full), Input component `31:4642`. Full spec extracted 2026-07-01:

**Card container** (node `10:3189` / `31:4650` / `31:4977` / `31:5095`):
- `bg-[#1f2224] rounded-[12px] p-[40px]` (all four Welcome states identical)
- Width: **412px** (`w-[412px]`), horizontally centered (`left-[514px]` on a 1440px canvas → (1440−412)/2 = 514 ✓)
- Vertical position: `top-[185px]` on an 840px frame → centered vertically at approx 185–185+card-height
- Inner content stack: `flex flex-col items-center gap-[12px]` — 12px gap between the preview/avatar element and the form group below

**Preview/avatar element "pic"** (node `31:3523` / `31:4651` etc. — the `pic` instance):
- Size: **224×170px** (`w-[224px] h-[170px]`), `shrink-0`
- In Figma: static cat-illustration asset (inside the pic node, the actual image insets `5.29% 11.15% 6.14% 10.49%`)
- **⚠ Intentional divergence (PRD + decision log):** The real app replaces the Figma static illustration with a **live camera preview** (`<CameraPreview>`). This is correct per PRD — do NOT reintroduce the cat illustration. Spec the camera preview as the same 224×170 block, `rounded-[12px]` (to match the overall card radius; exact tile radius not separately specified for the preview element), mirrored for self-view. The 224×170 area sits at the top of the card stack.
- Welcome-4 ("Room is full") uses a **different illustration asset** (`36:3569` — a different cat pose) within the same 224×170 pic element. This screen is a status screen (PRD out-of-Figma-scope for the camera preview substitution), so the illustration is kept as-is for that state.

**Form group** (node `10:3535` / `31:4652` / `31:4979` / `31:5204`):
- `flex flex-col items-center gap-[24px]` — **24px gap** between: Title → Input → Button (Welcome-1/2/4); Title → (Input+error group) → Button (Welcome-3)

**Title** (node `2:1882` / `31:4653` / `31:4980` / `31:5098`):
- Welcome-1/2/3: text `"Enter your name"`, H1 style: **22px / weight 800 / lh30**, `text-white`, Roboto Flex wdth:130
- Welcome-4: text `"Room is full"`, same H1 style

**Input field** (node `10:3516` / `31:4647` / `31:5082`):
- `bg-[#2a2e30] px-[12px] py-[14px] rounded-[11px] w-[332px]`; height = 14+24+14 = **52px**
- **States:**
  - `default` (W1): no border; placeholder `"Name"`, `text-[rgba(255,255,255,0.25)]`, font-light 300, 16px/lh24
  - `focus` (W2, shown after typing): `border border-[#2c68fa] border-solid`; text content `text-white`, font-light 300, 16px/lh24
  - `error` (W3): `border border-[#ff4e4e] border-solid`; placeholder text still `text-[rgba(255,255,255,0.25)]` (user cleared the field); or `text-white` if user has text with error
  - `hover` (not shown as a separate Welcome state but from `31:4642` component): `border border-[rgba(255,255,255,0.25)]`
- No visible label above the input (Figma uses only the placeholder "Name"). Note: the PRD requires the label — check i18n `nameLabel` key; either hide the label visually or match Figma exactly.

**Error state layout** (Welcome-3, node `31:5092`):
- The Input + error text are wrapped in a sub-group: `flex flex-col items-start justify-center gap-[8px]` — **8px gap** between input bottom and error text
- Error text node `31:5089`: `text-[#ff4e4e] text-[14px] font-light` (Subtext 300), `leading-[18px]`, `flex gap-[4px] items-start` with a `"*"` prefix span and the message span
- Error message: `"* Please enter your name"` (verbatim; the `*` and text are separate child spans with 4px gap)
- The error group + Button are still separated by the 24px `gap-[24px]` of the form group — the Button does not shift independently; the sub-group (Input + error) simply grows and the outer gap holds at 24px.

**Button** (node `10:3518` / `31:4655` / `31:4982`):
- W1/2/3: `bg-[#2c68fa] rounded-[10px] w-[332px] px-[28px] py-[12px]`; height = 12+24+12 = **48px**; text `"Join the room"`, weight 452, 16px/lh24, `text-white`
- W4: `bg-white rounded-[10px] w-[332px] px-[28px] py-[12px]`; text `"Back"`, weight 452, 16px/lh24, `text-[#181b1d]` — this is the **secondary (white) button** variant
- Button label per PRD (not Figma's "Join the room"): host = **"Enter call →"**, guest = **"Join"**.
- **No "Copy link" on pre-join** (host or guest). PRD FR-9 = **in-call only**; the wireframe H2 shows one here but the wireframe is outdated → PRD wins. (See §0 item 6.)

**Vertical rhythm summary:**
```
card: p-40 (all sides)
  ├─ pic block:          224×170   (gap-12 below)
  └─ form group:         flex-col gap-24
       ├─ Title:         22px/lh30
       ├─ Input (or error group):   332×52 (+ 8px gap + error 18px if error state)
       └─ Button:        332×48
```
Total card content height (no error): 170 + 12 + 30 + 24 + 52 + 24 + 48 = **360px** → card outer height = 360 + 40 + 40 = **440px** (approximate; matches visual).

→ Code `features/prejoin/PreJoinScreen.tsx` gaps: (a) outer wrapper `max-w-xl` (576px) + `gap-5` — must be a fixed-width `w-[412px]` card, `rounded-[12px]`, `bg-[#1f2224]`, `p-[40px]`, inner `gap-[12px]` / `gap-[24px]` as above; (b) `DeviceToggles` component is rendered inside the card — **DeviceToggles are not part of the Figma pre-join card** (mic/cam toggles are absent from all 4 Welcome frames); investigate whether DeviceToggles should remain (PRD calls for device previews) or be positioned outside/below the card; (c) `NameInput.tsx` uses `rounded-lg border border-slate-700 bg-surface-muted px-3 py-2` → must be `rounded-[11px] bg-[#2a2e30] border-[#2c68fa]/[#ff4e4e] px-[12px] py-[14px] w-[332px]` no visible label wrapper; (d) error span uses `text-xs text-red-400` → must be `text-[14px] text-[#ff4e4e] font-light leading-[18px]` with `"* "` prefix; (e) no `<span>` label wrapper (Figma shows no above-field label).

> **All room-layout values in this section are now anchored on V2 (`42:4635`), verified 2026-07-01 via Figma MCP `get_design_context`.** V1 values have been replaced. The only remaining V1 reference is the 4-up open question below.

**Room grids** (V2 section `42:4635`; all frames are 1440×840 px canvas):

- **1-up** (`31:4946`): single tile `31:4953` — `left:110 top:37 w:1220 h:686` → **1220×686 (16:9 exact)**. Side margins 110px. Bar `31:4947`: `left:632 top:760 w:176 h:48`; 3 controls at x=0/64/128 → gap **16px** between controls. Separate chat control `50:4095` at `left:1363 top:760` (right margin ≈29px). Figma's 1-up shows a single **filled** tile (live video), NOT the empty-alone state — it didn't mock it. **⚠ PRD §7 REQUIRES a "Waiting for someone to join…" overlay when the host is alone** (host keeps "Copy link" visible) → implement per PRD even though Figma omits it (PRD wins on behavior/content). Layout confirmed via screenshot 2026-07-01.
- **2-up** (`31:4911`): tile container `31:4916`: `left:29 top:228 w:1382 h:384`. Two tiles at **683×384** each, at relative x=0 and x=699 → gap = 699−683 = **16px**. Top/bottom offset within 840px frame: top=228, tile h=384, bar at y=760 → 840−760−48=32px bottom margin. Bar `54:2973` identical position to 1-up. **Hover state** confirmed in this frame: `54:2975` `bg-[rgba(255,255,255,0.75)]` (camera button hovered). Also present: `50:3951` (all-camera-off 2-up variant): same tile geometry, tiles bg `#1f2224`, centered content = 32×32 mic-off icon + 20px/800/lh28 name text (H2) — **no avatar** (PRD-compliant ✓).
- **3-up** (`31:4871`): grid group `31:4876`: `left:136 top:48 w:1168 h:664`. Tiles: top-left `left:136 top:48 w:576 h:324`, top-right `left:728 top:48` (gap=728−136−576=**16px**), bottom-center `left:432 top:388` (row gap=388−48−324=**16px**). Side margins: left=136, right=136 (symmetric). Content width **1168×664**; outer left/right margins **136px** each.
- **4-up** — **⚠ OPEN QUESTION: No 4-up frame exists in V2.** The V2 section (`42:4635`) contains only: 1-up (`31:4946`), 2-up (`31:4911`), 2-up cam-off (`50:3951`), 3-up (`31:4871`), 3+chat (`50:4120`, `63:3121`). The 4-up layout (`2:1720`) is only present under V1 (outdated section). **Decision needed:** does the 4-up reuse the V1 2×2 layout (2-row×2-col, 576×324 tiles, gap 16, content 1168×664, side margins 136), or is the final 4-up layout simply missing from the design? Until resolved, implementing the 4-up should follow V1 geometry (`2×2`, 576×324, gap 16, content 1168×664) with a comment noting it was not confirmed in V2.

→ Code `VideoGrid`: `gap-3` (→ **`gap-4`**), `max-w-5xl` (1024px) is too narrow — widen: 1-up→~1220px, 2-up→1382px (near full width), 3-up and 4-up→1168px; add `aspect-video` on every tile. Top margin for 2-up is 228px from canvas top; at 840px total height this leaves ~228px above and ~228px between tile bottom and bar — a sizeable vertical gap that the current code may not reproduce.

**Room + chat open** (`50:4120`, `63:3121`): chat panel `50:4178` docked at `left:1100 w:340 h:840` (full viewport height). Grid group `50:4125`: `w:1031` (1100−32−37 margin = 1031 usable). Tiles shrink to **508×286** (16:9 ✓). Bar shifts left to `left:454` (centered in 1100px grid area: 1100/2−88=462, ~8px rounding). Active chat-button color: **`bg-[#2c68fa]`** (blue when panel is open, node `50:4129`). Chat panel internals: header "Chat" at H2 (20px/800/lh28) with a 24×24 white close-arrow `rounded-[17px]` at `left:24 top:24`; horizontal separator at y=64; messages area `left:12 w:316`; chat input `42:5192` at `left:12 top:778 w:316 bg-[#181b1d] rounded-[11px] px-12 py-8` with 34×34 send icon. → Verify `ChatPanel` = `w-[340px]` full height, grid area flexes to remaining width, bar re-centers, chat button turns blue (`bg-accent`) when panel is open.

**Controls bar** (all V2 bar frames — confirmed geometry):
- **Control button:** `size-[48px] rounded-[30px]` (full circle). Icon inset: `left:9 top:9 size:30`.
- **Default state** (mic, cam): `bg-white`.
- **Hover state** (white controls): `bg-[rgba(255,255,255,0.75)]` — confirmed on camera button in `31:4911`/`54:2975`.
- **End/leave button:** `bg-[#ff4e4e]` (default); hover: `bg-[#c13c3c]` — confirmed in `31:4911`/`54:2976`.
- **Chat button (panel closed):** `bg-white`. **Chat button (panel open):** `bg-[#2c68fa]` — confirmed `50:4129`.
- **Bar layout:** 3 controls at x=0/64/128 within bar frame → spacing = 48+16 = 64px steps, gap = **16px**. Bar total width = 176px. Bar centered in 1440px frame at x=632 (= 1440/2 − 176/2 = 632 ✓). Separate chat control is NOT in the bar frame — it is a standalone sibling at `left:1363` (right edge, ~29px from right).
- **Bar vertical position:** y=760 in 840px frame → 32px from bottom of canvas.
- **Tooltip** (from `56:3010` on 2-up): bg white, `rounded-[8px]`, `px-12 py-6`, text 14px/600/lh18 (subtext-bold), total height **36px**. Tail is a 14×6px downward triangle. Positioned above the control button (y=716, button y=760 → 44px above).
- → Code currently renders text "Chat"/"Leave" + `<Toggle>` components, not round icon circles — this is the primary visual gap on every room screen.

---

## 5. Prioritized fix backlog

Effort: S ≤30min · M ≤2h · L > half-day. "⚠ M4/M5/M6" flags likely collisions with in-flight work.

1. **[L] Load Roboto Flex + set it as the app font.** Add the variable font (self-host `@font-face` or bundle) and `font-family` on `body`/`@theme --font-*`; apply the Figma `fontVariationSettings` (`wdth 130`) globally. *Foundational — do first; touches `index.css` only.*
2. **[M] Rework the `<Text>` weight + size scale to Figma.** Map `weight`: light=300, button=452, semibold=600, extrabold=800 (replace 400/500/600/700). Add an H1=22px/lh30 and H2=20px/lh28 style; set 14px styles to lh18. Concretely: extend `WEIGHT_CLASSES` (`font-light`/`font-[452]`/`font-semibold`/`font-extrabold`) and give `<Text>` explicit `leading-*` per size (or per named style). File: `shared/ui/Text.tsx`. *All screens depend on this.*
3. **[M] Fix `Button` to Figma.** `rounded-[10px]`, `px-7 py-3` (28/12), `text-base` (16px) `font-[452]`, min-height 48px; primary hover → solid `bg-accent-strong`; **add `variant="secondary"`** (`bg-white text-surface hover:bg-white/75`); optional `fullWidth`/`w-[332px]` for forms. File: `shared/ui/Button.tsx`. ⚠ M4 adds a red "End call" button + M6 a Share button — coordinate the variant set (add a `danger` variant while here).
4. **[M] Build the V2 controls bar** (V2 geometry now confirmed — see §3 and §4). Exact spec: `size-[48px] rounded-[30px]`, icon 30×30 inset 9px; mic/cam/chat default `bg-white` hover `bg-white/75`; end/leave `bg-[#ff4e4e]` hover `bg-[#c13c3c]`; chat-open state `bg-[#2c68fa]`; bar gap `gap-4` (16px); bar centered in viewport; separate chat button at right edge (≈29px from right, same y as bar). V2 shows 3 controls in bar (mic · cam · end-leave); add screen-share between cam and end-leave per PRD FR-21 (not in V2 Figma but required). Replace text "Chat"/"Leave" + `<Toggle>` visuals. Export mic/cam/screen-share/hangup/chat SVG glyphs. Files: `shared/ui/Toggle.tsx`, `features/call/components/ControlsBar.tsx`. ⚠ **HIGH collision with M4 (End call/Leave/Remove) + M6 (Share)** — do AFTER M4/M6 land, then re-verify against V2.
5. **[S] Add missing tokens** to `@theme`: `--color-accent-active:#487CFD`, `--color-danger-strong:#C13C3C`, `--color-text-muted:#9BA6B7`, and use `white/25`,`white/75` (Tailwind opacity) for overlays. File: `index.css`.
6. **[M] Rebuild pre-join card layout + name input to Figma** — card `w-[412px] rounded-[12px] bg-[#1f2224] p-[40px]`, inner `gap-[12px]` (preview→form) + form `gap-[24px]` (title→input→button). Camera preview block 224×170 (keep live video, no cat). `NameInput`: remove label span, `bg-[#2a2e30] rounded-[11px] px-[12px] py-[14px] w-[332px]`; error = 14px red `#ff4e4e` with `"* "` prefix and 8px gap from input. `DeviceToggles` position to clarify (not shown in Figma card — keep outside or below card per PRD). Files: `features/prejoin/PreJoinScreen.tsx`, `features/prejoin/components/NameInput.tsx`. ⚠ Safe to do now.
7. **[S] Grid gap + width + aspect (V2-confirmed values).** `VideoGrid`: `gap-3`→`gap-4`; replace `max-w-5xl` (1024px) with per-count widths: 1-up→`max-w-[1220px]`, 2-up→`max-w-[1382px]`, 3-up and 4-up→`max-w-[1168px]`; add `aspect-video` on every tile. Also ensure 2-up tiles are vertically centered in the 840px frame (228px top margin before tiles). Files: `features/call/components/VideoGrid.tsx`, `VideoTile.tsx`. ⚠ M6 restructures the grid into a thumbnail strip — align with that.
8. **[M] Rebuild chat panel + message items + input to Figma** (full spec now in §3): (a) `ChatPanel`: `w-[340px] bg-[#1f2224]`; header `left-[24px] top-[24px]` close-arrow + H2 title; 1px separator at `top-[64px]`; bottom fade gradient 65px above input; (b) `ChatMessageItem`: 14px/600 sender name `text-[#9180ff]`/`text-[#2c68fa]`, bubble `bg-[#181b1d] px-[12px] py-[10px] rounded-[12px]` (first) / `rounded-[4px]` on one corner (subsequent), timestamp inline with ` · `; (c) `ChatInput`: single-line input (not textarea), `bg-[#181b1d] rounded-[11px] px-[12px] py-[8px] w-[316px]`, 34×34 send icon SVG (not Button text), hover border `rgba(255,255,255,0.25)`. File: `features/chat/ChatPanel.tsx`, `ChatMessageItem.tsx`, `ChatInput.tsx`. ⚠ M5 edits chat components — schedule after M5.
9. **[S] Export icon SVGs** (new — required for backlog item 4 and item 8): export `mic-on` `mic-off` `cam-on` `cam-off` `hangup` `chat` `arrow` `send` from Figma `call-icon` `24:2789` + `icon/arrow` `50:4239` + `icon/send` `42:5190`. Bundle in `shared/assets/icons/`. All are 34×34px (or 16×16 for arrow). Screen-share icon must be sourced externally. ⚠ Blocks backlog item 4 (controls bar rebuild).
10. **[S] Tooltip + inline error** sizing to Figma (36px tooltip; 14px red error). Files: `shared/ui/Tooltip.tsx`, name-field error.

**Sequencing note:** items 1–3, 5, 6, 9 are safe now (they touch `index.css`, `shared/ui/Text|Button`, prejoin — not the `features/call` files M4 is editing). Items 4, 7, 8 collide with M4/M5/M6 — schedule them after those milestones land, then re-verify against Figma. Do NOT start item 4/7 while the M4 agent is in `features/call`.

**Out of Figma scope (style per PRD, no Figma gap):** landing page, host copy-link, all status screens (ended/removed/left/host-disconnected/not-found), grace overlay, chat attachments + lightbox, screen-share layout, light theme. Design these consistently with the corrected token/type/Button system above.

---

## 6. PRD-only screens (not in Figma) — design specs

The screens in this section are absent from the Figma file. They are styled per PRD using the
design system defined in §2/§3 of the conformance audit (`docs/superpowers/design/2026-07-01-figma-conformance-audit.md`):
dark palette (`--color-surface`, `--color-surface-elevated`, etc.), Roboto Flex type scale (H1
22px/800/lh30, body 16px/300/lh24, subtext 14px/300/lh18), and the shared `<Button>`, `<Text>`,
and `<Tooltip>` components. The one exception is S1 (call full), which IS in Figma (Welcome-4
"Room is full") and is fully specified in the conformance audit §4 (pre-join card) — it is
cross-referenced below rather than re-invented.

---

### 6.1 Landing page (US-1 / FR-30)

**Purpose:** The entry point of the app. A single action — start a call.

**FR/US:** US-1, US-17, FR-1, FR-30.

**Layout:** Centered column using the same centered-card wrapper as the status screens:
`<div class="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 text-center">`.
No card backing — direct on the page background (`bg-white` / `dark:bg-surface`). Theme and
language toggles in the top-right (`<TopBar>`).

**Design-system components:** `<Text tag="h1" size="2xl" weight="semibold">` for the tagline;
`<Button variant="primary">` for "Start a call".

**Verbatim EN strings (PRD FR-30, US-17):**
- Tagline: `"Group video calls for up to four people. No sign-up required."`
- Button: `"Start a call"`
- Start-error inline message (below button, replaces itself; button stays enabled): `"Unable to start a call right now. Please try again."`

**States / behavior:**
- Default: tagline + button. No other navigation or links.
- Loading: button shows disabled state while `POST /rooms` is in flight.
- Error: inline error message appears below the button; button re-enables for retry.

**Existing implementation:** `frontend/src/pages/LandingPage.tsx` — already uses `<Text tag="h1"
size="2xl" weight="semibold">` + `<Button>` + centered column. The error message currently renders
as `<p class="text-sm text-amber-400">` — this should become a `<Text size="sm">` with
`className="text-amber-400"` once `<Text>` is the canonical typography primitive (conformance
audit §3 item 2). The H1 renders the tagline, not an app-name/logo — acceptable for the
no-branding scope (PRD §12 "clean, neutral, unbranded").

---

### 6.2 Call-ended screen — S2 (US-4 / FR-3 / FR-4)

**Purpose:** Shown when a guest opens a participant URL for a room that has already ended (host
ended the call or grace expired), or when a guest is in-call and the host ends the call.

**FR/US:** US-4, FR-3 (host ends → `"This call has ended."` on later visit); also the landing
target for guests after grace expires (`"The host has disconnected and the call has ended."` is
the *grace-expired full-screen* — see §6.6).

**Layout:** centered-card pattern (same wrapper as all status screens):
`<div class="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 text-center">`.

**Design-system components:** `<Text tag="h1" size="2xl" weight="semibold">` + `<Button
variant="ghost">` (or `<Link>` styled as ghost) → landing page.

**Verbatim EN strings (PRD §7 table, FR-3):**
- Title: `"This call has ended."`
- Action button: `"Start a new call"` (links to `/`)

**States / behavior:** Static informational screen. No countdown or auto-redirect.

**Existing implementation:** `frontend/src/features/room-states/CallEndedScreen.tsx` — already
uses the centered-card wrapper, `<Text tag="h1">`, and a `<Link to="/">` styled as ghost. The
`<Link>` uses raw Tailwind classes instead of `<Button variant="ghost">` — a minor inconsistency
to fix when `Button` gets the `secondary`/`ghost` variants from the conformance-audit backlog.

---

### 6.3 Guest-left screen — G3 (US-11 / FR-5)

**Purpose:** Shown to a guest immediately after they click "Leave". Gives them the option to
rejoin.

**FR/US:** US-11, FR-5, FR-19.

**Layout:** centered-card pattern.

**Design-system components:** `<Text tag="h1" size="2xl" weight="semibold">` + `<Button
variant="ghost">` (onClick → navigate to pre-join for same room).

**Verbatim EN strings (PRD §7 table, US-11):**
- Title: `"You have left the call."`
- Action button: `"Rejoin"` (returns to the pre-join screen for the same room)

**States / behavior:** The "Rejoin" button navigates back to `/r/:roomName` (pre-join). If the
room is now full or ended, the pre-join will route the guest to the appropriate status screen.

**Existing implementation:** `frontend/src/features/room-states/GuestLeftScreen.tsx` — correct
pattern; takes `onRejoin: () => void` prop.

---

### 6.4 Removed-guest screen — G4 (US-13 / FR-6)

**Purpose:** Shown to a guest who has been removed by the host.

**FR/US:** US-13, FR-6.

**Layout:** centered-card pattern.

**Design-system components:** `<Text tag="h1" size="2xl" weight="semibold">` + `<Button
variant="ghost">` (or `<Link>`) → landing page.

**Verbatim EN strings (PRD §7 table, US-13):**
- Title: `"You were removed from the call by the host."`
- Action button: `"Back to home"` (links to `/`)

**States / behavior:** Static. No rejoin option (removal does not ban re-entry, but this screen
offers no shortcut — the guest must use the original participant link). (PRD FR-6: "removal does
not block the guest from rejoining the same participant URL while the room is alive.")

**Existing implementation:** `frontend/src/features/room-states/RemovedScreen.tsx` — correct
pattern.

---

### 6.5 Host-ended screen — G5 (US-12 / FR-3)

**Purpose:** Shown to guests when the host deliberately ends the call.

**FR/US:** US-12, FR-3.

**Layout:** centered-card pattern.

**Design-system components:** `<Text tag="h1" size="2xl" weight="semibold">` + `<Button
variant="ghost">` (or `<Link>`) → landing page.

**Verbatim EN strings (PRD §7 table, US-12, FR-3):**
- Title: `"The host has ended the call."`
- Action button: `"Back to home"` (links to `/`)

**States / behavior:** Static. Distinct from S2 ("This call has ended.") which is shown on
link-revisit; G5 is shown live (the guest was in the call when the host ended it) and then the
room status becomes "ended" — subsequent visitors see S2.

**Existing implementation:** `frontend/src/features/room-states/HostEndedScreen.tsx` — correct
pattern.

---

### 6.6 Host-disconnected: grace overlay (G6) and grace-expired full-screen (US-14 / FR-4)

This PRD state has **two distinct renderings**:

#### 6.6a Grace overlay (G6 — in-call overlay while countdown is active)

**Purpose:** Informational overlay shown to guests while the host's 60-second grace period is
running. The call (video, audio, chat) continues uninterrupted behind it; the overlay is
non-blocking.

**FR/US:** US-14, FR-4.

**Layout:** Not a full-screen takeover. A centered card *overlay* positioned near the top of the
call screen (absolute or fixed, `z-20`, `top-4`, centered horizontally), with a semi-transparent
dark backing (`bg-surface-elevated/90`). Guests can still see the video grid and use chat
underneath. The overlay is `pointer-events-none` (informational only — no buttons, no input
capture).

**Design-system tokens:** `bg-surface-elevated/90` (Figma `--color-surface-elevated` at 90%
opacity) + `rounded-lg p-4`; body text `<Text tag="p" weight="medium">` + countdown `<Text
tag="p" size="sm">`.

**Verbatim EN strings (PRD §7 table, US-14, FR-4):**
- Body: `"The host lost connection. Waiting for them to return..."`
- Countdown line: `"Reconnecting... {{n}}s"` (e.g. `"Reconnecting... 47s"`; updates every second;
  note the literal three-dot form `...` per the PRD — distinct from the `…` glyph used in
  transient states §4.6)

**States / behavior:**
- Appears immediately when the backend fires `grace_tick` (socket event) with `secondsLeft`.
- Countdown decrements every second via `grace_tick` events.
- Disappears when `grace_cancelled` is received (host returned).
- Transitions to the grace-expired full-screen (§6.6b) when the countdown reaches 0 / `room_ended` fires.

**Existing implementation:** `frontend/src/features/call/components/GraceOverlay.tsx` — correct
semi-transparent overlay using `bg-surface-elevated/90`, takes `secondsLeft: number` prop.
i18n keys: `graceOverlay` / `graceCountdown`.

#### 6.6b Grace-expired full-screen (shown after 60s elapse)

**Purpose:** Full-screen status shown when the grace period expires and the room is destroyed.

**Layout:** centered-card pattern (same as all other status screens).

**Design-system components:** `<Text tag="h1" size="2xl" weight="semibold">` + `<Button
variant="ghost">` (or `<Link>`) → landing page.

**Verbatim EN strings (PRD §7 table, US-14, FR-4):**
- Title: `"The host has disconnected and the call has ended."`
- Action button: `"Back to home"` (links to `/`)

**Existing implementation:** `frontend/src/features/room-states/GraceExpiredScreen.tsx` — correct
pattern.

---

### 6.7 Not-found / invalid-link screen — S3 (US-4 / FR-7)

**Purpose:** Shown when the URL matches no room or has an invalid format.

**FR/US:** US-4, FR-7.

**Layout:** centered-card pattern.

**Design-system components:** `<Text tag="h1" size="2xl" weight="semibold">` + optional `<Text
tag="p">` body + `<Button variant="ghost">` (or `<Link>`) → landing page.

**Verbatim EN strings (PRD §7 table, US-4):**
- Title: `"This call was not found."`
- Body: `"The link may be incorrect or expired."`
- Action button: `"Start a new call"` (links to `/`)

**States / behavior:** Static.

**Existing implementation:** `frontend/src/features/room-states/InvalidLinkScreen.tsx` — uses the
centered-card pattern, `<Text tag="h1">`, and `<Link to="/">` styled as ghost. The title and body
are stored as separate i18n keys (`notFoundTitle`, `notFoundBody`).

---

### 6.8 Call-full screen — S1 (US-4 / FR-2)

**Note:** S1 IS covered by Figma (Welcome-4 "Room is full" in the pre-join card). Full visual
specification is in the conformance audit §4 (pre-join screen section) rather than here. Cross-reference only:

- Card: `w-[412px] bg-[#1f2224] rounded-[12px] p-[40px]` (same pre-join card).
- Illustration: Welcome-4 uses a different cat-pose asset (`36:3569`) within the 224×170 `pic` element — keep it (this is a status state, not the live-camera context).
- Title: `<Text tag="h1" size="2xl" weight="semibold">` — `"This call is full."` (Figma: `"Room is full"` — **PRD wins**: `"This call is full."`)
- Body: `"Only four participants can join at a time."`
- Button: `<Button variant="secondary">` (white, Figma Welcome-4 uses secondary/white `"Back"` button) — label per PRD: `"Back to home"` (links to `/`)

**Existing implementation:** `frontend/src/features/room-states/CallFullScreen.tsx` — uses the
centered-card pattern with `<Button variant="ghost">`. The card dimensions and illustration are
not yet applied; the conformance audit §4 backlog item 6 covers the pre-join card rebuild which
also applies here.

---

### 6.9 Unsupported-browser screen — S4 (FR-31)

**Purpose:** Shown on the first screen the user opens (landing or pre-join) when the browser
fails the capability check.

**FR/US:** FR-31.

**Layout:** Replaces (or overlays) the first screen content with a centered-card message. Because
it can appear on both the landing page and the guest pre-join screen, it is best implemented as a
**guard wrapper** rendered at the router/app level — if the browser check fails, render S4
instead of the intended screen.

**Design-system components:** `<Text tag="h1" size="2xl" weight="semibold">` + `<Text tag="p">` body.
No action button that routes away — the user may continue at their own risk (PRD §7: "The user
may continue at their own risk"). Do not force a redirect or disable the UI.

**Verbatim EN strings (PRD §7 table, FR-31):**
- Title: `"Your browser may not support video calls."`
- Body: `"Please use the latest version of Chrome, Firefox, Safari, or Edge."`
- No action button — the user may continue at their own risk.

**States / behavior:**
- Browser check runs synchronously at app bootstrap (before routing), testing for the APIs needed:
  `navigator.mediaDevices.getUserMedia`, `RTCPeerConnection`, and ideally
  `getDisplayMedia` (for screen share).
- If the check fails, S4 is shown on the current screen (landing or the pre-join entry point).
- The user is not blocked — the notice is informational.

**Existing implementation:** not yet present in `frontend/src/features/room-states/`. To be added
as e.g. `UnsupportedBrowserScreen.tsx` using the same centered-card wrapper, and wired into
`App.tsx` as a guard before the router renders.

---

### 6.10 Chat attachments UI (US-10 / FR-26 / FR-27)

**Purpose:** Staging area for files before send; rendering of delivered attachments (image
thumbnails, file chips); image lightbox overlay.

**FR/US:** US-10, FR-26, FR-27.

#### Staged-file row (in chat input area)

Appears above the text input when one or more files have been staged. One row per staged file:

- **File name** (truncated with ellipsis if long) + **× remove** button (ghost icon button, `aria-label="Remove attachment"`)
- Image files may show a small thumbnail preview (16×16 or 24×24 px) if available via `URL.createObjectURL` — optional but improves UX.
- Backed by `bg-surface-muted` (`--color-surface-muted` `#2a2e30`), `rounded-lg`, `px-3 py-1.5 text-sm`.
- Up to 5 staged files; the 6th triggers the count-error inline message (below).

#### Inline validation errors (below the input)

All errors are shown immediately on the failed file-add attempt (not on send), cleared on the
next interaction:

- **Verbatim EN strings (PRD FR-26, §6 validation row 3):**
  - Unsupported type: `"Unsupported file type."`
  - Over size: `"File exceeds 10 MB."`
  - Over count: `"You can attach up to 5 files per message."`
- Style: `<Text size="sm">` with `className="text-danger"` (`--color-danger` `#ff4e4e`), positioned
  below the input row.

#### Delivered image thumbnails (in message bubble)

- Rendered inline within the chat message bubble for PNG, JPEG, GIF, WebP.
- Thumbnail size: approx. 120×80 px (constrained within the 316px message area), `rounded-lg`,
  `object-cover`, `cursor-pointer`.
- Animated GIF and WebP: shown as a **still** thumbnail in the message list (first frame); they
  animate only when opened in the lightbox.
- Clicking a thumbnail opens the lightbox (§ below).

#### Delivered file chips (in message bubble)

- For non-image types: PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP.
- Each chip shows: file name + formatted size (e.g. `"2.3 MB"`) + a download icon button.
- Style: `bg-surface-muted rounded-lg px-3 py-2 flex items-center gap-2 text-sm`.
- Clicking the download icon triggers a browser download via `<a href="{url}" download>` carrying
  the member token as a query param. No in-app preview.

#### Image lightbox overlay (FR-27)

- Opens over the entire UI when an image thumbnail is clicked.
- **Backdrop:** semi-transparent dimming layer — `bg-black/60` (not fully black per PRD FR-27 /
  US-10: "does not turn fully black"). The call continues running behind it.
- **Image:** centered, `object-contain`, `max-w-[90vw] max-h-[90vh]`, never enlarged beyond
  native pixel dimensions (`max-width: min(90vw, nativeWidth)px`).
- **Close × button:** top-right corner, `aria-label="Close image"`, icon-only `<Button>`; also
  closes on Esc keypress and on backdrop click.
- **Focus management (FR-27 / NFR-2):** on open, focus moves into the overlay (to the close ×
  button); on close, focus returns to the originating thumbnail.
- **View-only:** no download button inside the overlay (PRD FR-27: "view-only — no download
  control inside it").
- **Animated images:** GIF and WebP animate when displayed here (PRD FR-27).
- **z-index:** above everything including the grace overlay — use `z-50` or higher.

**Existing implementation:** the chat input (`frontend/src/features/chat/components/ChatInput.tsx`)
and panel (`frontend/src/features/chat/ChatPanel.tsx`) exist but do not yet include attachment
staging, file chips, or the lightbox. These are v1.0 features (PRD §14).

---

### 6.11 Screen-share layout (US-8 / FR-16)

**Purpose:** When any participant shares their screen, the entire call layout switches: the shared
content fills the main area and all camera tiles move to a horizontal thumbnail strip.

**FR/US:** US-8, FR-16, FR-21.

#### Main area (shared content)

- Fills the available width (minus chat panel if open) and the available height above the controls
  bar.
- **Fit:** `object-contain` — the shared content is shown in full, never cropped; neutral margins
  (same `bg-surface` dark background) fill the remaining space when aspect ratios differ (PRD
  FR-16: "contain so nothing of the shared content is cut off").
- **Label** (bottom-left or top-left of the main area, above the video):
  - Others: `"{{name}} is sharing their screen"` (interpolated with the sharer's display name)
  - Sharer: `"You are sharing your screen"`
  - Style: `<Text size="sm">` on a semi-transparent dark pill (`bg-surface-elevated/80 rounded px-2 py-1`).

**Verbatim EN strings (PRD FR-16, US-8):**
- Others label: `"{{name}} is sharing their screen"`
- Sharer label: `"You are sharing your screen"`
- Screen-share error (inline, 4s auto-dismiss, above controls bar): `"Unable to share your screen. Please check your browser permissions."`
- Tooltip when share is busy: `"Someone is already sharing their screen"`

#### Thumbnail strip

- Horizontal strip below the main area, above the controls bar.
- One `<VideoTile>` per participant (including the sharer's camera tile).
- Tile size: fixed height (e.g. ~120px), `aspect-video` (`16:9`), `object-cover` (`cover` fit per
  PRD FR-16 — same as grid tiles).
- Order: host first, then guests in join order — same as the grid (PRD FR-16, US-8).
- Each tile keeps:
  - Name label (corner or camera-off centered position per FR-14).
  - Camera-off representation: mic-state icon centered above name, no avatar.
  - Muted-microphone corner indicator (camera-on + mic-off).
- The strip scrolls horizontally if the tile count exceeds the available width (up to 4 tiles at
  max — unlikely to overflow but handled gracefully).

#### Screen-share control button (3rd in center bar)

Per conformance audit §0 item 5: the screen-share button is the 3rd control in the center bar
(order: mic · camera · **screen-share** · end/leave), styled as a 48px white-round V2 control
button (`size-[48px] rounded-[30px] bg-white`). The screen-share glyph is **not in Figma** —
source a standard screen-share / monitor SVG externally (e.g. Lucide `monitor` or Heroicons
`computer-desktop`), clipped to 30×30 px, dark glyph on white circle.

**States:**
- Idle (no one sharing): enabled, tooltip `"Share your screen"`.
- Active own share: shows "Stop sharing" state (e.g. glyph changes to a stop variant or the
  button uses `bg-accent`), tooltip `"Stop sharing"`.
- Busy (someone else sharing): disabled (`opacity-50 cursor-not-allowed`), tooltip `"Someone is
  already sharing their screen"`.

**Behavior:**
- On click (idle state): calls `navigator.mediaDevices.getDisplayMedia(…)` → on success, emits
  `claim_share` to the backend → awaits `share_granted` / `share_denied`.
- On `share_denied { reason: 'busy' }`: no share starts; the busy tooltip state applies.
- On capture cancelled or permission denied: no share starts; the 4-second inline error appears
  above the controls bar: `"Unable to share your screen. Please check your browser permissions."`.
- "Stop sharing" / browser native stop: emits `release_share`; layout returns to the grid.

**Existing implementation:** `GraceOverlay.tsx` and `VideoGrid.tsx` exist but the screen-share
layout, thumbnail strip, and share control are not yet implemented — these are v1.0 scope.

---

### 6.12 Light theme (FR-28 / FR-29 / US-15)

**Purpose:** The app is dark by default; a theme toggle (sun/moon icon) in the top-right corner
switches between Dark and Light. Light is the alternate via Tailwind `dark:` variants.

**FR/US:** US-15, FR-28, FR-29.

#### Mechanism

`useUiStore` holds the current theme (`'dark' | 'light'`). On toggle, the store applies/removes
the `.dark` class on `<html>`. The choice is persisted to `sessionStorage` (survives reloads,
resets to Dark on a new browser session). All theming is done via Tailwind `dark:` variants —
no separate CSS file, no runtime style injection.

#### Light palette mapping

The light palette is derived from the dark palette and Tailwind defaults — it is **not a separate
Figma design**. The `index.css` `body` rule already establishes the base: `bg-white text-slate-900`
(light default) + `dark:bg-surface dark:text-slate-100`.

| Context | Dark value | Light value | Notes |
| --- | --- | --- | --- |
| App background | `bg-surface` (`#181b1d`) | `bg-white` | Established in `body` rule |
| Body text | `text-slate-100` | `text-slate-900` | Established in `body` rule |
| Cards / panels / modals (`surface-elevated`) | `bg-surface-elevated` (`#1f2224`) | `bg-slate-100` | Light equivalent of the dark card |
| Inputs / control backgrounds (`surface-muted`) | `bg-surface-muted` (`#2a2e30`) | `bg-slate-200` | Light input background |
| Accent (buttons, focus, active chat) | `bg-accent` (`#2c68fa`) | `bg-accent` (unchanged) | Blue reads on both themes |
| Accent hover | `bg-accent-strong` (`#285ddf`) | `bg-accent-strong` (unchanged) | |
| Danger (End call, errors) | `bg-danger` / `text-danger` (`#ff4e4e`) | `bg-danger` / `text-danger` (unchanged) | Red reads on both themes |
| Sender name — others | `text-sender` (`#9180ff`) | `text-sender` (unchanged) | Purple reads on white |
| Sender name — own | `text-accent` (`#2c68fa`) | `text-accent` (unchanged) | |
| Secondary text / placeholder | `text-slate-400` / `text-white/25` | `text-slate-500` / `text-slate-400` | Adjust opacity-based values |
| Video tile background (camera off) | `bg-surface-elevated` | `bg-slate-800` | Tile backing always dark for contrast — video tiles keep a dark backing in light theme per PRD §12 |
| Grace overlay backdrop | `bg-surface-elevated/90` | `bg-slate-800/90` | Same dark backing (overlay is always dark for readability) |
| Lightbox backdrop | `bg-black/60` | `bg-black/60` (unchanged) | Always dark per PRD FR-27 |
| Tooltip | `bg-white text-surface` (per Figma audit §3) | `bg-white text-surface` (unchanged) | Tooltip is already light-on-dark in both themes |

**WCAG 2.1 AA note:** `text-slate-900` on `bg-white` easily meets AA (contrast ~14:1). Accent
blue (`#2c68fa`) on white meets AA for large/bold text but is borderline (~3.0:1) for small body
text — use `text-accent` on light surfaces for interactive labels only, not body copy.

**Existing implementation:**
- `frontend/src/index.css`: `body` already has the correct `bg-white text-slate-900 dark:bg-surface dark:text-slate-100` rule.
- `frontend/src/features/preferences/components/ThemeToggle.tsx`: theme toggle control exists.
- `useUiStore` is responsible for the `.dark` class on `<html>` and `sessionStorage` persistence.
- Gap: most component classes use `bg-surface-elevated` / `bg-surface-muted` without the `dark:`
  prefix — in the current setup these tokens only exist in `@theme` and are not light-aware. To
  make them respond to theme, either (a) change usages to `dark:bg-surface-elevated` + a light
  equivalent, or (b) redefine the tokens as CSS custom properties that change under `.dark`.
  Approach (b) is cleaner for a large codebase; approach (a) is explicit per Tailwind v4 `dark:`
  convention and consistent with the current `body` rule — use approach (a).
