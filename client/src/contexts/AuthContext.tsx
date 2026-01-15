import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';
import { User, AuthResponse } from '@/lib/auth-types';
import { AuthServiceFactory } from '@/lib/auth-factory';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (e: string, p: string) => Promise<AuthResponse>;
  logout: () => void;
  register: (e: string, p: string, n: string) => Promise<AuthResponse>;
  requestPasswordReset: (e: string) => Promise<AuthResponse>;
  resetPassword: (t: string, p: string) => Promise<AuthResponse>;
  updateProfile: (u: Partial<Pick<User, 'name' | 'avatar'>>) => Promise<AuthResponse>;
  changePassword: (c: string, n: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getSvc = useCallback((email?: string) => AuthServiceFactory.getService(email), []);

  useEffect(() => {
    let isMounted = true;
    getSvc().getCurrentUser()
      .then(r => {
        if (isMounted && r.success) setUser(r.user || null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, [getSvc]);

  const handleAuthAction = useCallback(async (action: () => Promise<AuthResponse>) => {
    const result = await action();
    if (result.success && result.user) setUser(result.user);
    return result;
  }, []);

  const value = useMemo(() => ({
    user,
    isAuthenticated: !!user,
    isLoading,
    login: (e: string, p: string) => handleAuthAction(() => getSvc(e).login(e, p)),
    logout: () => { getSvc().logout(); setUser(null); },
    register: (e: string, p: string, n: string) => handleAuthAction(() => getSvc(e).register(e, p, n)),
    requestPasswordReset: (e: string) => getSvc(e).requestPasswordReset(e),
    resetPassword: (t: string, p: string) => getSvc().resetPassword(t, p),
    updateProfile: (u: Partial<Pick<User, 'name' | 'avatar'>>) => 
      user ? handleAuthAction(() => getSvc().updateProfile(user.id, u)) : Promise.resolve({ success: false, error: 'Not authenticated' }),
    changePassword: (c: string, n: string) => 
      user ? getSvc().changePassword(user.id, c, n) : Promise.resolve({ success: false, error: 'Not authenticated' }),
  }), [user, isLoading, getSvc, handleAuthAction]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
