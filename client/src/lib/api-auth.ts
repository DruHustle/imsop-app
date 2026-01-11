/**
 * API-based authentication service for IMSOP
 * Uses backend API for authentication with Safari private mode fallback
 */

import { safeLocalStorage, safeSessionStorage } from './storage';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'engineer' | 'analyst' | 'user';
  avatar?: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

interface AuthResponse {
  success: boolean;
  error?: string;
}

const TOKEN_KEY = 'imsop_token';
const USER_KEY = 'imsop_user';
const API_BASE_URL = process.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Detect if running in Safari private browsing mode
 */
function isPrivateBrowsingMode(): boolean {
  try {
    const test = '__private_mode_test__';
    safeLocalStorage.setItem(test, test);
    const stored = safeLocalStorage.getItem(test);
    safeLocalStorage.removeItem(test);
    
    // If we couldn't store or retrieve, we're likely in private mode
    return stored !== test;
  } catch (e) {
    return true;
  }
}

/**
 * Get the appropriate storage based on private mode detection
 */
function getStorage() {
  return isPrivateBrowsingMode() ? safeSessionStorage : safeLocalStorage;
}

/**
 * Login user via backend API
 */
export async function login(email: string, password: string): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Login failed' };
    }

    const data: LoginResponse = await response.json();
    const storage = getStorage();
    
    storage.setItem(TOKEN_KEY, data.token);
    storage.setItem(USER_KEY, JSON.stringify(data.user));
    
    return { success: true, user: data.user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Register new user via backend API
 */
export async function register(email: string, password: string, name: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Registration failed' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Logout user
 */
export function logout(): void {
  const storage = getStorage();
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
}

/**
 * Get current user from storage
 */
export function getCurrentUser(): User | null {
  const storage = getStorage();
  const userStr = storage.getItem(USER_KEY);
  
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

/**
 * Get current token from storage
 */
export function getToken(): string | null {
  const storage = getStorage();
  return storage.getItem(TOKEN_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null && getToken() !== null;
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Request failed' };
    }

    const data = await response.json();
    return { success: true, token: data.token };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<AuthResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Reset failed' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Update user profile
 */
export async function updateProfile(userId: string, updates: Partial<Pick<User, 'name' | 'avatar'>>): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Update failed' };
    }

    const data = await response.json();
    const storage = getStorage();
    storage.setItem(USER_KEY, JSON.stringify(data.user));
    
    return { success: true, user: data.user };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}

/**
 * Change password
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResponse> {
  try {
    const token = getToken();
    if (!token) {
      return { success: false, error: 'Not authenticated' };
    }

    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Change failed' };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Network error' };
  }
}
