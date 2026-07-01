import { describe, it, expect } from 'vitest';
import { validateStagedFile, MAX_ATTACHMENT_BYTES } from './validateAttachment';

describe('validateStagedFile', () => {
  it('returns tooManyFiles when currentCount is 5', () => {
    const file = new File(['content'], 'test.png', { type: 'image/png' });
    const result = validateStagedFile(file, 5);
    expect(result).toEqual({ ok: false, errorKey: 'tooManyFiles' });
  });

  it('returns unsupportedType for .exe file', () => {
    const file = new File(['content'], 'malware.exe', { type: 'application/octet-stream' });
    const result = validateStagedFile(file, 0);
    expect(result).toEqual({ ok: false, errorKey: 'unsupportedType' });
  });

  it('returns fileTooLarge for an 11 MB .png file', () => {
    const largeBuffer = new Uint8Array(MAX_ATTACHMENT_BYTES + 1);
    const file = new File([largeBuffer], 'big.png', { type: 'image/png' });
    const result = validateStagedFile(file, 0);
    expect(result).toEqual({ ok: false, errorKey: 'fileTooLarge' });
  });

  it('returns { ok: true } for a small valid .png file', () => {
    const file = new File(['content'], 'valid.png', { type: 'image/png' });
    const result = validateStagedFile(file, 0);
    expect(result).toEqual({ ok: true });
  });
});
