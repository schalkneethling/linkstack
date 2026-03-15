// @ts-check
import { createClient } from "@supabase/supabase-js";
import { ENV } from "varlock/env";

const supabaseUrl = ENV.VITE_SUPABASE_URL;
const supabaseAnonKey = ENV.VITE_SUPABASE_ANON_KEY;
const isBrowser = typeof window !== "undefined";
const authStorage = isBrowser ? window.localStorage : undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your environment configuration.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    persistSession: true,
    storage: authStorage,
    storageKey: "linkstack-auth",
  },
});
