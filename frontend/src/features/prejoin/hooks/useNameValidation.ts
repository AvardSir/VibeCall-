import { useMemo } from 'react';
import { z } from 'zod';

// Bare keys within the 'prejoin' i18n namespace — consumers resolve them with the namespaced t().
export type NameErrorKey = 'nameEmpty' | 'nameLength' | 'nameChars';
export type NameValidity = { valid: boolean; errorKey: NameErrorKey | null };

// Display-name rule. Source of truth: PRD §6. Intentionally duplicated from the backend
// (backend/src/validation.ts) for instant client-side feedback; the server re-validates as the
// authority. Keep both copies in sync with the PRD.
const NAME_PATTERN = /^[\p{L}\p{N} '-]{2,30}$/u;

// Each refine carries its reason code as the issue message; the first failing check wins, giving
// the priority empty → length → chars.
const nameSchema = z
  .string()
  .transform((s) => s.trim())
  .pipe(
    z
      .string()
      .refine((s) => s.length > 0, { error: 'nameEmpty' })
      .refine((s) => s.length >= 2 && s.length <= 30, { error: 'nameLength' })
      .refine((s) => NAME_PATTERN.test(s), { error: 'nameChars' }),
  );

const NAME_ERROR_KEYS = new Set<string>(['nameEmpty', 'nameLength', 'nameChars']);

function isNameErrorKey(x: unknown): x is NameErrorKey {
  return typeof x === 'string' && NAME_ERROR_KEYS.has(x);
}

export function useNameValidation(name: string): NameValidity {
  return useMemo(() => {
    const result = nameSchema.safeParse(name);
    if (result.success) return { valid: true, errorKey: null };
    const [issue] = result.error.issues;
    const errorKey: NameErrorKey = isNameErrorKey(issue?.message) ? issue.message : 'nameEmpty';
    return { valid: false, errorKey };
  }, [name]);
}
