// FR-31 / ES-814: pragmatic detection of browsers outside the supported set
// (latest 2 of Chrome / Firefox / Safari / Edge). Exact "latest-2" version pairs can't be
// determined reliably or kept current on the client, so support is inferred from two signals:
//   1. the presence of the WebRTC APIs the call actually needs, and
//   2. a coarse UA guard for engines known to be outside the set (IE / legacy EdgeHTML).
// The result drives a non-blocking, informational notice only — the user may continue at own risk.

export type BrowserSupportEnv = {
  userAgent: string;
  hasRtcPeerConnection: boolean;
  hasGetUserMedia: boolean;
  hasGetDisplayMedia: boolean;
};

function readEnv(): BrowserSupportEnv {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const hasWindowRtc = typeof window !== 'undefined' && 'RTCPeerConnection' in window;
  const mediaDevices = nav?.mediaDevices;
  return {
    userAgent: nav?.userAgent ?? '',
    hasRtcPeerConnection: hasWindowRtc,
    hasGetUserMedia: typeof mediaDevices?.getUserMedia === 'function',
    hasGetDisplayMedia: typeof mediaDevices?.getDisplayMedia === 'function',
  };
}

// Engines that predate / fall outside the supported set. Chromium Edge reports "Edg/" (not "Edge/"),
// so this only matches legacy EdgeHTML and Internet Explorer.
const LEGACY_UA_PATTERN = /MSIE |Trident\/|Edge\//;

export function isBrowserSupported(env: BrowserSupportEnv = readEnv()): boolean {
  // Missing any of the core call APIs means video calling can't work here.
  if (!env.hasRtcPeerConnection || !env.hasGetUserMedia || !env.hasGetDisplayMedia) {
    return false;
  }
  // Known-old / out-of-set engine, even if it happens to expose the APIs.
  if (LEGACY_UA_PATTERN.test(env.userAgent)) {
    return false;
  }
  return true;
}
