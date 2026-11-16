import { createTranslator } from 'use-intl/core';
import { ERROR_MESSAGES, isErrorCode, type ErrorCode } from '@alozuri/shared/i18n/errors';
import { LOCALE_COOKIE, resolveLocale } from '@alozuri/shared/i18n';
import { loadMessages } from '@alozuri/shared/i18n/catalogs';
export class StoreApiError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,
    readonly status: number,
    readonly field?: string,
    readonly requestId?: string,
    readonly params: Record<string, string | number> = {},
  ) {
    super(message);
  }
}
export async function storeApiError(body: unknown, status: number): Promise<StoreApiError> {
  const record = body && typeof body === 'object' ? body : {};
  const details: unknown =
    'errorDetails' in record ? record.errorDetails : 'error' in record ? record.error : null;
  const raw: unknown =
    details && typeof details === 'object' && 'code' in details ? details.code : undefined;
  const fallback: ErrorCode =
    status === 401
      ? 'AUTHENTICATION_REQUIRED'
      : status === 429
        ? 'RATE_LIMITED'
        : status === 400
          ? 'VALIDATION_FAILED'
          : 'INTERNAL_ERROR';
  const code = isErrorCode(raw) ? raw : raw !== undefined ? 'INTERNAL_ERROR' : fallback;
  if (raw !== undefined && !isErrorCode(raw)) console.warn('Unrecognised store error identifier.');
  const cookie =
    typeof document === 'undefined'
      ? undefined
      : document.cookie
          .split('; ')
          .find((value) => value.startsWith(LOCALE_COOKIE + '='))
          ?.slice(LOCALE_COOKIE.length + 1);
  const pageLanguage = typeof document === 'undefined' ? undefined : document.documentElement.lang;
  const locale = resolveLocale({
    explicit: pageLanguage === 'en-GB' ? 'en' : pageLanguage,
    guest: cookie,
  });
  const messages = await loadMessages(locale);
  const t = createTranslator({ locale, messages });
  const field =
    details &&
    typeof details === 'object' &&
    'field' in details &&
    typeof details.field === 'string' &&
    /^[a-zA-Z0-9_.]{1,100}$/.test(details.field)
      ? details.field
      : undefined;
  const requestId =
    details &&
    typeof details === 'object' &&
    'requestId' in details &&
    typeof details.requestId === 'string' &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(details.requestId)
      ? details.requestId
      : undefined;
  const params: Record<string, string | number> = {};
  if (
    details &&
    typeof details === 'object' &&
    'params' in details &&
    details.params &&
    typeof details.params === 'object' &&
    !Array.isArray(details.params)
  ) {
    for (const [key, value] of Object.entries(details.params).slice(0, 20)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]{0,49}$/.test(key)) continue;
      if (
        (typeof value === 'string' && value.length <= 200) ||
        (typeof value === 'number' && Number.isFinite(value))
      )
        params[key] = value;
    }
  }
  // Only catalogue copy reaches customers. The English API compatibility message
  // is for non-localised clients and must never become a UI fallback.
  return new StoreApiError(
    t(`errors.${ERROR_MESSAGES[code]}`, params),
    code,
    status,
    field,
    requestId,
    params,
  );
}
