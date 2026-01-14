import { beforeAll, afterEach, afterAll } from "vitest";

// Clean up after each test
afterEach(() => {
  // Clear localStorage
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
});
