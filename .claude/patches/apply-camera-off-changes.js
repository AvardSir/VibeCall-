#!/usr/bin/env node
// Patch: Camera-off representation — mic icon + name instead of generic avatar
// Apply with: node .claude/patches/apply-camera-off-changes.js
// From project root: C:\claudeProj

const fs = require('fs');
const path = require('path');

const WIREFRAME = path.resolve(__dirname, '../../KMB_VideoChat_Wireframes_with_Overview (1) (1).html');
const SPEC = path.resolve(__dirname, '../../docs/superpowers/specs/2026-06-26-kmb-video-chat-technical-design.md');

function applyReplace(filePath, label, oldStr, newStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes(oldStr)) {
    console.error(`[FAIL] "${label}" — old string not found in ${path.basename(filePath)}`);
    process.exit(1);
  }
  const updated = content.split(oldStr).join(newStr);
  fs.writeFileSync(filePath, updated, 'utf8');
  console.log(`[ OK] "${label}"`);
}

// ─── WIREFRAME ────────────────────────────────────────────────────────────────

// 1. CSS — cam-off visual + pre-join
applyReplace(
  WIREFRAME,
  'CSS cam-off rules',
  `.vtile.cam-off { background: #f3f4f6; }
.vtile.cam-off .face { border-style: dashed; }
.vtile .name { position: absolute; left: 6px; bottom: 6px; background: #111; color: #fff; font-size: 9.5px; padding: 1px 6px; border-radius: 3px; font-family: var(--font-mono); }
.vtile .mute { position: absolute; right: 6px; bottom: 6px; width: 17px; height: 17px; border: 1px solid #111; border-radius: 50%; background: #fff; font-size: 9px; display: flex; align-items: center; justify-content: center; }`,
  `.vtile.cam-off { background: #f3f4f6; }
.vtile.cam-off .face { display: none; }
.vtile.cam-off .name { display: none; }
.cam-off-content { display: flex; flex-direction: column; align-items: center; gap: 5px; }
.cam-off-content .co-mic { font-size: 20px; }
.cam-off-content .co-name { font-size: 10px; font-family: var(--font-mono); color: #555; }
.vtile .name { position: absolute; left: 6px; bottom: 6px; background: #111; color: #fff; font-size: 9.5px; padding: 1px 6px; border-radius: 3px; font-family: var(--font-mono); }
.vtile .mute { position: absolute; right: 6px; bottom: 6px; width: 17px; height: 17px; border: 1px solid #111; border-radius: 50%; background: #fff; font-size: 9px; display: flex; align-items: center; justify-content: center; }
.preview-box.off .face { display: none; }
.preview-box .co-mic { font-size: 28px; }`
);

// 2. H3 description
applyReplace(
  WIREFRAME,
  'H3 description',
  `Camera-off tiles show an avatar; mic-off tiles show a mute icon.`,
  `Camera-off tiles show a centered microphone icon with the participant's name below it — no avatar. When the camera is on and mic is muted, a mute icon appears in the corner of the tile. When the camera is off and mic is also muted, the centered icon reflects the muted state and the name label appears below it.`
);

// 3. H3 + H5 cam-off tile HTML (both instances, replace_all)
applyReplace(
  WIREFRAME,
  'cam-off tile HTML (H3 + H5)',
  `<div class="vtile cam-off"><div class="face"></div><span class="name">Chen</span></div>`,
  `<div class="vtile cam-off"><div class="cam-off-content"><span class="co-mic">🎙</span><span class="co-name">Chen</span></div></div>`
);

// 4. H2 permission states notes
applyReplace(
  WIREFRAME,
  'H2 permission states notes',
  `Camera denied → preview shows avatar, camera toggle off + disabled: <code>Camera access was denied. You can enable it in your browser settings.</code></li><li>Mic denied → mic toggle off + disabled: <code>Microphone access was denied…</code></li><li>Both denied → avatar + both off, combined message; user can still enter`,
  `Camera denied → preview shows centered mic icon (no avatar, no name), camera toggle off + disabled: <code>Camera access was denied. You can enable it in your browser settings.</code></li><li>Mic denied → mic toggle off + disabled: <code>Microphone access was denied…</code></li><li>Both denied → centered mic icon + both off, combined message; user can still enter`
);

// 5. G2 controls note
applyReplace(
  WIREFRAME,
  'G2 controls note',
  `Same camera-off avatar and mic-off icon behaviour as host`,
  `Camera-off: centered mic icon + name below it, no avatar — same as host. Mic-off with camera on: corner mute icon. Mic-off with camera off: centered icon in muted state + name below.`
);

// 6. H5 wf-desc thumbnail text
applyReplace(
  WIREFRAME,
  'H5 wf-desc thumbnails',
  `every thumbnail keeps its name label and camera-off / mute indicators.`,
  `every thumbnail keeps its indicators: camera-off tiles show a centered mic icon with the name below (no avatar); mic-off with camera on shows a corner mute icon.`
);

// 7. H5 Streams & labels note
applyReplace(
  WIREFRAME,
  'H5 Streams & labels note',
  `Every thumbnail keeps its name label + camera-off / mute icons, in grid order (host → guests by join order)`,
  `Every thumbnail keeps its indicators: camera-off → centered mic icon + name below (no avatar); mic-off with camera on → corner mute icon; grid order: host → guests by join order`
);

// ─── SPEC ─────────────────────────────────────────────────────────────────────

// 8. §4.3 Video grid description
applyReplace(
  SPEC,
  'Spec §4.3 video grid',
  `Camera-off tiles show an avatar; mic-off tiles show a mute icon. Built on LiveKit track
subscriptions; the grid CSS mirrors the wireframe layouts.`,
  `Camera-off tiles show a centered microphone icon with the participant's name below it — no
avatar is displayed (FR-13, FR-14). Mic-off with camera on: mute icon in the tile corner
(FR-14). Mic-off with camera off: centered icon in muted state, name below. Built on LiveKit
track subscriptions; the grid CSS mirrors the wireframe layouts.`
);

// 9. §8 pre-join note
applyReplace(
  SPEC,
  'Spec §8 pre-join camera-off note',
  `- Pre-join requests camera/mic permission on load; the user can enter even if a device is denied.
- Copy link: copies the participant URL; if clipboard is blocked, show the URL as selectable text.`,
  `- Pre-join requests camera/mic permission on load; the user can enter even if a device is denied.
- Pre-join camera-off / denied state: the preview shows a centered mic icon with no avatar and
  no name (FR-11). This is the only visual difference from the in-call camera-off tile (FR-14),
  which also shows the participant's name below the icon.
- Copy link: copies the participant URL; if clipboard is blocked, show the URL as selectable text.`
);

console.log('\nAll changes applied successfully.');
