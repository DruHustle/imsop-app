import { describe, it, expect, beforeEach } from 'vitest';
import * as authService from './auth';

describe('Auth Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe('login', () => {
    it('should login with valid demo credentials', () => {
      const result = authService.login('admin@imsop.io', 'admin123');
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('admin@imsop.io');
      expect(result.user?.role).toBe('admin');
    });

    it('should fail with invalid credentials', () => {
      const result = authService.login('invalid@email.com', 'wrongpassword');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail with wrong password', () => {
      const result = authService.login('admin@imsop.io', 'wrongpassword');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email or password');
    });
  });

  describe('logout', () => {
    it('should clear the session', () => {
      // First login
      authService.login('admin@imsop.io', 'admin123');
      expect(authService.getCurrentUser()).not.toBeNull();
      
      // Then logout
      authService.logout();
      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when not logged in', () => {
      expect(authService.getCurrentUser()).toBeNull();
    });

    it('should return user when logged in', () => {
      authService.login('engineer@imsop.io', 'engineer123');
      const user = authService.getCurrentUser();
      expect(user).not.toBeNull();
      expect(user?.email).toBe('engineer@imsop.io');
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate reset token for existing user', () => {
      const result = authService.requestPasswordReset('admin@imsop.io');
      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
    });

    it('should still return success for non-existing user (security)', () => {
      const result = authService.requestPasswordReset('nonexistent@email.com');
      expect(result.success).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', () => {
      // First request a reset
      const resetResult = authService.requestPasswordReset('admin@imsop.io');
      expect(resetResult.token).toBeDefined();
      
      // Then reset with the token
      const result = authService.resetPassword(resetResult.token!, 'newpassword123');
      expect(result.success).toBe(true);
    });

    it('should fail with invalid token', () => {
      const result = authService.resetPassword('invalid-token', 'newpassword123');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid or expired reset token');
    });
  });

  describe('changePassword', () => {
    it('should change password with correct current password', () => {
      authService.login('demo@imsop.io', 'demo123');
      const user = authService.getCurrentUser();
      
      const result = authService.changePassword(user!.id, 'demo123', 'newpassword456');
      expect(result.success).toBe(true);
    });

    it('should fail with incorrect current password', () => {
      authService.login('demo@imsop.io', 'demo123');
      const user = authService.getCurrentUser();
      
      const result = authService.changePassword(user!.id, 'wrongpassword', 'newpassword456');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });
  });

  describe('register', () => {
    it('should register a new user', () => {
      const result = authService.register('newuser@test.com', 'password123', 'New User');
      expect(result.success).toBe(true);
      // Note: register returns success but may not return user object in demo mode
    });

    it('should fail if email already exists', () => {
      const result = authService.register('admin@imsop.io', 'password123', 'Admin');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already registered');
    });
  });
});
