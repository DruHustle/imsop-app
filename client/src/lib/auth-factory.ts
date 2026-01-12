import { mockAuthService } from './auth';
import { apiAuthService } from './api-auth';
import { safeLocalStorage } from './storage';

export const AuthServiceFactory = {
  getService: (email?: string) => {
    const isDemo = (e: string) => ['@dev.local', '@imsop.io', '@demo.local'].some(d => e.endsWith(d)) || e === 'admin@demo.com';
    if (email) return isDemo(email) ? mockAuthService : apiAuthService;
    return safeLocalStorage.getItem('imsop_token')?.startsWith('mock_') ? mockAuthService : apiAuthService;
  }
};
