/**
 * Hybrid Authentication Service
 * 
 * Supports both:
 * 1. Demo accounts (localStorage) - for quick testing and demos
 * 2. Real backend API (Render) - for production users
 * 
 * Demo accounts are detected by email domain or specific email addresses
 * All other accounts use the real backend API
 */

import * as mockAuth from './auth';
import * as apiAuth from './api-auth';

export type { User } from './auth';

// Demo account email patterns
const DEMO_EMAILS = [
  'admin@imsop.io',
  'engineer@imsop.io',
  'analyst@imsop.io',
  'demo@imsop.io',
  'admin@demo.local',
  'operator@demo.local',
  'analyst@demo.local',
  'demo@demo.local',
];

/**
 * Check if an email is a demo account
 */
function isDemoAccount(email: string): boolean {
  const normalizedEmail = email.toLowerCase().trim();
  return DEMO_EMAILS.includes(normalizedEmail) || 
         normalizedEmail.endsWith('@demo.local') ||
         normalizedEmail.endsWith('@imsop.io');
}

/**
 * Login with hybrid auth (demo or real API)
 */
export async function login(email: string, password: string): Promise<{ success: boolean; user?: any; error?: string }> {
  if (isDemoAccount(email)) {
    // Use mock auth for demo accounts
    console.log('[Hybrid Auth] Using demo account authentication');
    return mockAuth.login(email, password);
  } else {
    // Use real API for production accounts
    console.log('[Hybrid Auth] Using backend API authentication');
    return await apiAuth.login(email, password);
  }
}

/**
 * Register new user (always uses real API)
 */
export async function register(email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> {
  if (isDemoAccount(email)) {
    return { success: false, error: 'Cannot register with demo email domain. Please use a different email.' };
  }
  
  console.log('[Hybrid Auth] Registering new user via backend API');
  return await apiAuth.register(email, password, name);
}

/**
 * Logout (clears both demo and API sessions)
 */
export function logout(): void {
  mockAuth.logout();
  apiAuth.logout();
}

/**
 * Get current user from either storage
 */
export function getCurrentUser(): any {
  // Check API auth first
  const apiUser = apiAuth.getCurrentUser();
  if (apiUser) {
    return apiUser;
  }
  
  // Fall back to mock auth
  const mockUser = mockAuth.getCurrentUser();
  if (mockUser) {
    return mockUser;
  }
  
  return null;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return apiAuth.isAuthenticated() || mockAuth.isAuthenticated();
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; token?: string; error?: string }> {
  if (isDemoAccount(email)) {
    console.log('[Hybrid Auth] Password reset for demo account (mock)');
    return mockAuth.requestPasswordReset(email);
  } else {
    console.log('[Hybrid Auth] Password reset via backend API');
    return await apiAuth.requestPasswordReset(email);
  }
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  // Try API first (tokens are typically from API)
  const apiResult = await apiAuth.resetPassword(token, newPassword);
  if (apiResult.success) {
    return apiResult;
  }
  
  // Fall back to mock auth
  return mockAuth.resetPassword(token, newPassword);
}

/**
 * Update user profile
 */
export async function updateProfile(userId: string, updates: any): Promise<{ success: boolean; user?: any; error?: string }> {
  const currentUser = getCurrentUser();
  
  if (currentUser && isDemoAccount(currentUser.email)) {
    console.log('[Hybrid Auth] Updating demo account profile (mock)');
    return mockAuth.updateProfile(userId, updates);
  } else {
    console.log('[Hybrid Auth] Updating profile via backend API');
    return await apiAuth.updateProfile(userId, updates);
  }
}

/**
 * Change password
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const currentUser = getCurrentUser();
  
  if (currentUser && isDemoAccount(currentUser.email)) {
    console.log('[Hybrid Auth] Changing demo account password (mock)');
    return mockAuth.changePassword(userId, currentPassword, newPassword);
  } else {
    console.log('[Hybrid Auth] Changing password via backend API');
    return await apiAuth.changePassword(userId, currentPassword, newPassword);
  }
}
