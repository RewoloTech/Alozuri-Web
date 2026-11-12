export type UserProfile = {
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
