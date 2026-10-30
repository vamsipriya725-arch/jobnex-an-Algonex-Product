import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env && process.env.SUPABASE_URL) ||
  "https://your-project-id.supabase.co";

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env && process.env.SUPABASE_ANON_KEY) ||
  "your_supabase_anon_key_here";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

