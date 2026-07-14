import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';

describe('M5 i18n keys', () => {
  it('exposes M5 chat attachment keys with parity', () => {
    for (const k of ['attach', 'removeAttachment', 'unsupportedType', 'fileTooLarge', 'tooManyFiles', 'closeLightbox', 'download'])
      expect(en.chat).toHaveProperty(k);
    expect(Object.keys(ru.chat)).toEqual(Object.keys(en.chat));
    expect(en.chat.unsupportedType).toBe('Unsupported file type.');
    expect(en.chat.fileTooLarge).toBe('File exceeds 10 MB.');
    expect(en.chat.tooManyFiles).toBe('You can attach up to 5 files per message.');
  });
});
