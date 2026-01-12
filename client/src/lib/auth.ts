/**
 * Client-side authentication service for GitHub Pages/Demo Mode
 */
import { safeLocalStorage } from './storage';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'engineer' | 'analyst' | 'user';
  avatar?: string;
}

const SESSION_KEY = 'imsop_session';
const TOKEN_KEY = 'imsop_token';

const DEMO_USERS = [
  { id: '1', email: 'admin@imsop.io', password: 'admin123', name: 'Admin User', role: 'admin' },
  { id: '2', email: 'engineer@imsop.io', password: 'engineer123', name: 'Engineer User', role: 'engineer' },
  { id: '3', email: 'analyst@imsop.io', password: 'analyst123', name: 'Analyst User', role: 'analyst' },
  { id: '4', email: 'demo@imsop.io', password: 'demo123', name: 'Demo User', role: 'user' },
];

export async function mockLogin(email: string, password: string) {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 500));
  
  const user = DEMO_USERS.find(u => u.email === email && u.password === password);
  
  if (user) {
    const { password: _, ...userWithoutPassword } = user;
    
    // Store with mock prefix
    safeLocalStorage.setItem(TOKEN_KEY, `mock_${btoa(email)}`);
    safeLocalStorage.setItem(SESSION_KEY, JSON.stringify(userWithoutPassword));
    
    return { success: true, user: userWithoutPassword };
  }
  
  return { success: false, error: 'Invalid email or password' };
}

export function mockGetCurrentUser() {
  const session = safeLocalStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) : null;
}

export function mockLogout() {
  safeLocalStorage.removeItem(TOKEN_KEY);
  safeLocalStorage.removeItem(SESSION_KEY);
}