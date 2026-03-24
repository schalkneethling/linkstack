// @ts-check
import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryState = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  setUser: vi.fn(),
  scope: {
    setTag: vi.fn(),
    setExtra: vi.fn(),
  },
}));

vi.mock("@sentry/browser", () => ({
  init: (...args) => sentryState.init(...args),
  captureException: (...args) => sentryState.captureException(...args),
  setUser: (...args) => sentryState.setUser(...args),
  withScope: (callback) => callback(sentryState.scope),
}));

vi.mock("varlock/env", () => ({
  ENV: {
    VITE_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
    VITE_SENTRY_ENVIRONMENT: "test",
    APP_ENV: "test",
  },
}));

describe("monitoring", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("__APP_VERSION__", "test-build");
    sentryState.init.mockReset();
    sentryState.captureException.mockReset();
    sentryState.setUser.mockReset();
    sentryState.scope.setTag.mockReset();
    sentryState.scope.setExtra.mockReset();
  });

  it("preserves string errors instead of collapsing them into a generic wrapper", async () => {
    const { initMonitoring, captureException } = await import(
      "../../src/lib/monitoring.js"
    );

    initMonitoring();
    captureException("Bookmarks query failed", { surface: "bookmarks" });

    expect(sentryState.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Bookmarks query failed",
      }),
    );
    expect(sentryState.scope.setExtra).toHaveBeenCalledWith(
      "originalError",
      "Bookmarks query failed",
    );
  });

  it("preserves message and structured fields from non-Error objects", async () => {
    const { initMonitoring, captureException } = await import(
      "../../src/lib/monitoring.js"
    );

    initMonitoring();
    captureException(
      {
        message: "Could not find the page_title column",
        code: "PGRST204",
        hint: "Verify the selected columns",
        status: 400,
      },
      { action: "render-bookmarks" },
    );

    expect(sentryState.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Could not find the page_title column",
      }),
    );
    expect(sentryState.scope.setExtra).toHaveBeenCalledWith(
      "code",
      "PGRST204",
    );
    expect(sentryState.scope.setExtra).toHaveBeenCalledWith(
      "hint",
      "Verify the selected columns",
    );
    expect(sentryState.scope.setExtra).toHaveBeenCalledWith("status", 400);
  });
});
