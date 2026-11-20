import { createClient } from "@supabase/supabase-js";
import {
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
} from "@/lib/supabase/env";

/**
 * Privileged server-only Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 * Use strictly for trusted server verification (e.g., inspecting stored object metadata)
 * after verifying user identity and ownership.
 */
export function createSupabaseAdminClient() {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
