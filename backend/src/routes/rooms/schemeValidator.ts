import { z } from 'zod';
import { nameSchema } from '../../validation.js';
import { AppError } from '../../errors.js';

// Request-payload schema for the join route. Reuses the display-name rule (validation.ts).
// hostToken is optional: its presence (and validity) is what elevates a join to the host role.
const joinBodySchema = z.object({ name: nameSchema, hostToken: z.string().optional() });

export function parseJoinBody(body: unknown): { name: string; hostToken?: string } {
  const result = joinBodySchema.safeParse(body);
  if (!result.success) throw new AppError('INVALID_NAME');
  return { name: result.data.name, hostToken: result.data.hostToken };
}
