import { describe, it, expect } from 'vitest';
import { AppError, httpStatusForCode } from './errors.js';

describe('AppError', () => {
  it('carries a stable code and an HTTP status', () => {
    const err = new AppError('FULL');
    expect(err.code).toBe('FULL');
    expect(err.status).toBe(409);
    expect(err).toBeInstanceOf(Error);
  });

  it('maps INVALID_NAME to 400', () => {
    expect(httpStatusForCode('INVALID_NAME')).toBe(400);
  });

  it('maps INTERNAL to 500', () => {
    expect(httpStatusForCode('INTERNAL')).toBe(500);
  });
});
