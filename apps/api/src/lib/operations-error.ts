import type { ErrorCode } from '../../../../packages/shared/src/i18n/errors.ts';
export class OperationsError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code: ErrorCode = statusCode >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_FAILED',
  ) {
    super(message);
  }
}
