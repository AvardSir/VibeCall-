import { describe, it, expect } from 'vitest';
import { validateDisplayName } from './validation.js';

describe('validateDisplayName', () => {
  it('accepts a normal name and returns the trimmed value', () => {
    expect(validateDisplayName('  Ann  ')).toEqual({ ok: true, value: 'Ann' });
  });

  it('accepts letters, numbers, spaces, hyphens and apostrophes', () => {
    expect(validateDisplayName("O'Neil-7 Ann")).toEqual({ ok: true, value: "O'Neil-7 Ann" });
  });

  it('accepts unicode letters', () => {
    expect(validateDisplayName('Анна')).toEqual({ ok: true, value: 'Анна' });
  });

  it('rejects empty / whitespace-only as empty', () => {
    expect(validateDisplayName('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateDisplayName('')).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects too-short (1 char) as length', () => {
    expect(validateDisplayName('A')).toEqual({ ok: false, reason: 'length' });
  });

  it('rejects too-long (>30) as length', () => {
    expect(validateDisplayName('a'.repeat(31))).toEqual({ ok: false, reason: 'length' });
  });

  it('rejects illegal characters', () => {
    expect(validateDisplayName('Ann@home')).toEqual({ ok: false, reason: 'chars' });
  });

  it('rejects non-string input as empty', () => {
    expect(validateDisplayName(undefined)).toEqual({ ok: false, reason: 'empty' });
    expect(validateDisplayName(42)).toEqual({ ok: false, reason: 'empty' });
  });
});
