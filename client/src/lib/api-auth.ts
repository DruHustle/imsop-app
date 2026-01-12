import { safeLocalStorage, safeSessionStorage } from './storage';
import { User, AuthResponse, IAuthService } from './auth-types';

const TOKEN_KEY = 'imsop_token';
const USER_KEY = 'imsop_user';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getStorage() {
  return safeLocalStorage.getItem('__storage_test__') === null && 
         !window.localStorage ? safeSessionStorage : safeLocalStorage;
}

export class ApiAuthService implements IAuthService {
  private async fetchApi(endpoint: string, options: RequestInit = {}): Promise<any> {
    const storage = getStorage();
    const token = storage.getItem(TOKEN_KEY);
    
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'API request failed');
    }

    return response.json();
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const data = await this.fetchApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      const storage = getStorage();
      storage.setItem(TOKEN_KEY, data.token);
      storage.setItem(USER_KEY, JSON.stringify(data.user));
      
      return { success: true, user: data.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  logout(): void {
    const storage = getStorage();
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(USER_KEY);
  }

  async getCurrentUser(): Promise<AuthResponse> {
    const storage = getStorage();
    const token = storage.getItem(TOKEN_KEY);
    if (!token || token.startsWith('mock_')) return { success: false };

    try {
      const data = await this.fetchApi('/api/auth/me');
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false };
    }
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    try {
      const data = await this.fetchApi('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      });
      return { success: true, user: data.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async requestPasswordReset(email: string): Promise<AuthResponse> {
    try {
      const data = await this.fetchApi('/api/auth/request-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      return { success: true, token: data.token };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<AuthResponse> {
    try {
      await this.fetchApi('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async updateProfile(userId: string, updates: Partial<Pick<User, 'name' | 'avatar'>>): Promise<AuthResponse> {
    try {
      const data = await this.fetchApi(`/api/auth/profile/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      return { success: true, user: data.user };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResponse> {
    try {
      await this.fetchApi(`/api/auth/change-password/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}

export const apiAuthService = new ApiAuthService();
