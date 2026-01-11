/**
 * Client-side authentication service for GitHub Pages deployment
 * Uses localStorage for demo purposes - in production, connect to your backend API
 */

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'engineer' | 'analyst' | 'user';
  avatar?: string;
}

interface StoredUser extends User {
  password: string;
  resetToken?: string;
  resetTokenExpiry?: number;
}

const USERS_KEY = 'imsop_users';
const SESSION_KEY = 'imsop_session';
const RESET_TOKENS_KEY = 'imsop_reset_tokens';
import { safeLocalStorage } from './storage';

// Demo users - pre-populated on first load
const DEMO_USERS: StoredUser[] = [
  { id: '1', email: 'admin@imsop.io', password: 'admin123', name: 'Admin User', role: 'admin' },
  { id: '2', email: 'engineer@imsop.io', password: 'engineer123', name: 'Engineer User', role: 'engineer' },
  { id: '3', email: 'analyst@imsop.io', password: 'analyst123', name: 'Analyst User', role: 'analyst' },
  { id: '4', email: 'demo@imsop.io', password: 'demo123', name: 'Demo User', role: 'user' },
];

// Initialize demo users if not exists
function initializeUsers(): void {
  const existing = safeLocalStorage.getItem(USERS_KEY);
  if (!existing) {
    safeLocalStorage.setItem(USERS_KEY, JSON.stringify(DEMO_USERS));
  }
}

function getUsers(): StoredUser[] {
  initializeUsers();
  return JSON.parse(safeLocalStorage.getItem(USERS_KEY) || '[]');
}

function saveUsers(users: StoredUser[]): void {
  safeLocalStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function login(email: string, password: string): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  
  if (!user) {
    return { success: false, error: 'Invalid email or password' };
  }
  
  const sessionUser: User = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
  };
  
  safeLocalStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
  return { success: true, user: sessionUser };
}

export function logout(): void {
  safeLocalStorage.removeItem(SESSION_KEY);
}

export function getCurrentUser(): User | null {
  const session = safeLocalStorage.getItem(SESSION_KEY);
  if (!session) return null;
  
  try {
    return JSON.parse(session);
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function register(email: string, password: string, name: string): { success: boolean; error?: string } {
  const users = getUsers();
  
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, error: 'Email already registered' };
  }
  
  const newUser: StoredUser = {
    id: String(Date.now()),
    email,
    password,
    name,
    role: 'user',
  };
  
  users.push(newUser);
  saveUsers(users);
  
  return { success: true };
}

export function requestPasswordReset(email: string): { success: boolean; token?: string; error?: string } {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (userIndex === -1) {
    // Don't reveal if email exists or not for security
    return { success: true };
  }
  
  // Generate a simple reset token (in production, use crypto)
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const expiry = Date.now() + 3600000; // 1 hour
  
  users[userIndex].resetToken = token;
  users[userIndex].resetTokenExpiry = expiry;
  saveUsers(users);
  
  // In a real app, you would send an email here
  // For demo, we return the token directly
  return { success: true, token };
}

export function resetPassword(token: string, newPassword: string): { success: boolean; error?: string } {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.resetToken === token);
  
  if (userIndex === -1) {
    return { success: false, error: 'Invalid or expired reset token' };
  }
  
  const user = users[userIndex];
  
  if (user.resetTokenExpiry && user.resetTokenExpiry < Date.now()) {
    return { success: false, error: 'Reset token has expired' };
  }
  
  users[userIndex].password = newPassword;
  users[userIndex].resetToken = undefined;
  users[userIndex].resetTokenExpiry = undefined;
  saveUsers(users);
  
  return { success: true };
}

export function updateProfile(userId: string, updates: Partial<Pick<User, 'name' | 'avatar'>>): { success: boolean; user?: User; error?: string } {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return { success: false, error: 'User not found' };
  }
  
  if (updates.name) users[userIndex].name = updates.name;
  if (updates.avatar) users[userIndex].avatar = updates.avatar;
  
  saveUsers(users);
  
  const updatedUser: User = {
    id: users[userIndex].id,
    email: users[userIndex].email,
    name: users[userIndex].name,
    role: users[userIndex].role,
    avatar: users[userIndex].avatar,
  };
  
  // Update session
  safeLocalStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
  
  return { success: true, user: updatedUser };
}

export function changePassword(userId: string, currentPassword: string, newPassword: string): { success: boolean; error?: string } {
  const users = getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  
  if (userIndex === -1) {
    return { success: false, error: 'User not found' };
  }
  
  if (users[userIndex].password !== currentPassword) {
    return { success: false, error: 'Current password is incorrect' };
  }
  
  users[userIndex].password = newPassword;
  saveUsers(users);
  
  return { success: true };
}
