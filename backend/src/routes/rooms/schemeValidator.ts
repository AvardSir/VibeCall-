import { z } from 'zod';
import { nameSchema } from '../../validation.js';
import { AppError } from '../../errors.js';

// Request-payload schema for the rooms routes. Reuses the display-name rule (validation.ts) and
// surfaces a typed AppError so the controller stays thin.
const joinBodySchema = z.object({ name: nameSchema });

export function parseJoinBody(body: unknown): { name: string } {
  const result = joinBodySchema.safeParse(body);
  if (!result.success) throw new AppError('INVALID_NAME');
  return { name: result.data.name };
}
