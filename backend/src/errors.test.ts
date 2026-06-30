import { describe, it, expect } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { AppError } from './errors.js';

describe('AppError', () => {
  it('maps FULL to 409 Conflict', () => {
    const err = new AppError('FULL');
    expect(err.code).toBe('FULL');
    expect(err.status).toBe(StatusCodes.CONFLICT);
    expect(err.status).toBe(409);
    expect(err).toBeInstanceOf(Error);
  });

  it('maps INVALID_NAME to 400 Bad Request', () => {
    expect(new AppError('INVALID_NAME').status).toBe(StatusCodes.BAD_REQUEST);
  });

  it('maps INTERNAL to 500 Internal Server Error', () => {
    expect(new AppError('INTERNAL').status).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it('uses the code as the default message', () => {
    expect(new AppError('FULL').message).toBe('FULL');
  });
});
