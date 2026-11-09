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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  useEffect(() => {
    if (!firebaseConfigured) return;
    return onIdTokenChanged(authClient(), (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);
  return (
    <AuthContext.Provider value={{ user, loading, logout: () => signOut(authClient()) }}>
      {children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => useContext(AuthContext);
