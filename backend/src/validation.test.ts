import { describe, it, expect } from 'vitest';
import { nameSchema } from './validation.js';

describe('nameSchema', () => {
  it('accepts a normal name and returns the trimmed value', () => {
    const result = nameSchema.safeParse('  Ann  ');
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe('Ann');
  });

  it('accepts letters, numbers, spaces, hyphens and apostrophes', () => {
    expect(nameSchema.safeParse("O'Neil-7 Ann").success).toBe(true);
  });

  it('accepts unicode letters', () => {
    expect(nameSchema.safeParse('Анна').success).toBe(true);
  });

  it('rejects empty / whitespace-only', () => {
    expect(nameSchema.safeParse('   ').success).toBe(false);
    expect(nameSchema.safeParse('').success).toBe(false);
  });

  it('rejects too-short (1 char)', () => {
    expect(nameSchema.safeParse('A').success).toBe(false);
  });

  it('rejects too-long (>30)', () => {
    expect(nameSchema.safeParse('a'.repeat(31)).success).toBe(false);
  });

  it('rejects illegal characters', () => {
    expect(nameSchema.safeParse('Ann@home').success).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(nameSchema.safeParse(undefined).success).toBe(false);
    expect(nameSchema.safeParse(42).success).toBe(false);
  });
});
