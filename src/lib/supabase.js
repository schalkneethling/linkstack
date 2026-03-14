// @ts-check
import { createClient } from "@supabase/supabase-js";
import { ENV } from "varlock/env";

const supabaseUrl = ENV.VITE_SUPABASE_URL;
const supabaseAnonKey = ENV.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please check your .env file.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
