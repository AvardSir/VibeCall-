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
