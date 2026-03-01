import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types/database";

let supabase: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createClient() {
  if (!supabase) {
    supabase = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: "pkce",
        },
      }
    );
  }

  return supabase;
}