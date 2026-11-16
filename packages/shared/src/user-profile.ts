import type { Locale } from './i18n/locales.ts';
export type UserProfile = {
  locale?: Locale;
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  firstName: string;
  lastName: string;
  providerIds: string[];
  createdAt: string;
  lastSignInAt: string | null;
  updatedAt: string;
};
