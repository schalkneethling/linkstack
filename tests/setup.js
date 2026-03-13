// -check
import { afterEach, vi } from "vitest";

// Clean up after each test
afterEach(() => {
  if (typeof window !== "undefined") {
    if (!window.localStorage || typeof window.localStorage.clear !== "function") {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: {
          store: {},
          getItem(key) {
            return this.store[key] ?? null;
          },
          setItem(key, value) {
            this.store[key] = String(value);
          },
          removeItem(key) {
            delete this.store[key];
          },
          clear() {
            this.store = {};
          },
        },
      });
    }

    window.localStorage.clear();
  }

  vi.restoreAllMocks();
});
