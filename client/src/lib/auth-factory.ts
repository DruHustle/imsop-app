import { IAuthService } from './auth-types';
import { mockAuthService } from './auth';
import { apiAuthService } from './api-auth';
import { safeLocalStorage } from './storage';

export class AuthServiceFactory {
  static getService(email?: string): IAuthService {
    if (email) {
      if (this.isDemoAccount(email)) {
        return mockAuthService;
      }
      return apiAuthService;
    }

    const token = safeLocalStorage.getItem('imsop_token');
    if (token?.startsWith('mock_')) {
      return mockAuthService;
    }
    return apiAuthService;
  }

  private static isDemoAccount(email: string): boolean {
    return (
      email.endsWith('@dev.local') || 
      email === 'admin@demo.com' || 
      email.endsWith('@imsop.io') ||
      email.endsWith('@demo.local')
    );
  }
}
