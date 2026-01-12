export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'engineer' | 'analyst' | 'user';
  avatar?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
  token?: string;
}

export interface IAuthService {
  login(email: string, password: string): Promise<AuthResponse>;
  logout(): void;
  getCurrentUser(): Promise<AuthResponse>;
  register(email: string, password: string, name: string): Promise<AuthResponse>;
  requestPasswordReset(email: string): Promise<AuthResponse>;
  resetPassword(token: string, newPassword: string): Promise<AuthResponse>;
  updateProfile(userId: string, updates: Partial<Pick<User, 'name' | 'avatar'>>): Promise<AuthResponse>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<AuthResponse>;
}
