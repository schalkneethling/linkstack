// @ts-check
import * as Sentry from "@sentry/node";
import packageJson from "../../../package.json" with { type: "json" };
import "varlock/auto-load";
import { ENV } from "varlock/env";

const EXPECTED_ERRORS = Object.freeze([
  "URL parameter is required",
  "Please enter a valid URL.",
  "URL must use http:// or https:// protocol",
]);

let isInitialized = false;

const SENTRY_RELEASE = packageJson.version || undefined;

export function initServerMonitoring() {
  if (isInitialized || !ENV.SENTRY_DSN) {
    return false;
  }

  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    environment: ENV.SENTRY_ENVIRONMENT || process.env.CONTEXT || ENV.APP_ENV,
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
export async function captureServerException(error, context = {}) {
  if (!isInitialized) {
    return;
  }

  const normalizedError =
    error instanceof Error ? error : new Error("Unexpected non-Error exception");

  Sentry.withScope((scope) => {
    Object.entries(context).forEach(([key, value]) => {
      if (key === "functionName" || key === "surface" || key === "action") {
        scope.setTag(key, String(value));
        return;
      }
      scope.setExtra(key, value);
    });
    Sentry.captureException(normalizedError);
  });

  await Sentry.flush(2000);
}
