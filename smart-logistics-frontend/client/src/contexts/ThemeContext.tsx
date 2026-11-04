import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { safeLocalStorage } from "@/lib/storage";
import { useAuth } from "./AuthContext";
export type Theme = "light" | "dark" | "system";
const valid = (value: string | null): value is Theme =>
  ["light", "dark", "system"].includes(value ?? "");
const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (t: Theme) => void;
} | null>(null);
export function ThemeProvider({
  children,
  defaultTheme = "system",
}: {
  children: ReactNode;
  defaultTheme?: Theme;
}) {
  const [theme, setValue] = useState<Theme>(() => {
    const stored = safeLocalStorage.getItem("theme");
    return valid(stored) ? stored : defaultTheme;
  });
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const effective =
        theme === "system" ? (system.matches ? "dark" : "light") : theme;
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(effective);
      document.documentElement.style.colorScheme = effective;
    };
    apply();
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [theme]);
  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme: t => {
          if (valid(t)) {
            safeLocalStorage.setItem("theme", t);
            setValue(t);
          }
        },
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("Theme provider required");
  return c;
}
interface Preferences {
  reducedMotion: boolean;
  contrast: boolean;
  shipmentNotifications: boolean;
}
const defaults: Preferences = {
  reducedMotion: false,
  contrast: false,
  shipmentNotifications: true,
};
const PreferencesContext = createContext<{
  preferences: Preferences;
  update: (v: Partial<Preferences>) => void;
} | null>(null);
function ScopedPreferences({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = `imsop:preferences:${user?.id ?? "guest"}:${user?.email ?? ""}`;
  const readPreferences = () => {
    try {
      const stored = JSON.parse(safeLocalStorage.getItem(key) || "{}");
      return Object.fromEntries(
        Object.entries(defaults).map(([name, value]) => [
          name,
          typeof stored[name] === "boolean" ? stored[name] : value,
        ])
      ) as unknown as Preferences;
    } catch {
      return defaults;
    }
  };
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  // Update preference values on identity changes without remounting a recovery form in flight.
  useEffect(() => setPreferences(readPreferences()), [key]);
  useEffect(() => {
    const system = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      document.documentElement.dataset.reducedMotion = String(
        preferences.reducedMotion || system.matches
      );
      document.documentElement.dataset.contrast = String(preferences.contrast);
    };
    apply();
    system.addEventListener("change", apply);
    return () => {
      system.removeEventListener("change", apply);
      delete document.documentElement.dataset.reducedMotion;
      delete document.documentElement.dataset.contrast;
    };
  }, [preferences]);
  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        update: v =>
          setPreferences(p => {
            const next = { ...p, ...v };
            safeLocalStorage.setItem(key, JSON.stringify(next));
            return next;
          }),
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <ScopedPreferences>{children}</ScopedPreferences>;
}
export function usePreferences() {
  const c = useContext(PreferencesContext);
  if (!c) throw new Error("Preferences provider required");
  return c;
}
