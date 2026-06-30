import { useMemo } from 'react';

// Bare keys within the 'prejoin' i18n namespace — consumers resolve them with the namespaced t().
export type NameErrorKey = 'nameEmpty' | 'nameLength' | 'nameChars';
export type NameValidity = { valid: boolean; errorKey: NameErrorKey | null };

// Display-name rule. Source of truth: PRD §6. Intentionally duplicated from the backend
// (backend/src/validation.ts) for instant client-side feedback; the server re-validates as the
// authority. Keep both copies in sync with the PRD.
const NAME_PATTERN = /^[\p{L}\p{N} '-]{2,30}$/u;
const MAX_NAME_LENGTH = 30;

export function useNameValidation(name: string): NameValidity {
  return useMemo(() => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return { valid: false, errorKey: 'nameEmpty' };
    const capped = trimmed.slice(0, MAX_NAME_LENGTH);
    if (trimmed.length > MAX_NAME_LENGTH || capped.length < 2) {
      return { valid: false, errorKey: 'nameLength' };
    }
    if (!NAME_PATTERN.test(capped)) return { valid: false, errorKey: 'nameChars' };
    return { valid: true, errorKey: null };
  }, [name]);
}
