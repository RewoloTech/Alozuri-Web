export const CONSENT_VERSION = '2026-11-11.1';
export const CONSENT_COOKIE = 'alozuri_consent';
export const CONSENT_MAX_AGE = 180 * 24 * 60 * 60;
export type PrivacyChoice = {
  version: typeof CONSENT_VERSION;
  necessary: true;
  support: boolean;
  savedAt: string;
};
export function privacyChoice(support: boolean, now = Date.now()): PrivacyChoice {
  return {
    version: CONSENT_VERSION,
    necessary: true,
    support,
    savedAt: new Date(now).toISOString(),
  };
}
export function readPrivacyChoice(
  raw: string | undefined | null,
  now = Date.now(),
): PrivacyChoice | null {
  if (!raw || raw.length > 1000) return null;
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    if (
      !value ||
      typeof value !== 'object' ||
      !('version' in value) ||
      value.version !== CONSENT_VERSION ||
      !('necessary' in value) ||
      value.necessary !== true ||
      !('support' in value) ||
      typeof value.support !== 'boolean' ||
      !('savedAt' in value) ||
      typeof value.savedAt !== 'string'
    )
      return null;
    const at = Date.parse(value.savedAt);
    if (!Number.isFinite(at) || at > now || now - at >= CONSENT_MAX_AGE * 1000) return null;
    return {
      version: CONSENT_VERSION,
      necessary: true,
      support: value.support,
      savedAt: value.savedAt,
    };
  } catch {
    return null;
  }
}
export const TAWK_CHAT_URL = 'https://tawk.to/chat/6af3c3323853833c48d84ca1/1k7434vas';
