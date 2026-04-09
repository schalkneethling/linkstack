// @ts-check
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_HIGHLIGHT_COLOR,
  normalizeHighlightColor,
} from "../../src/constants/highlight-theme.js";
import {
  applyCachedHighlightColor,
  applyHighlightColor,
  cacheHighlightColorForUser,
  clearHighlightColorCache,
  getCachedHighlightColorForUser,
} from "../../src/lib/highlight-theme.js";
import { STORAGE_KEYS } from "../../src/constants/storage-keys.js";

describe("highlight theme helpers", () => {
  beforeEach(() => {
    window.localStorage?.clear?.();
    document.documentElement.style.removeProperty("--ls-accent");
    document.documentElement.style.removeProperty("--ls-accent-hover");
    document.documentElement.style.removeProperty("--ls-accent-subtle");
    document.documentElement.style.removeProperty("--ls-accent-muted");
    document.documentElement.style.removeProperty("--ls-border-focus");
  });

  it("normalizes invalid highlight colors to default", () => {
    expect(normalizeHighlightColor("unknown")).toBe(DEFAULT_HIGHLIGHT_COLOR);
  });

  it("keeps highlight color cache scoped to the current user", () => {
    cacheHighlightColorForUser("user-1", "rose");

    expect(getCachedHighlightColorForUser("user-1")).toBe("rose");
    expect(getCachedHighlightColorForUser("user-2")).toBe(null);
  });

  it("applies the cached highlight color only when the persisted auth session matches the cached user", () => {
    cacheHighlightColorForUser("user-1", "plum");
    localStorage.setItem(
      "linkstack-auth",
      JSON.stringify({
        currentSession: {
          user: {
            id: "user-1",
          },
        },
      }),
    );

    expect(applyCachedHighlightColor()).toBe("plum");
    expect(document.documentElement.style.getPropertyValue("--ls-accent")).toBe(
      "#7c3aed",
    );
  });

  it("falls back to the default highlight color when no matching auth session exists", () => {
    cacheHighlightColorForUser("user-1", "moss");
    localStorage.setItem(
      "linkstack-auth",
      JSON.stringify({
        currentSession: {
          user: {
            id: "user-2",
          },
        },
      }),
    );

    expect(applyCachedHighlightColor()).toBe(DEFAULT_HIGHLIGHT_COLOR);
    expect(document.documentElement.style.getPropertyValue("--ls-accent")).toBe(
      "#0d9488",
    );
  });

  it("clears the cached highlight preference", () => {
    cacheHighlightColorForUser("user-1", "amber");
    clearHighlightColorCache();

    expect(
      localStorage.getItem(STORAGE_KEYS.highlightPreferenceCache),
    ).toBeNull();
  });

  it("applies the accent variables for the selected theme", () => {
    expect(applyHighlightColor("cobalt")).toBe("cobalt");
    expect(document.documentElement.style.getPropertyValue("--ls-accent")).toBe(
      "#2563eb",
    );
    expect(
      document.documentElement.style.getPropertyValue("--ls-accent-hover"),
    ).toBe("#1d4ed8");
  });
});
