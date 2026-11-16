import type { Messages } from './messages.ts';
export const ERROR_MESSAGES = {
  PROMO_CODE_INVALID: 'promoInvalid',
  PROMO_CODE_EXPIRED: 'promoExpired',
  PROMO_CODE_NOT_APPLICABLE: 'promoInvalid',
  PAYMENT_FAILED: 'paymentFailed',
  PAYMENT_CANCELLED: 'paymentCancelled',
  PLAN_UNAVAILABLE: 'planUnavailable',
  ESIM_ACTIVATION_FAILED: 'generic',
  TOPUP_NOT_SUPPORTED: 'generic',
  AUTHENTICATION_REQUIRED: 'authentication',
  RATE_LIMITED: 'rateLimited',
  INTERNAL_ERROR: 'generic',
  CATALOGUE_CHANGED: 'catalogueChanged',
  SEARCH_PAGE_INVALID: 'searchPageInvalid',
  VALIDATION_FAILED: 'generic',
  LOCALE_NOT_READY: 'generic',
  PROMO_RESERVATION_EXPIRED: 'promoExpired',
  CHECKOUT_CHANGED: 'generic',
  CHECKOUT_CLOSED: 'paymentFailed',
  PRICE_CHANGED: 'generic',
} as const satisfies Record<string, keyof Messages['errors']>;
export type ErrorCode = keyof typeof ERROR_MESSAGES;
export function isErrorCode(code: unknown): code is ErrorCode {
  return typeof code === 'string' && Object.hasOwn(ERROR_MESSAGES, code);
}
export type ErrorDetails = {
  code: ErrorCode;
  requestId: string;
  field?: string;
  params: Record<string, string | number>;
};
