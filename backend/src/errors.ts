import { StatusCodes } from 'http-status-codes';

export type ErrorCode =
  | 'FULL'
  | 'INVALID_NAME'
  | 'NOT_FOUND'
  | 'ENDED'
  | 'INTERNAL'
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FORBIDDEN';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  FULL: StatusCodes.CONFLICT,
  INVALID_NAME: StatusCodes.BAD_REQUEST,
  NOT_FOUND: StatusCodes.NOT_FOUND,
  ENDED: StatusCodes.GONE,
  INTERNAL: StatusCodes.INTERNAL_SERVER_ERROR,
  UNSUPPORTED_TYPE: StatusCodes.UNSUPPORTED_MEDIA_TYPE,
  FILE_TOO_LARGE: StatusCodes.REQUEST_TOO_LONG,
  FORBIDDEN: StatusCodes.FORBIDDEN,
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
