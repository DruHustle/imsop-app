import { API_ORIGIN } from "./api-origin";
import { safeLocalStorage, safeSessionStorage } from "./storage";
import { User, AuthResponse, IAuthService } from "./auth-types";

const TOKEN_KEY = "imsop_token",
  USER_KEY = "imsop_user";
export { resolveApiOrigin as resolveAuthOrigin } from "./api-origin";
const API_BASE = API_ORIGIN;
// The wrapper already provides a memory fallback when browser storage is blocked.
const getStorage = () => safeLocalStorage;

export class ApiAuthService implements IAuthService {
  private async fetchApi(path: string, opts: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...opts,
        signal: controller.signal,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...opts.headers },
      });
      if (res.status === 401 && path === "/api/auth/logout") {
        safeSessionStorage.removeItem("imsop:signout-pending");
        return {};
      }
      if (
        res.status === 401 &&
        !["/api/auth/login", "/api/auth/me"].includes(path)
      )
        window.dispatchEvent(new Event("imsop:session-expired"));
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => ({}))).error || "API failed"
        );
      if (res.status === 204) return {};
      if (
        !(res.headers?.get("Content-Type") ?? "application/json").includes(
          "application/json"
        )
      )
        throw new Error(
          "The server returned an unexpected response. Please retry."
        );
      return await res.json();
    } catch (error) {
      if (controller.signal.aborted)
        throw new Error(
          "The server took too long to respond. Please try again."
        );
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      if (safeSessionStorage.getItem("imsop:signout-pending"))
        await this.logout();
      const { user } = await this.fetchApi("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      const s = getStorage();
      s.removeItem(TOKEN_KEY);
      s.setItem(USER_KEY, JSON.stringify(user));
      return { success: true, user };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
  logout = async () => {
    safeSessionStorage.setItem("imsop:signout-pending", "true");
    [TOKEN_KEY, USER_KEY].forEach(k => getStorage().removeItem(k));
    await this.fetchApi("/api/auth/logout", { method: "POST" });
    safeSessionStorage.removeItem("imsop:signout-pending");
  };
  async getCurrentUser(): Promise<AuthResponse> {
    if (safeSessionStorage.getItem("imsop:signout-pending"))
      return {
        success: false,
        error:
          "Sign out was not confirmed. Sign in retries it before continuing.",
      };
    const t = getStorage().getItem(TOKEN_KEY);
    if (t?.startsWith("mock_")) return { success: false };
    try {
      return {
        success: true,
        user: (await this.fetchApi("/api/auth/me")).user,
      };
    } catch {
      return { success: false };
    }
  }
  register = async (email: string, password: string, name: string) =>
    this.wrap(() =>
      this.fetchApi("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      })
    );
  requestPasswordReset = async (email: string) =>
    this.wrap(() =>
      this.fetchApi("/api/auth/request-reset", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
    );
  resetPassword = async (token: string, newPassword: string) =>
    this.wrap(() =>
      this.fetchApi("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      })
    );
  updateProfile = async (id: string, updates: any) =>
    this.wrap(() =>
      this.fetchApi(`/api/auth/profile/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      })
    );
  changePassword = async (
    id: string,
    currentPassword: string,
    newPassword: string
  ) =>
    this.wrap(() =>
      this.fetchApi(`/api/auth/change-password/${id}`, {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
    );
  private async wrap(fn: () => Promise<any>): Promise<AuthResponse> {
    try {
      const res = await fn();
      return { success: true, ...res };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
export const apiAuthService = new ApiAuthService();
