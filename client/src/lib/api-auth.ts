import { safeLocalStorage, safeSessionStorage } from './storage';
import { User, AuthResponse, IAuthService } from './auth-types';

const TOKEN_KEY = 'imsop_token', USER_KEY = 'imsop_user';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const getStorage = () => safeLocalStorage.getItem('__storage_test__') === null && !window.localStorage ? safeSessionStorage : safeLocalStorage;

export class ApiAuthService implements IAuthService {
  private async fetchApi(path: string, opts: RequestInit = {}) {
    const storage = getStorage(), token = storage.getItem(TOKEN_KEY);
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...opts.headers }
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'API failed');
    return res.json();
  }
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { token, user } = await this.fetchApi('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      const s = getStorage(); s.setItem(TOKEN_KEY, token); s.setItem(USER_KEY, JSON.stringify(user));
      return { success: true, user };
    } catch (e: any) { return { success: false, error: e.message }; }
  }
  logout = () => [TOKEN_KEY, USER_KEY].forEach(k => getStorage().removeItem(k));
  async getCurrentUser(): Promise<AuthResponse> {
    const t = getStorage().getItem(TOKEN_KEY);
    if (!t || t.startsWith('mock_')) return { success: false };
    try { return { success: true, user: (await this.fetchApi('/api/auth/me')).user }; } catch { return { success: false }; }
  }
  register = async (email: string, password: string, name: string) => this.wrap(() => this.fetchApi('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }));
  requestPasswordReset = async (email: string) => this.wrap(() => this.fetchApi('/api/auth/request-reset', { method: 'POST', body: JSON.stringify({ email }) }));
  resetPassword = async (token: string, newPassword: string) => this.wrap(() => this.fetchApi('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }));
  updateProfile = async (id: string, updates: any) => this.wrap(() => this.fetchApi(`/api/auth/profile/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }));
  changePassword = async (id: string, currentPassword: string, newPassword: string) => this.wrap(() => this.fetchApi(`/api/auth/change-password/${id}`, { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }));
  private async wrap(fn: () => Promise<any>): Promise<AuthResponse> {
    try { const res = await fn(); return { success: true, ...res }; } catch (e: any) { return { success: false, error: e.message }; }
  }
}
export const apiAuthService = new ApiAuthService();
