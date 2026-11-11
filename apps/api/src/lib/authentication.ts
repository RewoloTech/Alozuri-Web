import type { Principal } from './repository.js';

export interface IdentityProvider {
  verifyIdToken(
    token: string,
    checkRevoked: true,
  ): Promise<{
    uid: string;
    email?: string;
    email_verified?: boolean;
    admin?: unknown;
  }>;
  getUser(uid: string): Promise<{
    uid: string;
    disabled: boolean;
    emailVerified: boolean;
    customClaims?: Record<string, unknown>;
  }>;
}

export async function authenticateToken(
  token: string,
  provider: IdentityProvider,
  ownerUid?: string,
): Promise<Principal> {
  const decoded = await provider.verifyIdToken(token, true);
  let admin = decoded.admin === true && decoded.email_verified === true;
  if (admin) {
    // A role removed from Firebase must not survive in an otherwise-valid old
    // ID token. Recheck the current account for privileged requests.
    const current = await provider.getUser(decoded.uid);
    admin =
      current.uid === decoded.uid &&
      current.disabled === false &&
      current.emailVerified === true &&
      current.customClaims?.admin === true &&
      (ownerUid === undefined || ownerUid === decoded.uid);
  }
  return {
    uid: decoded.uid,
    email: decoded.email,
    verified: decoded.email_verified === true,
    admin,
  };
}
