export type ErrorCode = 'FULL' | 'INVALID_NAME' | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  FULL: 409,
  INVALID_NAME: 400,
  INTERNAL: 500,
};

export function httpStatusForCode(code: ErrorCode): number {
  return STATUS_BY_CODE[code];
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.status = httpStatusForCode(code);
  }
}
