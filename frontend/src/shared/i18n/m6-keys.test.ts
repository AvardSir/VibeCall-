import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';

describe('M6 i18n keys', () => {
  it('exposes M6 screen-share call keys with parity', () => {
    for (const k of ['shareScreen', 'shareTooltipIdle', 'shareTooltipActive', 'shareTooltipBusy', 'stopSharing', 'sharingLabel', 'youAreSharing', 'shareError', 'shareBusy'])
      expect(en.call).toHaveProperty(k);
    expect(Object.keys(ru.call)).toEqual(Object.keys(en.call));
    expect(en.call.sharingLabel).toBe('{{name}} is sharing their screen');
    expect(en.call.shareError).toBe('Unable to share your screen. Please check your browser permissions.');
  });
});
