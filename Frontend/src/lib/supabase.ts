import { createClient } from "@supabase/supabase-js";

const meta = typeof import.meta !== "undefined" ? (import.meta as Record<string, any>) : undefined;
const metaEnv = meta ? (meta["env"] as Record<string, string | undefined> | undefined) : undefined;
const proc = typeof process !== "undefined" ? (process as Record<string, any>) : undefined;
const procEnv = proc ? (proc["env"] as Record<string, string | undefined> | undefined) : undefined;

const supabaseUrl =
  metaEnv?.["VITE_SUPABASE_URL"] ||
  procEnv?.["SUPABASE_URL"] ||
  "https://your-project-id.supabase.co";

const supabaseAnonKey =
  metaEnv?.["VITE_SUPABASE_ANON_KEY"] ||
  procEnv?.["SUPABASE_ANON_KEY"] ||
  "your_supabase_anon_key_here";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
