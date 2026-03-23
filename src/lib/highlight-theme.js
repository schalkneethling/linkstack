// @ts-check

import {
  DEFAULT_HIGHLIGHT_COLOR,
  getHighlightTheme,
  normalizeHighlightColor,
} from "../constants/highlight-theme.js";
import { STORAGE_KEYS } from "../constants/storage-keys.js";

const AUTH_STORAGE_KEY = "linkstack-auth";

/**
 * @typedef {{
 *   userId: string
 *   highlightColor: string
 * }} HighlightPreferenceCache
 */

/**
 * @returns {HighlightPreferenceCache | null}
 */
function readCachedPreference() {
  const stored = localStorage.getItem(STORAGE_KEYS.highlightPreferenceCache);

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.userId === "string"
    ) {
      return {
        userId: parsed.userId,
        highlightColor: normalizeHighlightColor(parsed.highlightColor),
      };
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * @returns {string | null}
 */
function getPersistedAuthUserId() {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored);
    const sessionUserId =
      parsed?.user?.id ??
      parsed?.currentSession?.user?.id ??
      parsed?.session?.user?.id ??
      null;

    return typeof sessionUserId === "string" ? sessionUserId : null;
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value
 * @param {HTMLElement} [root]
 * @returns {string}
 */
export function applyHighlightColor(
  value,
  root = document.documentElement,
) {
  const highlightColor = normalizeHighlightColor(value);
  const theme = getHighlightTheme(highlightColor);

  root.style.setProperty("--ls-accent", theme.accent);
  root.style.setProperty("--ls-accent-hover", theme.accentHover);
  root.style.setProperty("--ls-accent-subtle", theme.accentSubtle);
  root.style.setProperty("--ls-accent-muted", theme.accentMuted);
  root.style.setProperty("--ls-border-focus", theme.borderFocus);

  return highlightColor;
}

/**
 * @param {string} userId
 * @returns {string | null}
 */
export function getCachedHighlightColorForUser(userId) {
  const cachedPreference = readCachedPreference();

  if (!cachedPreference || cachedPreference.userId !== userId) {
    return null;
  }

  return cachedPreference.highlightColor;
}

/**
 * @param {string} userId
 * @param {unknown} highlightColor
 * @returns {string}
 */
export function cacheHighlightColorForUser(userId, highlightColor) {
  const normalizedHighlightColor = normalizeHighlightColor(highlightColor);

  localStorage.setItem(
    STORAGE_KEYS.highlightPreferenceCache,
    JSON.stringify({
      userId,
      highlightColor: normalizedHighlightColor,
    }),
  );

  return normalizedHighlightColor;
}

export function clearHighlightColorCache() {
  localStorage.removeItem(STORAGE_KEYS.highlightPreferenceCache);
}

/**
 * @param {HTMLElement} [root]
 * @returns {string}
 */
export function applyCachedHighlightColor(root = document.documentElement) {
  const persistedAuthUserId = getPersistedAuthUserId();

  if (!persistedAuthUserId) {
    return applyHighlightColor(DEFAULT_HIGHLIGHT_COLOR, root);
  }

  const cachedHighlightColor = getCachedHighlightColorForUser(
    persistedAuthUserId,
  );

  return applyHighlightColor(cachedHighlightColor, root);
}
