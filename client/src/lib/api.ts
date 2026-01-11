import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { safeLocalStorage } from './storage';

// Standardized API Response format
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  message?: string;
}

// Base API Client Configuration
class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = '/api') {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Request Interceptor
    this.client.interceptors.request.use(
      (config) => {
        const token = safeLocalStorage.getItem('imsop_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response Interceptor
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        // Standardized error handling
        const message = error.response?.data?.message || error.message || 'An unknown error occurred';
        console.error('[API Error]:', message);
        return Promise.reject({ ...error, message });
      }
    );
  }

  // Generic GET method
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.get(url, config);
    return { data: response.data, status: response.status };
  }

  // Generic POST method
  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.post(url, data, config);
    return { data: response.data, status: response.status };
  }

  // Generic PUT method
  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.put(url, data, config);
    return { data: response.data, status: response.status };
  }

  // Generic DELETE method
  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    const response: AxiosResponse<T> = await this.client.delete(url, config);
    return { data: response.data, status: response.status };
  }
}

// Export a singleton instance
export const api = new ApiClient();

// Service Factory for easy extension
export class BaseService {
  protected endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  protected getUrl(path: string = ''): string {
    return `${this.endpoint}${path}`;
  }
}
