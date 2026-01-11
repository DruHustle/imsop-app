/**
 * Navigation Service
 * Implements Single Responsibility Principle by handling navigation state
 * Follows Open/Closed Principle - extensible for new navigation patterns
 */

const NAVIGATION_KEY = 'imsop_navigation_state';

export interface NavigationState {
  currentPath: string;
  previousPath?: string;
  history: string[];
}

/**
 * Navigation service - manages navigation state across the application
 * Follows Dependency Inversion Principle by exposing interfaces
 */
export class NavigationService {
  /**
   * Save current navigation state
   * @param state - The navigation state to save
   */
  static saveState(state: NavigationState): void {
    try {
      sessionStorage.setItem(NAVIGATION_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save navigation state:', error);
    }
  }

  /**
   * Load navigation state
   * @returns Saved navigation state or null
   */
  static loadState(): NavigationState | null {
    try {
      const saved = sessionStorage.getItem(NAVIGATION_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.warn('Failed to load navigation state:', error);
      return null;
    }
  }

  /**
   * Clear navigation state
   */
  static clearState(): void {
    try {
      sessionStorage.removeItem(NAVIGATION_KEY);
    } catch (error) {
      console.warn('Failed to clear navigation state:', error);
    }
  }

  /**
   * Add path to navigation history
   * @param path - The path to add
   */
  static addToHistory(path: string): void {
    const state = this.loadState() || { currentPath: '/', history: [] };
    
    if (state.currentPath) {
      state.previousPath = state.currentPath;
    }
    
    state.currentPath = path;
    state.history.push(path);
    
    // Keep only last 10 items in history
    if (state.history.length > 10) {
      state.history = state.history.slice(-10);
    }
    
    this.saveState(state);
  }

  /**
   * Get current path
   * @returns Current path or null
   */
  static getCurrentPath(): string | null {
    const state = this.loadState();
    return state ? state.currentPath : null;
  }

  /**
   * Get previous path
   * @returns Previous path or null
   */
  static getPreviousPath(): string | null {
    const state = this.loadState();
    return state?.previousPath || null;
  }

  /**
   * Get navigation history
   * @returns Array of visited paths
   */
  static getHistory(): string[] {
    const state = this.loadState();
    return state?.history || [];
  }

  /**
   * Check if user can go back
   * @returns True if previous path exists
   */
  static canGoBack(): boolean {
    return this.getPreviousPath() !== null;
  }
}
