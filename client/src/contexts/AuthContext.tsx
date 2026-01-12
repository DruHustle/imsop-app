import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '@/lib/auth-types';
import { AuthServiceFactory } from '@/lib/auth-factory';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<AuthResponse>;
  requestPasswordReset: (email: string) => Promise<AuthResponse>;
  resetPassword: (token: string, newPassword: string) => Promise<AuthResponse>;
  updateProfile: (updates: Partial<Pick<User, 'name' | 'avatar'>>) => Promise<AuthResponse>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const service = AuthServiceFactory.getService();
        const result = await service.getCurrentUser();
        if (result.success && result.user) {
          setUser(result.user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const service = AuthServiceFactory.getService(email);
    const result = await service.login(email, password);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  const logout = () => {
    const service = AuthServiceFactory.getService();
    service.logout();
    setUser(null);
  };

  const register = async (email: string, password: string, name: string) => {
    const service = AuthServiceFactory.getService(email);
    const result = await service.register(email, password, name);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  const requestPasswordReset = async (email: string) => {
    const service = AuthServiceFactory.getService(email);
    return service.requestPasswordReset(email);
  };

  const resetPassword = async (token: string, newPassword: string) => {
    const service = AuthServiceFactory.getService();
    return service.resetPassword(token, newPassword);
  };

  const updateProfile = async (updates: Partial<Pick<User, 'name' | 'avatar'>>) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    const service = AuthServiceFactory.getService();
    const result = await service.updateProfile(user.id, updates);
    if (result.success && result.user) {
      setUser(result.user);
    }
    return result;
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    const service = AuthServiceFactory.getService();
    return service.changePassword(user.id, currentPassword, newPassword);
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
