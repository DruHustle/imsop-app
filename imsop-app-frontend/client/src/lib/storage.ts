/** Fall back consistently if storage is blocked or becomes unavailable at runtime. */
export function createSafeStorage(type: "localStorage" | "sessionStorage") {
  const memory = new Map<string, string>();
  let available = true;
  try {
    const storage = window[type];
    const probe = "__imsop_storage_probe__";
    storage.setItem(probe, probe);
    storage.removeItem(probe);
  } catch {
    available = false;
  }
  return {
    getItem(key: string): string | null {
      if (available) {
        try {
          const value = window[type].getItem(key);
          if (value === null) memory.delete(key);
          else memory.set(key, value);
          return value;
        } catch {
          available = false;
        }
      }
      return memory.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      memory.set(key, value);
      if (available) {
        try {
          window[type].setItem(key, value);
        } catch {
          available = false;
        }
      }
    },
    removeItem(key: string): void {
      memory.delete(key);
      if (available) {
        try {
          window[type].removeItem(key);
        } catch {
          available = false;
        }
      }
    },
    clear(): void {
      memory.clear();
      if (available) {
        try {
          window[type].clear();
        } catch {
          available = false;
        }
      }
    },
  };
}
export const safeLocalStorage = createSafeStorage("localStorage");
export const safeSessionStorage = createSafeStorage("sessionStorage");
