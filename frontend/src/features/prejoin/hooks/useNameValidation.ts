import { useMemo } from 'react';

export type NameErrorKey = 'prejoin.nameEmpty' | 'prejoin.nameLength' | 'prejoin.nameChars';
export type NameValidity = { valid: boolean; errorKey: NameErrorKey | null };

const NAME_PATTERN = /^[\p{L}\p{N} '-]{2,30}$/u;
const MAX_NAME_LENGTH = 30;

export function useNameValidation(name: string): NameValidity {
  return useMemo(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { valid: false, errorKey: 'prejoin.nameEmpty' };
    const capped = trimmed.slice(0, MAX_NAME_LENGTH);
    if (trimmed.length > MAX_NAME_LENGTH || capped.length < 2) {
      return { valid: false, errorKey: 'prejoin.nameLength' };
    }
    if (!NAME_PATTERN.test(capped)) return { valid: false, errorKey: 'prejoin.nameChars' };
    return { valid: true, errorKey: null };
  }, [name]);
}
