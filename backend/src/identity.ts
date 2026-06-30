import { randomUUID } from 'node:crypto';

export function generateIdentity(): string {
  return `p_${randomUUID()}`;
}
