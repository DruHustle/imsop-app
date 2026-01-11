import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as authService from '@/lib/api-auth';
import type { User } from '@/lib/api-auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; token?: string; error?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (updates: Partial<Pick<User, 'name' | 'avatar'>>) => Promise<{ success: boolean; error?: string }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on mount
    try {
      const currentUser = authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error("Failed to load user session:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const register = async (email: string, password: string, name: string) => {
    return await authService.register(email, password, name);
  };

  const requestPasswordReset = async (email: string) => {
    return await authService.requestPasswordReset(email);
  };

  const resetPassword = async (token: string, newPassword: string) => {
    return await authService.resetPassword(token, newPassword);
  };

  const updateProfile = async (updates: Partial<Pick<User, 'name' | 'avatar'>>) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    const result = await authService.updateProfile(user.id, updates);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    return await authService.changePassword(user.id, currentPassword, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        register,
        requestPasswordReset,
        resetPassword,
        updateProfile,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
