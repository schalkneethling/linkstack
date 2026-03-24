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
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} source
 * @returns {Record<string, string | number | boolean>}
 */
function extractErrorExtras(source) {
  return Object.entries(source).reduce((extras, [key, value]) => {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      extras[key] = value;
    }

    return extras;
  }, /** @type {Record<string, string | number | boolean>} */ ({}));
}

/**
 * @param {unknown} error
 * @returns {{ normalizedError: Error, extraContext: Record<string, unknown> }}
 */
export function normalizeException(error) {
  if (error instanceof Error) {
    return {
      normalizedError: error,
      extraContext: {},
    };
  }

  if (typeof error === "string") {
    return {
      normalizedError: new Error(error),
      extraContext: {
        originalError: error,
      },
    };
  }

  if (isRecord(error)) {
    const message =
      typeof error.message === "string"
        ? error.message
        : typeof error.error_description === "string"
          ? error.error_description
          : typeof error.code === "string"
            ? `Non-Error exception (${error.code})`
            : "Unexpected non-Error exception";

    const normalizedError = new Error(message);

    if (typeof error.name === "string" && error.name) {
      normalizedError.name = error.name;
    }

    return {
      normalizedError,
      extraContext: {
        ...extractErrorExtras(error),
        originalError: error,
      },
    };
  }

  return {
    normalizedError: new Error("Unexpected non-Error exception"),
    extraContext: {
      originalError: error,
    },
  };
}

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

  const { normalizedError, extraContext } = normalizeException(error);

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (key === "surface" || key === "action") {
        scope.setTag(key, String(value));
        return;
      }

      scope.setExtra(key, value);
    });

    Object.entries(extraContext).forEach(([key, value]) => {
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
