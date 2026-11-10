'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { onIdTokenChanged, signOut, type User } from 'firebase/auth';
import { authClient, firebaseConfigured } from '@/lib/firebase';
const AuthContext = createContext<{
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}>({ user: null, loading: true, logout: async () => {} });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [{ user, loading }, setSession] = useState<{ user: User | null; loading: boolean }>({
    user: null,
    loading: firebaseConfigured,
  });
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onIdTokenChanged(authClient(), (u) => {
      // Firebase can mutate and re-emit the same User after token refresh.
      // Publish a fresh session so email verification updates every consumer.
      setSession({ user: u, loading: false });
    });
  }, []);
  return (
    <AuthContext.Provider value={{ user, loading, logout: () => signOut(authClient()) }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
