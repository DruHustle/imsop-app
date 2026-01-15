import { mockAuthService } from './auth';
import { apiAuthService } from './api-auth';
import { safeLocalStorage } from './storage';

const DEMO_DOMAINS = ['@dev.local', '@imsop.io', '@demo.local'];
const MOCK_TOKEN_PREFIX = 'mock_';
const TOKEN_KEY = 'imsop_token';

export const AuthServiceFactory = {
  getService: (email?: string) => {
    if (email) {
      const isDemo = DEMO_DOMAINS.some(domain => email.endsWith(domain)) || email === 'admin@demo.com';
      return isDemo ? mockAuthService : apiAuthService;
    }
    const token = safeLocalStorage.getItem(TOKEN_KEY);
    return token?.startsWith(MOCK_TOKEN_PREFIX) ? mockAuthService : apiAuthService;
  }
};
