import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types/database";
import { cookies } from "next/headers";

/**
 * ÚJ név (amit te használsz több helyen)
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value;
        },
        // Route handlerben / Server Componentben sokszor read-only a cookie store,
        // ezért try/catch (ne robbanjon build/runtime közben).
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {}
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: "", ...options, maxAge: 0 });
          } catch {}
        },
      },
    }
  );
}

/**
 * RÉGI név (amit néhány route még importál)
 * ✅ EZ FIXÁLJA A VERCEL BUILD ERROR-T
 */
export const createClient = createServerSupabase;