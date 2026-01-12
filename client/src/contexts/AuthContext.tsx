import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '@/lib/auth-types';
import { AuthServiceFactory } from '@/lib/auth-factory';

interface AuthContextType {
  user: User | null; isAuthenticated: boolean; isLoading: boolean;
  login: (e: string, p: string) => Promise<AuthResponse>; logout: () => void;
  register: (e: string, p: string, n: string) => Promise<AuthResponse>;
  requestPasswordReset: (e: string) => Promise<AuthResponse>;
  resetPassword: (t: string, p: string) => Promise<AuthResponse>;
  updateProfile: (u: any) => Promise<AuthResponse>;
  changePassword: (c: string, n: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null), [isLoading, setIsLoading] = useState(true);
  const getSvc = (e?: string) => AuthServiceFactory.getService(e);

  useEffect(() => {
    getSvc().getCurrentUser().then(r => r.success && setUser(r.user || null)).finally(() => setIsLoading(false));
  }, []);

  const handle = async (fn: () => Promise<AuthResponse>) => {
    const r = await fn(); if (r.success && r.user) setUser(r.user); return r;
  };

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, isLoading,
      login: (e, p) => handle(() => getSvc(e).login(e, p)),
      logout: () => { getSvc().logout(); setUser(null); },
      register: (e, p, n) => handle(() => getSvc(e).register(e, p, n)),
      requestPasswordReset: (e) => getSvc(e).requestPasswordReset(e),
      resetPassword: (t, p) => getSvc().resetPassword(t, p),
      updateProfile: (u) => user ? handle(() => getSvc().updateProfile(user.id, u)) : Promise.resolve({ success: false, error: 'Not authenticated' }),
      changePassword: (c, n) => user ? getSvc().changePassword(user.id, c, n) : Promise.resolve({ success: false, error: 'Not authenticated' }),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(AuthContext);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
};
