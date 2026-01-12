import { safeLocalStorage } from './storage';
import { User, AuthResponse, IAuthService } from './auth-types';

const SESSION_KEY = 'imsop_session', TOKEN_KEY = 'imsop_token';
const DEMO_USERS: (User & { password: string })[] = [
  { id: '1', email: 'admin@imsop.io', password: 'admin123', name: 'Admin User', role: 'admin' },
  { id: '2', email: 'engineer@imsop.io', password: 'engineer123', name: 'Engineer User', role: 'engineer' },
  { id: '3', email: 'analyst@imsop.io', password: 'analyst123', name: 'Analyst User', role: 'analyst' },
  { id: '4', email: 'demo@imsop.io', password: 'demo123', name: 'Demo User', role: 'user' },
  { id: '5', email: 'admin@demo.local', password: 'demo-admin-password', name: 'Admin Demo', role: 'admin' },
  { id: '6', email: 'operator@demo.local', password: 'demo-operator-password', name: 'Operator Demo', role: 'user' },
];

export class MockAuthService implements IAuthService {
  async login(email: string, password: string): Promise<AuthResponse> {
    await new Promise(r => setTimeout(r, 500));
    const user = DEMO_USERS.find(u => u.email === email && u.password === password);
    if (!user) return { success: false, error: 'Invalid email or password' };
    const { password: _, ...userWithoutPassword } = user;
    safeLocalStorage.setItem(TOKEN_KEY, `mock_${btoa(email)}`);
    safeLocalStorage.setItem(SESSION_KEY, JSON.stringify(userWithoutPassword));
    return { success: true, user: userWithoutPassword };
  }
  logout = () => [TOKEN_KEY, SESSION_KEY].forEach(k => safeLocalStorage.removeItem(k));
  async getCurrentUser(): Promise<AuthResponse> {
    const user = JSON.parse(safeLocalStorage.getItem(SESSION_KEY) || 'null');
    return { success: !!user, user };
  }
  register = async () => ({ success: false, error: 'Cannot register with a demo email domain.' });
  requestPasswordReset = async (email: string) => ({ success: true, token: `mock_reset_${btoa(email)}` });
  resetPassword = async () => ({ success: true });
  async updateProfile(userId: string, updates: Partial<Pick<User, 'name' | 'avatar'>>): Promise<AuthResponse> {
    const user = JSON.parse(safeLocalStorage.getItem(SESSION_KEY) || 'null');
    if (!user) return { success: false, error: 'Not authenticated' };
    const updated = { ...user, ...updates };
    safeLocalStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    return { success: true, user: updated };
  }
  changePassword = async () => ({ success: true });
}
export const mockAuthService = new MockAuthService();
