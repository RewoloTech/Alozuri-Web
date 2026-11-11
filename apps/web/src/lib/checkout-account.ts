import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  type Auth,
} from 'firebase/auth';
import { authClient } from './firebase';

export type CheckoutAccountActions = {
  google: () => Promise<void>;
  email: (mode: 'register' | 'login', email: string, password: string) => Promise<void>;
};
export async function authenticateCheckoutEmail(
  auth: Auth,
  mode: 'register' | 'login',
  email: string,
  password: string,
  verificationUrl: string,
) {
  if (mode === 'login') {
    await signInWithEmailAndPassword(auth, email, password);
    return;
  }
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  try {
    await sendEmailVerification(user, { url: verificationUrl });
  } catch {
    // The account exists. Its verification page supports resending the email.
    // Checkout remains available through the existing guest-access path.
  }
}
export const checkoutAccountActions: CheckoutAccountActions = {
  async google() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(authClient(), provider);
  },
  async email(mode, email, password) {
    await authenticateCheckoutEmail(
      authClient(),
      mode,
      email,
      password,
      window.location.origin +
        '/verify-email?next=' +
        encodeURIComponent(window.location.pathname + window.location.search),
    );
  },
};
