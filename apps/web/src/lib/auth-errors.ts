const errors: Record<string, string> = {
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/password-does-not-meet-requirements': 'Choose a stronger password and try again.',
  'auth/email-already-in-use': 'This email already has an account. Log in or reset your password.',
  'auth/weak-password': 'Please choose a password of at least 8 characters.',
  'auth/popup-blocked': 'Your browser blocked Google sign-in. Allow popups and try again.',
  'auth/popup-closed-by-user': 'Google sign-in was closed. Try again when you’re ready.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/unauthorized-domain': 'Sign-in is not available on this domain yet.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled yet.',
};
export function authErrorMessage(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : '';
  return errors[code] || 'Unable to sign in. Please try again.';
}
