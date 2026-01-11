/**
 * A safe wrapper for localStorage and sessionStorage that handles Safari Private Browsing mode
 * and other environments where storage might be restricted.
 */

const isStorageAvailable = (type: 'localStorage' | 'sessionStorage'): boolean => {
  try {
    const storage = window[type];
    const x = '__storage_test__';
    storage.setItem(x, x);
    storage.removeItem(x);
    return true;
  } catch (e) {
    return false;
  }
};

const storageAvailable = {
  local: isStorageAvailable('localStorage'),
  session: isStorageAvailable('sessionStorage'),
};

// In-memory fallback for when storage is not available
const memoryStorage: Record<string, string> = {};
const sessionMemoryStorage: Record<string, string> = {};

export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (storageAvailable.local) {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return memoryStorage[key] || null;
      }
    }
    return memoryStorage[key] || null;
  },
  setItem: (key: string, value: string): void => {
    if (storageAvailable.local) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        memoryStorage[key] = value;
      }
    } else {
      memoryStorage[key] = value;
    }
  },
  removeItem: (key: string): void => {
    if (storageAvailable.local) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        delete memoryStorage[key];
      }
    } else {
      delete memoryStorage[key];
    }
  },
  clear: (): void => {
    if (storageAvailable.local) {
      try {
        localStorage.clear();
      } catch (e) {
        for (const key in memoryStorage) {
          delete memoryStorage[key];
        }
      }
    } else {
      for (const key in memoryStorage) {
        delete memoryStorage[key];
      }
    }
  }
};

export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    if (storageAvailable.session) {
      try {
        return sessionStorage.getItem(key);
      } catch (e) {
        return sessionMemoryStorage[key] || null;
      }
    }
    return sessionMemoryStorage[key] || null;
  },
  setItem: (key: string, value: string): void => {
    if (storageAvailable.session) {
      try {
        sessionStorage.setItem(key, value);
      } catch (e) {
        sessionMemoryStorage[key] = value;
      }
    } else {
      sessionMemoryStorage[key] = value;
    }
  },
  removeItem: (key: string): void => {
    if (storageAvailable.session) {
      try {
        sessionStorage.removeItem(key);
      } catch (e) {
        delete sessionMemoryStorage[key];
      }
    } else {
      delete sessionMemoryStorage[key];
    }
  },
  clear: (): void => {
    if (storageAvailable.session) {
      try {
        sessionStorage.clear();
      } catch (e) {
        for (const key in sessionMemoryStorage) {
          delete sessionMemoryStorage[key];
        }
      }
    } else {
      for (const key in sessionMemoryStorage) {
        delete sessionMemoryStorage[key];
      }
    }
  }
};
