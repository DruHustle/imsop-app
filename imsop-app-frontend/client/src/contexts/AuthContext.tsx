import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { User, AuthResponse } from "@/lib/auth-types";
import { AuthServiceFactory } from "@/lib/auth-factory";
import { apiAuthService } from "@/lib/api-auth";
import { toast } from "sonner";
import { safeLocalStorage, safeSessionStorage } from "@/lib/storage";
import { publishAuthChange, subscribeAuthChanges } from "@/lib/auth-events";
function clearSensitiveState(user?: User | null, logout = false) {
  for (const storage of [safeLocalStorage, safeSessionStorage]) {
    for (const key of ["imsop_notifications", "imsop_navigation_state"])
      storage.removeItem(key);
    if (logout)
      for (const key of ["imsop_user", "imsop_session"])
        storage.removeItem(key);
    if (user)
      for (const account of ["demo-account", "account"])
        for (const mode of ["live", "demo"])
          storage.removeItem(
            `imsop:notifications:${user.id}:${user.email}:${account}:${mode}`
          );
  }
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (
    e: string,
    p: string,
    mode?: "live" | "demo"
  ) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  register: (e: string, p: string, n: string) => Promise<AuthResponse>;
  requestPasswordReset: (e: string) => Promise<AuthResponse>;
  resetPassword: (t: string, p: string) => Promise<AuthResponse>;
  updateProfile: (
    u: Partial<Pick<User, "name" | "avatar">>
  ) => Promise<AuthResponse>;
  changePassword: (c: string, n: string) => Promise<AuthResponse>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getSvc = useCallback(
    (email?: string) => AuthServiceFactory.getService(email),
    []
  );

  useEffect(() => {
    let isMounted = true;
    getSvc()
      .getCurrentUser()
      .then(r => {
        if (isMounted && r.success) setUser(r.user || null);
      })
      .catch(() => {
        if (isMounted) setUser(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [getSvc]);

  useEffect(
    () =>
      subscribeAuthChanges(() => {
        clearSensitiveState(user);
        setUser(null);
        if (user)
          toast.info(
            "Your session changed in another tab. Sign in again to continue."
          );
      }),
    [user]
  );

  useEffect(() => {
    const expire = () => {
      if (!user || safeLocalStorage.getItem("imsop_token")?.startsWith("mock_"))
        return;
      safeSessionStorage.setItem("imsop:return-to", window.location.hash);
      safeSessionStorage.setItem("imsop:session-expired", "true");
      clearSensitiveState(user, true);
      setUser(null);
      toast.error("Your session expired. Sign in again to continue.");
    };
    window.addEventListener("imsop:session-expired", expire);
    return () => window.removeEventListener("imsop:session-expired", expire);
  }, [user]);

  const handleAuthAction = useCallback(
    async (action: () => Promise<AuthResponse>) => {
      const result = await action();
      if (result.success && result.user) {
        if (
          user &&
          (user.id !== result.user.id || user.email !== result.user.email)
        )
          clearSensitiveState(user);
        setUser(result.user);
      }
      return result;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login: (e: string, p: string, mode?: "live" | "demo") =>
        handleAuthAction(async () => {
          const result = await AuthServiceFactory.getService(e, mode).login(
            e,
            p
          );
          if (result.success) publishAuthChange();
          if (mode === "live" && result.success && result.user)
            safeLocalStorage.setItem(
              `imsop:mode:${result.user.id}:${result.user.email}:account`,
              "live"
            );
          return result;
        }),
      logout: async () => {
        const service = getSvc();
        clearSensitiveState(user, true);
        setUser(null);
        publishAuthChange();
        try {
          await service.logout();
        } catch {
          toast.error(
            "Sign out could not be confirmed. This device is locked out locally; signing in will retry server sign out."
          );
        }
      },
      register: (e: string, p: string, n: string) =>
        handleAuthAction(async () => {
          const result = await getSvc(e).register(e, p, n);
          if (result.success) publishAuthChange();
          return result;
        }),
      requestPasswordReset: (e: string) =>
        apiAuthService.requestPasswordReset(e),
      resetPassword: async (t: string, p: string) => {
        const result = await apiAuthService.resetPassword(t, p);
        if (result.success) {
          publishAuthChange();
          clearSensitiveState(user, true);
          safeLocalStorage.removeItem("imsop_token");
          setUser(null);
          try {
            await apiAuthService.logout();
          } catch {
            toast.error(
              "Password reset. Server sign out is unconfirmed; sign in will retry it."
            );
          }
        }
        return result;
      },
      updateProfile: (u: Partial<Pick<User, "name" | "avatar">>) =>
        user
          ? handleAuthAction(() => getSvc().updateProfile(user.id, u))
          : Promise.resolve({ success: false, error: "Not authenticated" }),
      changePassword: async (c: string, n: string) => {
        if (!user) return { success: false, error: "Not authenticated" };
        const service = getSvc(),
          result = await service.changePassword(user.id, c, n);
        if (result.success && service === apiAuthService) {
          publishAuthChange();
          clearSensitiveState(user, true);
          setUser(null);
          toast.info("Password changed. Sign in again.");
        }
        return result;
      },
    }),
    [user, isLoading, getSvc, handleAuthAction]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
