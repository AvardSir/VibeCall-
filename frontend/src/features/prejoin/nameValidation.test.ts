import { describe, it, expect } from 'vitest';
import { validateName } from './nameValidation';

describe('validateName', () => {
  it('flags empty input', () => {
    expect(validateName('   ')).toEqual({ valid: false, errorKey: 'nameEmpty' });
  });

  it('flags too-short input as length', () => {
    expect(validateName('A').errorKey).toBe('nameLength');
  });

  it('flags illegal characters', () => {
    expect(validateName('Ann@home').errorKey).toBe('nameChars');
  });

  it('accepts a valid name', () => {
    expect(validateName("O'Neil-7")).toEqual({ valid: true, errorKey: null });
  });
});
