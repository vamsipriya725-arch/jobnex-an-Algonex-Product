import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) ||
  (typeof process !== "undefined" && process.env && process.env.SUPABASE_URL) ||
  "https://swqebafkntjlgjglylcr.supabase.co";

const supabaseAnonKey =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" && process.env && process.env.SUPABASE_ANON_KEY) ||
  "sb_publishable_ax9iQjGlK5pP34biLoMcag_0egUp2qE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

