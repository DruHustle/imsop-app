import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { safeLocalStorage } from '@/lib/storage';
import * as apiAuth from '@/lib/api-auth';
import * as mockAuth from '@/lib/auth';
import { User } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      // Use imsop_token to check session status
      const token = safeLocalStorage.getItem('imsop_token');
      
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }

      try {
        if (token.startsWith('mock_')) {
          // RESTORE MOCK SESSION
          const currentUser = mockAuth.getCurrentUser();
          setUser(currentUser);
        } else {
          // VALIDATE REAL SESSION (Render API)
          const result = await apiAuth.getCurrentUser();
          if (result.success && result.user) {
            setUser(result.user);
          } else {
            // Token likely expired, clean up
            logout();
          }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // --- Hybrid Logic: Define demo accounts criteria ---
      const isDemoAccount = email.endsWith('@dev.local') || email === 'admin@demo.com' || email.endsWith('@imsop.io');

      if (isDemoAccount) {
        // Use Mock Auth (Updates local imsop_token with 'mock_' prefix)
        const result = await mockAuth.login(email, password);
        if (result.success && result.user) {
          // Manually ensuring the token has the mock prefix for initializeAuth logic
          safeLocalStorage.setItem('imsop_token', `mock_${btoa(email)}`);
          setUser(result.user);
        }
        return result;
      } else {
        // Use Real Backend (Render)
        const result = await apiAuth.login(email, password);
        if (result.success && result.user) {
          setUser(result.user);
        }
        return result;
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Authentication failed' };
    }
  };

  const logout = () => {
    // Clear both possible session types
    mockAuth.logout();
    apiAuth.logout();
    safeLocalStorage.removeItem('imsop_token');
    setUser(null);
  };

  const register = async (email: string, password: string, name: string) => {
    const isDemoAccount = email.endsWith('@dev.local') || email === 'admin@demo.com' || email.endsWith('@imsop.io');
    
    if (isDemoAccount) {
      return { success: false, error: 'Cannot register with a demo email domain.' };
    }
    
    const result = await apiAuth.register(email, password, name);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  const requestPasswordReset = async (email: string) => {
    const isDemoAccount = email.endsWith('@dev.local') || email === 'admin@demo.com' || email.endsWith('@imsop.io');
    if (isDemoAccount) return mockAuth.requestPasswordReset(email);
    return apiAuth.requestPasswordReset(email);
  };

  const resetPassword = async (token: string, newPassword: string) => {
    if (token.startsWith('mock_')) return mockAuth.resetPassword(token, newPassword);
    return apiAuth.resetPassword(token, newPassword);
  };

  const updateProfile = async (updates: Partial<Pick<User, 'name' | 'avatar'>>) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    const token = safeLocalStorage.getItem('imsop_token');
    if (token?.startsWith('mock_')) {
      const result = mockAuth.updateProfile(user.id, updates);
      if (result.success && result.user) setUser(result.user);
      return result;
    }
    
    const result = await apiAuth.updateProfile(user.id, updates);
    if (result.success && result.user) setUser(result.user);
    return result;
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    
    const token = safeLocalStorage.getItem('imsop_token');
    if (token?.startsWith('mock_')) {
      return mockAuth.changePassword(user.id, currentPassword, newPassword);
    }
    
    return apiAuth.changePassword(user.id, currentPassword, newPassword);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
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