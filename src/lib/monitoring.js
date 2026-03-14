// @ts-check
/* global __APP_VERSION__ */
import * as Sentry from "@sentry/browser";
import { ENV } from "varlock/env";

const EXPECTED_ERRORS = Object.freeze([
  "You've already bookmarked this URL",
  "This link is already in the public catalog",
  "Only top-level bookmarks can be submitted publicly",
  "Choose a rejection reason before rejecting a bookmark.",
  "User must be authenticated to perform this action",
]);

const SENTRY_DSN = ENV.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT = ENV.VITE_SENTRY_ENVIRONMENT || ENV.APP_ENV;
const SENTRY_RELEASE = __APP_VERSION__ || undefined;

let isInitialized = false;

/**
 * @returns {boolean}
 */
export function initMonitoring() {
  if (isInitialized || !SENTRY_DSN) {
    return false;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE,
    sendDefaultPii: false,
    ignoreErrors: [...EXPECTED_ERRORS],
  });

  isInitialized = true;
  return true;
}

/**
 * @param {unknown} error
 * @param {Record<string, unknown>} [context]
 */
export function captureException(error, context = {}) {
  if (!isInitialized) {
    return;
  }

  const normalizedError =
    error instanceof Error ? error : new Error("Unexpected non-Error exception");

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (key === "surface" || key === "action") {
        scope.setTag(key, String(value));
        return;
      }

      scope.setExtra(key, value);
    });

    Sentry.captureException(normalizedError);
  });
}

/**
 * @param {{ id: string, email?: string | null } | null} user
 */
export function setMonitoringUser(user) {
  if (!isInitialized) {
    return;
  }

  if (!user) {
    Sentry.setUser(null);
    return;
  }

  Sentry.setUser({
    id: user.id,
    email: user.email ?? undefined,
  });
}
