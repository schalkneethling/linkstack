/**
 * Simple app state manager
 * Manages application state and component lifecycle based on auth status
 */

const AppState = {
  UNAUTHENTICATED: "unauthenticated",
  AUTHENTICATED: "authenticated",
};

class AppStateManager {
  #currentState = AppState.UNAUTHENTICATED;
  #listeners = new Set();
  #componentsInitialized = false;

  constructor() {
    // Singleton pattern
    if (AppStateManager.instance) {
      return AppStateManager.instance;
    }
    AppStateManager.instance = this;
  }

  /**
   * Get current app state
   */
  get state() {
    return this.#currentState;
  }

  /**
   * Check if user is authenticated
   */
  get isAuthenticated() {
    return this.#currentState === AppState.AUTHENTICATED;
  }

  /**
   * Check if components have been initialized
   */
  get componentsInitialized() {
    return this.#componentsInitialized;
  }

  /**
   * Set app state
   * @param {string} newState - New state (AppState.AUTHENTICATED or AppState.UNAUTHENTICATED)
   */
  setState(newState) {
    if (this.#currentState === newState) {
      return;
    }

    const previousState = this.#currentState;
    this.#currentState = newState;

    // Notify all listeners
    this.#listeners.forEach((listener) => {
      listener(newState, previousState);
    });
  }

  /**
   * Subscribe to state changes
   * @param {Function} listener - Callback function (newState, previousState) => void
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Mark components as initialized
   */
  markComponentsInitialized() {
    this.#componentsInitialized = true;
  }

  /**
   * Reset components initialized flag
   */
  resetComponentsInitialized() {
    this.#componentsInitialized = false;
  }
}

// Export singleton instance
const appStateManager = new AppStateManager();

export { appStateManager, AppState };
