'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signOut, type User } from 'firebase/auth';
import { authClient, firebaseConfigured } from '@/lib/firebase';
import { api, demoMode } from '@/lib/api';
import type { UserProfile } from '@alozuri/shared';
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  admin: boolean;
  logout: () => Promise<void>;
  profile: UserProfile | null;
  profileError: string;
  profileLoading: boolean;
  refreshProfile: () => void;
}>({
  user: null,
  loading: true,
  admin: false,
  logout: async () => {},
  profile: null,
  profileError: '',
  profileLoading: false,
  refreshProfile: () => {},
});
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [{ user, loading, admin }, setSession] = useState<{
    user: User | null;
    loading: boolean;
    admin: boolean;
  }>({
    user: null,
    loading: firebaseConfigured,
    admin: false,
  });
  const [profileState, setProfileState] = useState<{
    uid: string | null;
    profile: UserProfile | null;
    loading: boolean;
    error: string;
  }>({ uid: null, profile: null, loading: false, error: '' });
  const [profileAttempt, setProfileAttempt] = useState(0);
  const uid = user?.uid,
    verified = user?.emailVerified;
  useEffect(() => {
    if (!uid || demoMode) return;
    let active = true;
    const controller = new AbortController();
    setProfileState((state) => ({
      uid,
      profile: state.uid === uid ? state.profile : null,
      loading: true,
      error: '',
    }));
    void api<{ profile: UserProfile }>(
      '/v2/profile',
      { method: 'POST', body: '{}', signal: controller.signal },
      uid,
    )
      .then((result) => {
        if (active && authClient().currentUser?.uid === uid) {
          if (result.profile.uid !== uid) throw new Error('Profile identity mismatch.');
          setProfileState({ uid, profile: result.profile, loading: false, error: '' });
        }
      })
      .catch(() => {
        if (active)
          setProfileState((state) => ({
            ...state,
            loading: false,
            error: 'Your profile could not be synced. Please retry.',
          }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [uid, verified, profileAttempt]);
  useEffect(() => {
    if (!firebaseConfigured) return;
    let generation = 0;
    const stop = onIdTokenChanged(authClient(), (u) => {
      const current = ++generation;
      // Firebase can mutate and re-emit the same User after token refresh.
      // Publish a fresh session so email verification updates every consumer.
      setSession({ user: u, loading: false, admin: false });
      if (u?.emailVerified)
        void u
          .getIdTokenResult()
          .then((token) => {
            if (current === generation && authClient().currentUser?.uid === u.uid)
              setSession({ user: u, loading: false, admin: token.claims.admin === true });
          })
          .catch(() => {});
    });
    return () => {
      generation++;
      stop();
    };
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        admin,
        logout: () => signOut(authClient()),
        profile: profileState.uid === uid ? profileState.profile : null,
        profileError: profileState.uid === uid ? profileState.error : '',
        profileLoading: profileState.uid === uid && profileState.loading,
        refreshProfile: () => setProfileAttempt((value) => value + 1),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
