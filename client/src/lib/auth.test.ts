import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthServiceFactory } from './auth-factory';
import { safeLocalStorage } from './storage';

describe('Auth Service', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    safeLocalStorage.clear();
    vi.clearAllMocks();
  });

  describe('AuthServiceFactory', () => {
    it('should return MockAuthService for demo emails', () => {
      const service = AuthServiceFactory.getService('admin@imsop.io');
      expect(service.constructor.name).toBe('MockAuthService');
    });

    it('should return ApiAuthService for real emails', () => {
      const service = AuthServiceFactory.getService('user@real.com');
      expect(service.constructor.name).toBe('ApiAuthService');
    });

    it('should return MockAuthService if mock token exists', () => {
      safeLocalStorage.setItem('imsop_token', 'mock_token');
      const service = AuthServiceFactory.getService();
      expect(service.constructor.name).toBe('MockAuthService');
    });
  });

  describe('MockAuthService', () => {
    const service = AuthServiceFactory.getService('admin@imsop.io');

    it('should login with valid demo credentials', async () => {
      const result = await service.login('admin@imsop.io', 'admin123');
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user?.email).toBe('admin@imsop.io');
    });

    it('should fail with invalid credentials', async () => {
      const result = await service.login('invalid@email.com', 'wrongpassword');
      expect(result.success).toBe(false);
    });

    it('should logout and clear session', async () => {
      await service.login('admin@imsop.io', 'admin123');
      service.logout();
      const result = await service.getCurrentUser();
      expect(result.success).toBe(false);
    });
  });
});
