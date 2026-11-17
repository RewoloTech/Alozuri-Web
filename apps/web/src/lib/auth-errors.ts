import { englishMessages, type Messages } from '@alozuri/shared/i18n/messages';
const errors: Record<string, keyof Messages['authUi']> = {
  'auth/invalid-credential': 'invalidCredential',
  'auth/invalid-email': 'invalidEmail',
  'auth/wrong-password': 'invalidCredential',
  'auth/password-does-not-meet-requirements': 'strongerPassword',
  'auth/email-already-in-use': 'emailInUse',
  'auth/weak-password': 'weakPassword',
  'auth/popup-blocked': 'popupBlocked',
  'auth/popup-closed-by-user': 'popupClosed',
  'auth/too-many-requests': 'tooMany',
  'auth/unauthorized-domain': 'unauthorizedDomain',
  'auth/operation-not-allowed': 'methodDisabled',
};
export function authErrorKey(error: unknown): keyof Messages['authUi'] {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  return errors[code] ?? 'authError';
}
/** Compatibility for call sites that have not yet moved their presentation to ICU. */
export function authErrorMessage(error: unknown) {
  return englishMessages.authUi[authErrorKey(error)];
}
