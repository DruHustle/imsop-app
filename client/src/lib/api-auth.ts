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

const TOKEN_KEY = 'imsop_token';
const USER_KEY = 'imsop_user';
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Get the appropriate storage based on private mode detection logic in storage.ts
 */
function getStorage() {
  // If local storage is not available (Safari Private), use session memory fallback
  return safeLocalStorage.getItem('__storage_test__') === null && 
         !window.localStorage ? safeSessionStorage : safeLocalStorage;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return { success: false, error: error.error || 'Login failed' };
  }

  const data = await response.json();
  const storage = getStorage();
  
  storage.setItem(TOKEN_KEY, data.token);
  storage.setItem(USER_KEY, JSON.stringify(data.user));
  
  return { success: true, user: data.user };
}

export async function getCurrentUser() {
  const storage = getStorage();
  const token = storage.getItem(TOKEN_KEY);
  
  // If no token or it's a mock token, don't hit the API
  if (!token || token.startsWith('mock_')) return { success: false };

  try {
    const response = await fetch(`${API_BASE_URL}/api/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) return { success: false };
    const data = await response.json();
    return { success: true, user: data.user };
  } catch (error) {
    return { success: false };
  }
}

export function logout() {
  const storage = getStorage();
  storage.removeItem(TOKEN_KEY);
  storage.removeItem(USER_KEY);
}