import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNameValidation } from './useNameValidation';

describe('useNameValidation', () => {
  it('flags empty input', () => {
    const { result } = renderHook(() => useNameValidation('   '));
    expect(result.current).toEqual({ valid: false, errorKey: 'prejoin.nameEmpty' });
  });

  it('flags too-short input as length', () => {
    const { result } = renderHook(() => useNameValidation('A'));
    expect(result.current.errorKey).toBe('prejoin.nameLength');
  });

  it('flags illegal characters', () => {
    const { result } = renderHook(() => useNameValidation('Ann@home'));
    expect(result.current.errorKey).toBe('prejoin.nameChars');
  });

  it('accepts a valid name', () => {
    const { result } = renderHook(() => useNameValidation("O'Neil-7"));
    expect(result.current).toEqual({ valid: true, errorKey: null });
  });
});
