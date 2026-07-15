import { describe, it, expect } from 'vitest';
import { isBrowserSupported } from './detectBrowser';
import type { BrowserSupportEnv } from './detectBrowser';

const SUPPORTED: BrowserSupportEnv = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  hasRtcPeerConnection: true,
  hasGetUserMedia: true,
  hasGetDisplayMedia: true,
};

describe('isBrowserSupported', () => {
  it('returns true for a modern browser with all WebRTC APIs', () => {
    expect(isBrowserSupported(SUPPORTED)).toBe(true);
  });

  it('returns true for Chromium Edge (Edg/ UA)', () => {
    expect(
      isBrowserSupported({
        ...SUPPORTED,
        userAgent: `${SUPPORTED.userAgent} Edg/120.0.0.0`,
      }),
    ).toBe(true);
  });

  it('returns false when RTCPeerConnection is missing', () => {
    expect(isBrowserSupported({ ...SUPPORTED, hasRtcPeerConnection: false })).toBe(false);
  });

  it('returns false when getUserMedia is missing', () => {
    expect(isBrowserSupported({ ...SUPPORTED, hasGetUserMedia: false })).toBe(false);
  });

  it('returns false when getDisplayMedia is missing', () => {
    expect(isBrowserSupported({ ...SUPPORTED, hasGetDisplayMedia: false })).toBe(false);
  });

  it('returns false for a legacy engine UA (IE / EdgeHTML) even with APIs present', () => {
    expect(
      isBrowserSupported({
        ...SUPPORTED,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko',
      }),
    ).toBe(false);
    expect(
      isBrowserSupported({
        ...SUPPORTED,
        userAgent: `${SUPPORTED.userAgent} Edge/18.18363`,
      }),
    ).toBe(false);
  });
});
