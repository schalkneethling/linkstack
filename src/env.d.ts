declare module "varlock/env" {
  export interface TypedEnvSchema {
    APP_ENV: "development" | "production" | "test";
    VITE_SUPABASE_URL: string;
    VITE_SUPABASE_ANON_KEY: string;
    VITE_SENTRY_DSN?: string;
    VITE_SENTRY_ENVIRONMENT?: string;
    SENTRY_DSN?: string;
    SENTRY_ENVIRONMENT?: string;
  }

  export const ENV: TypedEnvSchema;
}

declare const __APP_VERSION__: string;
