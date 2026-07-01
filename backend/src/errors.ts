import { StatusCodes } from 'http-status-codes';

export type ErrorCode = 'FULL' | 'INVALID_NAME' | 'NOT_FOUND' | 'ENDED' | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  FULL: StatusCodes.CONFLICT,
  INVALID_NAME: StatusCodes.BAD_REQUEST,
  NOT_FOUND: StatusCodes.NOT_FOUND,
  ENDED: StatusCodes.GONE,
  INTERNAL: StatusCodes.INTERNAL_SERVER_ERROR,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}
